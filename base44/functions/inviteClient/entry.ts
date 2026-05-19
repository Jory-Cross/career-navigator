import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const RESEND_FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') || '';
const FREE_DOMAINS = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'live.com', 'icloud.com'];
const fromDomain = RESEND_FROM_EMAIL.split('@')[1] || '';
const RESEND_FROM = RESEND_FROM_EMAIL && !FREE_DOMAINS.includes(fromDomain)
  ? RESEND_FROM_EMAIL
  : 'onboarding@resend.dev';
const APP_URL = Deno.env.get('APP_URL') || 'https://app.base44.com';

async function sendClientInviteEmail({ toEmail, inviterName, appUrl }) {
  const subject = `You've been invited to join the Career Navigator`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b;">
      <h2 style="color: #2563eb; margin-bottom: 8px;">You're invited!</h2>
      <p style="font-size: 16px; margin-bottom: 16px;">
        <strong>${inviterName}</strong> has invited you to join the Career Navigator client portal.
      </p>
      <p style="margin-bottom: 8px;">To get started:</p>
      <ol style="margin-bottom: 24px; padding-left: 20px; line-height: 1.8;">
        <li>Click the link below to open the portal</li>
        <li>Register or sign in using <strong>exactly this email address: ${toEmail}</strong></li>
        <li>You will be able to access your account immediately</li>
      </ol>
      <a href="${appUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-bottom: 24px;">
        Access Portal →
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
      from: `Career Navigator <${RESEND_FROM}>`,
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

    // ── Call Base44 platform inviteUser via privileged relay ─────────────────
    let platformInviteSent = false;
    let platformInviteError = null;

    try {
      const inviteRes = await base44.asServiceRole.functions.invoke('platformInviteUser', { email: normalizedEmail });
      if (inviteRes?.success === false) {
        throw new Error(inviteRes.error || 'platformInviteUser returned success=false');
      }
      platformInviteSent = true;
      console.log(`[inviteClient] Base44 platform invite sent to ${normalizedEmail} via relay. Result:`, JSON.stringify(inviteRes));
    } catch (inviteErr) {
      platformInviteError = inviteErr?.message || String(inviteErr);
      console.error(`[inviteClient] Base44 platform invite FAILED for ${normalizedEmail}:`, platformInviteError);
    }

    // ── Send instruction email via Resend (optional — only if API configured) ──
    let instructionEmailSent = false;

    if (RESEND_API_KEY) {
      try {
        await sendClientInviteEmail({
          toEmail: normalizedEmail,
          inviterName: user.full_name || user.email,
          appUrl: APP_URL,
        });
        instructionEmailSent = true;
        console.log(`[inviteClient] Instruction email sent to ${normalizedEmail} via Resend`);
      } catch (emailErr) {
        console.error(`[inviteClient] Resend instruction email failed: ${emailErr.message}`);
      }
    }

    // ── Activity log — records actual platform invite outcome ──────────────────
    await base44.asServiceRole.entities.Activity.create({
      client_id: clientId,
      org_id,
      activity_type: 'email_sent',
      title: platformInviteSent ? 'Portal invitation sent' : 'Portal access prepared (platform invite failed)',
      description: platformInviteSent
        ? `Invitation sent to ${normalizedEmail} by ${user.full_name || user.email}`
        : `PendingRoleAssignment created for ${normalizedEmail} but platform invite failed: ${platformInviteError}`,
    });

    if (!platformInviteSent) {
      // Return 200 with explicit flags — access is prepared, but platform invite failed
      return Response.json({
        success: false,
        access_prepared: true,
        platform_invite_error: platformInviteError,
        message: 'Portal access prepared, but platform invitation failed.',
      }, { status: 500 });
    }

    return Response.json({
      success: true,
      message: 'Invitation sent successfully',
      platform_invite_sent: platformInviteSent,
      instruction_email_sent: instructionEmailSent,
    });

  } catch (error) {
    console.error('[inviteClient] Error:', error.message);
    return Response.json({ error: error.message, success: false }, { status: 500 });
  }
});