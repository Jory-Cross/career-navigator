import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Invites a Pre-ETS Employer user — grants access ONLY to PreEtsEmployerPortal
// for a specific assigned Pre-ETS client record.

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const RESEND_FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') || '';
const FREE_DOMAINS = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'live.com', 'icloud.com'];
const fromDomain = RESEND_FROM_EMAIL.split('@')[1] || '';
const RESEND_FROM = RESEND_FROM_EMAIL && !FREE_DOMAINS.includes(fromDomain)
  ? RESEND_FROM_EMAIL
  : 'onboarding@resend.dev';
const APP_URL = Deno.env.get('APP_URL') || 'https://app.base44.com';

async function sendEmployerInviteEmail({ toEmail, inviterName, appUrl }) {
  const subject = `You've been invited to the Pre-ETS Employer Portal`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b;">
      <h2 style="color: #2563eb; margin-bottom: 8px;">You're invited!</h2>
      <p style="font-size: 16px; margin-bottom: 16px;">
        <strong>${inviterName}</strong> has invited you to access the Pre-ETS Employer Portal.
      </p>
      <p style="margin-bottom: 8px;">To get started:</p>
      <ol style="margin-bottom: 24px; padding-left: 20px; line-height: 1.8;">
        <li>Click the link below to open the portal</li>
        <li>Register or sign in using <strong>exactly this email address: ${toEmail}</strong></li>
        <li>You will be able to manage your Pre-ETS assignments immediately</li>
      </ol>
      <a href="${appUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-bottom: 24px;">
        Access Employer Portal →
      </a>
      <p style="color: #64748b; font-size: 13px; margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
        Important: You must use <strong>${toEmail}</strong> to register. Using a different email will not link your account correctly.
      </p>
    </div>
  `;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `Pre-ETS Employer Portal <${RESEND_FROM}>`,
      to: [toEmail],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend API error ${res.status}: ${err}`);
  }

  return await res.json();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user || !['admin', 'management', 'employee'].includes(user.role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { email, clientId } = await req.json();

    if (!email) {
      return Response.json({ error: 'Email is required' }, { status: 400 });
    }
    if (!clientId) {
      return Response.json({ error: 'clientId is required — employer must be linked to a specific Pre-ETS client' }, { status: 400 });
    }

    // Verify the client exists and is a pre_ets type
    const clientRecords = await base44.asServiceRole.entities.Client.filter({ id: clientId });
    const client = clientRecords?.[0];
    if (!client) {
      return Response.json({ error: 'Client record not found' }, { status: 404 });
    }
    if (client.client_type !== 'pre_ets') {
      return Response.json({ error: 'Employer portal invitations can only be linked to Pre-ETS clients' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const now = new Date().toISOString();

    // Check if a User account already exists — if so, update in place (no duplicate)
    const existingUsers = await base44.asServiceRole.entities.User.filter({ email: normalizedEmail });
    if (existingUsers && existingUsers.length > 0) {
      const existingUser = existingUsers[0];
      console.log(`[invitePreEtsEmployer] User already exists for ${normalizedEmail} (id=${existingUser.id}), updating role in place.`);
      await base44.asServiceRole.entities.User.update(existingUser.id, {
        role: 'pre_ets_employer',
        access_level: 'pre_ets_employer_portal',
        org_id: user.org_id || null,
        linked_client_id: clientId,
      });
      await base44.asServiceRole.entities.Activity.create({
        client_id: clientId,
        org_id: user.org_id || null,
        activity_type: 'email_sent',
        title: 'Pre-ETS Employer portal access updated',
        description: `Existing account for ${normalizedEmail} updated with employer portal access by ${user.full_name || user.email}`,
      });
      return Response.json({ success: true, message: 'Existing account updated with employer portal access', linked_existing: true });
    }

    // Upsert PendingRoleAssignment — avoid duplicate pending entries
    const existing = await base44.asServiceRole.entities.PendingRoleAssignment.filter({ email: normalizedEmail });
    const existingForClient = (existing || []).find(p =>
      p.status === 'pending' && p.role === 'pre_ets_employer' && p.client_id === clientId
    );

    if (existingForClient) {
      console.log(`[invitePreEtsEmployer] Updating existing pending assignment ${existingForClient.id} for ${normalizedEmail}`);
      await base44.asServiceRole.entities.PendingRoleAssignment.update(existingForClient.id, {
        access_level: 'pre_ets_employer_portal',
        org_id: user.org_id || null,
        invited_by_id: user.id,
        invited_by_name: user.full_name || user.email,
        invited_at: now,
      });
    } else {
      // Remove any stale pending assignments for this email (different client/role)
      for (const old of (existing || [])) {
        await base44.asServiceRole.entities.PendingRoleAssignment.delete(old.id);
      }
      await base44.asServiceRole.entities.PendingRoleAssignment.create({
        email: normalizedEmail,
        role: 'pre_ets_employer',
        access_level: 'pre_ets_employer_portal',
        org_id: user.org_id || null,
        invited_by_id: user.id,
        invited_by_name: user.full_name || user.email,
        invited_at: now,
        client_id: clientId,
        status: 'pending',
      });
    }

    console.log(`[invitePreEtsEmployer] PendingRoleAssignment upserted: email=${normalizedEmail} role=pre_ets_employer client_id=${clientId}`);

    // ── Call Base44 platform inviteUser via privileged relay ─────────────────
    let platformInviteSent = false;
    let platformInviteError = null;

    try {
      const platformInviteInternalSecret =
  Deno.env.get("PLATFORM_INVITE_INTERNAL_SECRET") || "";

if (!platformInviteInternalSecret) {
  throw new Error(
    "PLATFORM_INVITE_INTERNAL_SECRET is not configured."
  );
}

const inviteRes =
  await base44.asServiceRole.functions.invoke(
    "platformInviteUser",
    {
      email: normalizedEmail,
      internal_secret: platformInviteInternalSecret,
    }
  );
      if (inviteRes?.success === false) {
        throw new Error(inviteRes.error || 'platformInviteUser returned success=false');
      }
      platformInviteSent = true;
      console.log(`[invitePreEtsEmployer] Base44 platform invite sent to ${normalizedEmail} via relay. Result:`, JSON.stringify(inviteRes));
    } catch (inviteErr) {
      platformInviteError = inviteErr?.message || String(inviteErr);
      console.error(`[invitePreEtsEmployer] Base44 platform invite FAILED for ${normalizedEmail}:`, platformInviteError);
    }

    // ── Send instruction email via Resend (optional — only if API configured) ──
    let instructionEmailSent = false;

    if (RESEND_API_KEY) {
      try {
        await sendEmployerInviteEmail({
          toEmail: normalizedEmail,
          inviterName: user.full_name || user.email,
          appUrl: APP_URL,
        });
        instructionEmailSent = true;
        console.log(`[invitePreEtsEmployer] Instruction email sent to ${normalizedEmail} via Resend`);
      } catch (emailErr) {
        console.error(`[invitePreEtsEmployer] Resend instruction email failed: ${emailErr.message}`);
      }
    }

    // ── Log activity on the client record ────────────────────────────────────
    await base44.asServiceRole.entities.Activity.create({
      client_id: clientId,
      org_id: user.org_id || null,
      activity_type: 'email_sent',
      title: platformInviteSent ? 'Pre-ETS Employer portal invitation sent' : 'Pre-ETS Employer portal access prepared (platform invite failed)',
      description: platformInviteSent
        ? `Employer portal access invitation sent to ${normalizedEmail} by ${user.full_name || user.email}`
        : `PendingRoleAssignment created for ${normalizedEmail} but platform invite failed: ${platformInviteError}`,
    });

    if (!platformInviteSent) {
      return Response.json({
        success: false,
        access_prepared: true,
        platform_invite_error: platformInviteError,
        message: 'Employer portal access prepared, but platform invitation failed.',
      }, { status: 500 });
    }

    return Response.json({
      success: true,
      message: 'Pre-ETS Employer invitation sent successfully',
      platform_invite_sent: platformInviteSent,
      instruction_email_sent: instructionEmailSent,
    });
  } catch (error) {
    console.error('[invitePreEtsEmployer] error:', error);
    return Response.json({ error: error.message, success: false }, { status: 500 });
  }
});
