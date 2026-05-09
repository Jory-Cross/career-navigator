import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user || !['admin', 'management', 'employee'].includes(user.role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { email, clientId, clientType } = body;
    const org_id = body.org_id || user.org_id || null;

    if (!email) return Response.json({ error: 'Email is required' }, { status: 400 });
    if (!clientId) return Response.json({ error: 'clientId is required' }, { status: 400 });
    if (!org_id) return Response.json({ error: 'org_id is required' }, { status: 400 });

    const normalizedEmail = email.toLowerCase().trim();
    const role = clientType === 'pre_ets' ? 'pre_ets' : clientType === 'dspd' ? 'dspd' : 'client';
    const access_level = 'client_portal';
    const now = new Date().toISOString();

    console.log(`[inviteClient] Inviting ${normalizedEmail} as role=${role} access_level=${access_level} client_id=${clientId} org_id=${org_id}`);

    // ── PendingRoleAssignment: upsert ────────────────────────────────────────
    const existing = await base44.asServiceRole.entities.PendingRoleAssignment.filter({ email: normalizedEmail });
    const pendingForEmail = (existing || []).filter(p => p.status === 'pending');

    const duplicate = pendingForEmail.find(p =>
      p.client_id === clientId && p.access_level === access_level
    );

    if (duplicate) {
      console.log(`[inviteClient] Updating existing pending assignment ${duplicate.id} for ${normalizedEmail}`);
      await base44.asServiceRole.entities.PendingRoleAssignment.update(duplicate.id, {
        role, access_level, org_id,
        invited_by_id: user.id,
        invited_by_name: user.full_name || user.email,
        invited_at: now, client_id: clientId, status: 'pending',
      });
    } else {
      // Clean up any stale incomplete assignments
      for (const old of pendingForEmail) {
        if (!old.access_level || !old.org_id || !old.client_id) {
          console.log(`[inviteClient] Removing incomplete stale assignment ${old.id} for ${normalizedEmail}`);
          await base44.asServiceRole.entities.PendingRoleAssignment.delete(old.id);
        }
      }
      await base44.asServiceRole.entities.PendingRoleAssignment.create({
        email: normalizedEmail, role, access_level, org_id,
        invited_by_id: user.id,
        invited_by_name: user.full_name || user.email,
        invited_at: now, client_id: clientId, status: 'pending',
      });
      console.log(`[inviteClient] Created PendingRoleAssignment: email=${normalizedEmail} role=${role} client_id=${clientId} org_id=${org_id}`);
    }

    // Mark client as in_progress
    await base44.asServiceRole.entities.Client.update(clientId, { onboarding_status: 'in_progress' });

    // ── Attempt email send — tracked separately from assignment creation ──────
    let emailSent = false;
    let emailError = null;

    try {
      const inviteResult = await base44.users.inviteUser(normalizedEmail, 'user');
      // inviteUser returns undefined on success; truthy error object on failure
      // Treat any non-throw as success, but log the raw result
      console.log(`[inviteClient] inviteUser result for ${normalizedEmail}:`, JSON.stringify(inviteResult ?? 'undefined (expected on success)'));
      emailSent = true;
    } catch (inviteErr) {
      emailError = inviteErr?.message || String(inviteErr);
      console.error(`[inviteClient] inviteUser FAILED for ${normalizedEmail}:`, emailError);
    }

    // ── Activity log — always records actual email outcome ───────────────────
    await base44.asServiceRole.entities.Activity.create({
      client_id: clientId,
      org_id,
      activity_type: 'email_sent',
      title: emailSent ? 'Portal invitation sent' : 'Portal access prepared (email failed)',
      description: emailSent
        ? `Invitation email sent to ${normalizedEmail} by ${user.full_name || user.email}`
        : `PendingRoleAssignment created for ${normalizedEmail} but inviteUser failed: ${emailError}`,
    });

    if (!emailSent) {
      // Return 200 with explicit flags — access is prepared, email failed
      return Response.json({
        success: true,
        email_sent: false,
        access_prepared: true,
        email_error: emailError,
        message: 'Portal access prepared, but email delivery failed.',
      });
    }

    return Response.json({
      success: true,
      email_sent: true,
      access_prepared: true,
      message: 'Invitation sent successfully',
    });

  } catch (error) {
    console.error('[inviteClient] Error:', error.message);
    return Response.json({ error: error.message, success: false }, { status: 500 });
  }
});