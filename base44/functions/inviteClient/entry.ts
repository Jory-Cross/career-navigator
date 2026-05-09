import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user || !['admin', 'management', 'employee'].includes(user.role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { email, clientId, clientType } = await req.json();

    if (!email) {
      return Response.json({ error: 'Email is required' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const role = clientType === 'pre_ets' ? 'pre_ets' : clientType === 'dspd' ? 'dspd' : 'client';
    const access_level = 'client_portal';
    const org_id = user.org_id || null;
    const now = new Date().toISOString();

    // Validate required fields before proceeding
    if (!org_id) {
      console.warn(`[inviteClient] Warning: inviting user has no org_id. User=${user.email}`);
    }
    if (!clientId) {
      console.warn(`[inviteClient] Warning: no clientId provided for email=${normalizedEmail}`);
    }

    console.log(`[inviteClient] Inviting ${normalizedEmail} as role=${role} access_level=${access_level} client_id=${clientId} org_id=${org_id}`);

    // Fetch all existing pending assignments for this email
    const existing = await base44.asServiceRole.entities.PendingRoleAssignment.filter({ email: normalizedEmail });
    const pendingForEmail = (existing || []).filter(p => p.status === 'pending');

    // Look for an existing valid assignment for the same email + client + access_level
    // (deduplication key: email + client_id + access_level)
    const duplicate = pendingForEmail.find(p =>
      p.client_id === clientId &&
      p.access_level === access_level
    );

    if (duplicate) {
      // Update the existing assignment instead of creating a new one
      console.log(`[inviteClient] Updating existing pending assignment ${duplicate.id} for ${normalizedEmail}`);
      await base44.asServiceRole.entities.PendingRoleAssignment.update(duplicate.id, {
        role,
        access_level,
        org_id,
        invited_by_id: user.id,
        invited_by_name: user.full_name || user.email,
        invited_at: now,
        client_id: clientId,
        status: 'pending',
      });
    } else {
      // Archive any stale incomplete pending assignments for the same email
      // (those missing access_level, org_id, or client_id — these are the bad duplicates)
      for (const old of pendingForEmail) {
        const isIncomplete = !old.access_level || !old.org_id || !old.client_id;
        if (isIncomplete) {
          console.log(`[inviteClient] Removing incomplete stale assignment ${old.id} for ${normalizedEmail}`);
          await base44.asServiceRole.entities.PendingRoleAssignment.delete(old.id);
        }
      }

      // Create a complete, valid assignment
      await base44.asServiceRole.entities.PendingRoleAssignment.create({
        email: normalizedEmail,
        role,
        access_level,
        org_id,
        invited_by_id: user.id,
        invited_by_name: user.full_name || user.email,
        invited_at: now,
        client_id: clientId,
        status: 'pending',
      });
      console.log(`[inviteClient] Created PendingRoleAssignment: email=${normalizedEmail} role=${role} access_level=${access_level} client_id=${clientId} org_id=${org_id}`);
    }

    // Mark the client record as in_progress
    if (clientId) {
      await base44.asServiceRole.entities.Client.update(clientId, {
        onboarding_status: 'in_progress',
      });
    }

    // Send the platform invitation email — onUserRegistered upgrades to correct role
    await base44.users.inviteUser(normalizedEmail, 'user');
    console.log(`[inviteClient] Invitation email sent to ${normalizedEmail}`);

    // Log activity on the client record
    if (clientId) {
      await base44.asServiceRole.entities.Activity.create({
        client_id: clientId,
        org_id,
        activity_type: 'email_sent',
        title: 'Portal invitation sent',
        description: `Portal access invitation sent to ${normalizedEmail} by ${user.full_name || user.email}`,
      });
    }

    return Response.json({ success: true, message: 'Invitation sent successfully' });
  } catch (error) {
    console.error('[inviteClient] Error:', error.message);
    return Response.json({ error: error.message, success: false }, { status: 500 });
  }
});