import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const RESEND_FROM = Deno.env.get('RESEND_FROM_EMAIL') || 'onboarding@resend.dev';
const APP_URL = Deno.env.get('APP_URL') || 'https://app.base44.com';

async function sendInviteEmail({ toEmail, inviterName, role, appUrl }) {
  const subject = `You've been invited to join the team`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b;">
      <h2 style="color: #2563eb; margin-bottom: 8px;">You're invited!</h2>
      <p style="font-size: 16px; margin-bottom: 16px;">
        <strong>${inviterName}</strong> has invited you to create an <strong>${role}</strong> account.
      </p>
      <p style="margin-bottom: 8px;">To get started:</p>
      <ol style="margin-bottom: 24px; padding-left: 20px; line-height: 1.8;">
        <li>Click the link below to open the app</li>
        <li>Register or sign in using <strong>exactly this email address: ${toEmail}</strong></li>
        <li>You will automatically be connected to ${inviterName} after registration</li>
      </ol>
      <a href="${appUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-bottom: 24px;">
        Register Now →
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
      from: `Workforce App <${RESEND_FROM}>`,
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

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'admin' && user.role !== 'management') {
      return Response.json({ error: 'Forbidden: admin or management role required' }, { status: 403 });
    }

    const body = await req.json();
    const { email, role, manager_id: explicitManagerId } = body;

    if (!email) {
      return Response.json({ error: 'Email is required' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const inviteRole = role || 'employee';
    const accessLevel = inviteRole === 'admin' ? 'admin' : 'staff';
    const now = new Date().toISOString();

    console.log(`[inviteEmployee] Caller: ${user.email} (${user.role}) | inviting: ${normalizedEmail} as ${inviteRole}`);

    // ── Resolve org_id ────────────────────────────────────────────────────
    let orgId = user.org_id || null;
    if (!orgId) {
      const orgs = await base44.asServiceRole.entities.Organization.filter({ owner_email: user.email });
      orgId = orgs[0]?.id || null;
    }

    // ── Resolve inviter's User record id ─────────────────────────────────
    const allUsers = await base44.asServiceRole.entities.User.list();
    const inviterRecord = allUsers.find(u => u.email?.toLowerCase().trim() === user.email?.toLowerCase().trim());
    const inviterId = inviterRecord?.id || null;
    console.log(`[inviteEmployee] Resolved inviter id=${inviterId}`);

    const resolvedManagerId = explicitManagerId || inviterId;

    // ── Check if account already exists ───────────────────────────────────
    const existingUser = allUsers.find(u => u.email?.toLowerCase().trim() === normalizedEmail);
    if (existingUser) {
      console.log(`[inviteEmployee] User already exists id=${existingUser.id}, updating role in place.`);
      await base44.asServiceRole.entities.User.update(existingUser.id, {
        role: inviteRole,
        access_level: accessLevel,
        org_id: orgId,
        ...(resolvedManagerId ? { manager_id: resolvedManagerId } : {}),
      });
      if (resolvedManagerId) {
        const existing = await base44.asServiceRole.entities.ManagerEmployeeAssignment.filter({
          manager_user_id: resolvedManagerId,
          employee_user_id: existingUser.id,
        });
        if (!existing || existing.length === 0) {
          await base44.asServiceRole.entities.ManagerEmployeeAssignment.create({
            org_id: orgId,
            manager_user_id: resolvedManagerId,
            employee_user_id: existingUser.id,
            is_active: true,
          });
        } else {
          await base44.asServiceRole.entities.ManagerEmployeeAssignment.update(existing[0].id, { is_active: true });
        }
      }
      return Response.json({ success: true, message: 'Existing account updated', linked_existing: true });
    }

    // ── Upsert PendingRoleAssignment ──────────────────────────────────────
    const existingPending = await base44.asServiceRole.entities.PendingRoleAssignment.filter({ email: normalizedEmail });
    const samePending = (existingPending || []).find(p =>
      (p.status === 'pending' || p.status === 'invite_email_sent' || p.status === 'pending_email_failed') &&
      p.role === inviteRole &&
      p.access_level === accessLevel
    );

    let pendingId;
    if (samePending) {
      await base44.asServiceRole.entities.PendingRoleAssignment.update(samePending.id, {
        org_id: orgId,
        invited_by_id: resolvedManagerId,
        invited_by_name: user.full_name || user.email,
        invited_at: now,
        status: 'pending',
      });
      pendingId = samePending.id;
      console.log(`[inviteEmployee] Updated existing PendingRoleAssignment id=${pendingId}`);
    } else {
      const created = await base44.asServiceRole.entities.PendingRoleAssignment.create({
        email: normalizedEmail,
        role: inviteRole,
        access_level: accessLevel,
        status: 'pending',
        invited_at: now,
        org_id: orgId,
        invited_by_id: resolvedManagerId,
        invited_by_name: user.full_name || user.email,
      });
      pendingId = created?.id;
      console.log(`[inviteEmployee] Created PendingRoleAssignment id=${pendingId}`);
    }

    // ── Send instruction email via Resend ─────────────────────────────────
    if (!RESEND_API_KEY) {
      await base44.asServiceRole.entities.PendingRoleAssignment.update(pendingId, { status: 'pending_email_failed' });
      return Response.json({
        success: false,
        error: 'RESEND_API_KEY is not configured. Please set it in app secrets.',
      }, { status: 500 });
    }

    try {
      await sendInviteEmail({
        toEmail: normalizedEmail,
        inviterName: user.full_name || user.email,
        role: inviteRole,
        appUrl: APP_URL,
      });
      console.log(`[inviteEmployee] Invite email sent to ${normalizedEmail} via Resend`);

      await base44.asServiceRole.entities.PendingRoleAssignment.update(pendingId, {
        status: 'invite_email_sent',
      });

      return Response.json({ success: true, message: `Invitation email sent to ${normalizedEmail}`, pending_id: pendingId });

    } catch (emailErr) {
      console.error(`[inviteEmployee] Resend failed: ${emailErr.message}`);

      await base44.asServiceRole.entities.PendingRoleAssignment.update(pendingId, {
        status: 'pending_email_failed',
      });

      return Response.json({
        success: false,
        pending_saved: true,
        pending_id: pendingId,
        error: `Invitation record saved but email delivery failed: ${emailErr.message}`,
      }, { status: 500 });
    }

  } catch (error) {
    console.error('[inviteEmployee] Unhandled error:', error.message);
    return Response.json({ error: error.message || 'Unexpected error', success: false }, { status: 500 });
  }
});