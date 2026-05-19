import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const RESEND_FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') || '';
const FREE_DOMAINS = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'live.com', 'icloud.com'];
const fromDomain = RESEND_FROM_EMAIL.split('@')[1] || '';
const RESEND_FROM = RESEND_FROM_EMAIL && !FREE_DOMAINS.includes(fromDomain)
  ? RESEND_FROM_EMAIL
  : 'onboarding@resend.dev';
const APP_URL = Deno.env.get('APP_URL') || 'https://app.base44.com';

// Resend an invite/instruction email to an existing or pending employee.
// The app is PUBLIC — no Base44 platform inviteUser call needed.
// Access is controlled app-side via PendingRoleAssignment + applyPendingRoleIfNeeded.
//
// action = "resend_invite" → re-sends the invitation instruction email
// action = "send_reset"    → sends a sign-in/access recovery email

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'admin' && user.role !== 'management') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { employee_id, action } = await req.json();

    if (!employee_id || !action) {
      return Response.json({ error: 'employee_id and action are required' }, { status: 400 });
    }
    if (!['resend_invite', 'send_reset'].includes(action)) {
      return Response.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Fetch the target employee
    let target = null;
    try {
      const targets = await base44.asServiceRole.entities.User.filter({ id: employee_id });
      target = targets?.[0];
    } catch (_e) {}
    if (!target) {
      return Response.json({ error: 'Employee not found' }, { status: 404 });
    }

    // Security: managers can only act on employees they manage or invited
    if (user.role === 'management') {
      const inviterUsers = await base44.asServiceRole.entities.User.filter({ email: user.email });
      const inviterId = inviterUsers?.[0]?.id;
      const isOwned = target.manager_id === inviterId;
      if (!isOwned) {
        const assignments = await base44.asServiceRole.entities.ManagerEmployeeAssignment.filter({
          manager_user_id: inviterId,
          employee_user_id: employee_id,
        });
        if (!assignments || assignments.length === 0) {
          return Response.json({ error: 'Forbidden: not your employee' }, { status: 403 });
        }
      }
    }

    const normalizedEmail = target.email.toLowerCase().trim();

    // ── Send instruction email via Resend ──────────────────────────────────
    let emailSent = false;
    if (RESEND_API_KEY) {
      const subject = action === 'resend_invite'
        ? `You've been invited to join the team`
        : `Access your account`;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b;">
          <h2 style="color: #2563eb;">${action === 'resend_invite' ? "You're invited!" : "Access Your Account"}</h2>
          <p style="font-size: 16px; margin-bottom: 16px;">
            <strong>${user.full_name || user.email}</strong> has ${action === 'resend_invite' ? 'invited you to create an account' : 'sent you an access link'}.
          </p>
          <p style="margin-bottom: 8px;">To get started, click below and sign in (or register) with <strong>${normalizedEmail}</strong>:</p>
          <a href="${APP_URL}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; margin: 16px 0;">
            Open App →
          </a>
          <p style="color: #64748b; font-size: 13px; margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
            Important: You must use <strong>${normalizedEmail}</strong> to sign in.
          </p>
        </div>
      `;
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ from: `Workforce App <${RESEND_FROM}>`, to: [normalizedEmail], subject, html }),
        });
        if (res.ok) {
          emailSent = true;
          console.log(`[resendInviteOrReset] Email sent to ${normalizedEmail}`);
        } else {
          const err = await res.text();
          console.error(`[resendInviteOrReset] Resend error: ${err}`);
        }
      } catch (emailErr) {
        console.error(`[resendInviteOrReset] Email send failed:`, emailErr.message);
      }
    } else {
      console.warn('[resendInviteOrReset] RESEND_API_KEY not set — skipping email');
    }

    console.log(`[resendInviteOrReset] action=${action} for ${normalizedEmail} by ${user.email} | emailSent=${emailSent}`);

    const message = action === 'resend_invite'
      ? `Invitation email ${emailSent ? 'sent' : 'queued (no email key)'} to ${normalizedEmail}`
      : `Access email ${emailSent ? 'sent' : 'queued (no email key)'} to ${normalizedEmail}`;

    return Response.json({ success: true, message, email_sent: emailSent });
  } catch (error) {
    console.error('[resendInviteOrReset] Error:', error);
    return Response.json({ error: error.message, success: false }, { status: 500 });
  }
});