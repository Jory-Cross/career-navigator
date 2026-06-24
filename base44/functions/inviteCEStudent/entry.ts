import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const RESEND_FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') || '';
const APP_URL = Deno.env.get('APP_URL') || 'https://app.base44.com';

const FREE_DOMAINS = [
  'gmail.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'icloud.com',
];

const fromDomain = RESEND_FROM_EMAIL.split('@')[1] || '';

const RESEND_FROM =
  RESEND_FROM_EMAIL && !FREE_DOMAINS.includes(fromDomain)
    ? RESEND_FROM_EMAIL
    : 'onboarding@resend.dev';

const OPEN_INVITE_STATUSES = [
  'pending',
  'invite_email_sent',
  'pending_email_failed',
];

function normalizeEmail(value) {
  return String(value || '').toLowerCase().trim();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getCanonicalUser(users) {
  const activeUsers = (users || []).filter(
    (candidate) => candidate.is_active !== false
  );

  const usableUsers = activeUsers.length > 0 ? activeUsers : users || [];

  return usableUsers.sort((a, b) => {
    const aTime = new Date(a.created_date || 0).getTime();
    const bTime = new Date(b.created_date || 0).getTime();

    return aTime - bTime;
  })[0];
}

async function findExistingUserByEmail(base44, email) {
  const normalizedEmail = normalizeEmail(email);

  const filteredUsers = await base44.asServiceRole.entities.User.filter({
    email: normalizedEmail,
  });

  const exactMatches = (filteredUsers || []).filter(
    (candidate) => normalizeEmail(candidate.email) === normalizedEmail
  );

  if (exactMatches.length > 0) {
    return getCanonicalUser(exactMatches);
  }

  const allUsers = await base44.asServiceRole.entities.User.list();

  const listMatches = (allUsers || []).filter(
    (candidate) => normalizeEmail(candidate.email) === normalizedEmail
  );

  return getCanonicalUser(listMatches);
}

async function sendInviteEmail({ toEmail, inviterName, appUrl }) {
  const safeEmail = escapeHtml(toEmail);
  const safeInviterName = escapeHtml(inviterName);

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `CE Training <${RESEND_FROM}>`,
      to: [toEmail],
      subject: "You're invited to CE Training",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b;">
          <h2 style="color: #7c3aed; margin-bottom: 8px;">You're invited to CE Training!</h2>

          <p style="font-size: 16px; margin-bottom: 16px;">
            <strong>${safeInviterName}</strong> has invited you to register as a CE Training student.
          </p>

          <p style="margin-bottom: 8px;">To get started:</p>

          <ol style="margin-bottom: 24px; padding-left: 20px; line-height: 1.8;">
            <li>Click the link below to open the CE Training Portal</li>
            <li>Register or sign in using <strong>${safeEmail}</strong></li>
            <li>Your instructor will assign you to a cohort after registration</li>
          </ol>

          <a
            href="${appUrl}"
            style="display: inline-block; background: #7c3aed; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;"
          >
            Register Now →
          </a>

          <p style="color: #64748b; font-size: 13px; margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
            Register using <strong>${safeEmail}</strong>. A different email address will not connect to this invitation.
          </p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Resend API error ${response.status}: ${details}`);
  }

  return response.json();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'ce_instructor') {
      return Response.json(
        { error: 'Only CE instructors can invite students' },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const email = normalizeEmail(body.email);

    if (!isValidEmail(email)) {
      return Response.json(
        { error: 'A valid student email address is required' },
        { status: 400 }
      );
    }

    const orgId = user.org_id || '';

    if (!orgId) {
      return Response.json(
        { error: 'Your instructor account is missing organization access' },
        { status: 400 }
      );
    }

    const existingUser = await findExistingUserByEmail(base44, email);

    if (existingUser && existingUser.id) {
      if (existingUser.is_active === false) {
        return Response.json(
          {
            error:
              'This email belongs to a deactivated account and cannot be invited.',
          },
          { status: 409 }
        );
      }

      if (existingUser.role !== 'ce_student') {
        return Response.json(
          {
            error:
              'An active account already exists for this email and cannot be converted into a CE Student account.',
          },
          { status: 409 }
        );
      }

      if (existingUser.org_id && existingUser.org_id !== orgId) {
        return Response.json(
          {
            error:
              'This CE Student account belongs to a different organization.',
          },
          { status: 409 }
        );
      }

      await base44.asServiceRole.entities.User.update(existingUser.id, {
        role: 'ce_student',
        access_level: 'ce_training_portal',
        org_id: orgId,
        manager_id: existingUser.manager_id || user.id,
      });

      return Response.json({
        ok: true,
        message: 'This CE Student is already registered',
        email,
        user_id: existingUser.id,
        existing_user: true,
        already_registered: true,
        email_sent: false,
      });
    }

    const pendingAssignments =
      await base44.asServiceRole.entities.PendingRoleAssignment.list();

    const existingInvite = (pendingAssignments || []).find((assignment) => {
      return (
        normalizeEmail(assignment.email) === email &&
        assignment.role === 'ce_student' &&
        assignment.org_id === orgId &&
        OPEN_INVITE_STATUSES.includes(assignment.status)
      );
    });

    if (existingInvite) {
      return Response.json({
        ok: true,
        message: 'A CE Student invitation already exists for this email',
        email,
        pending_id: existingInvite.id,
        status: existingInvite.status,
        already_invited: true,
        email_sent: existingInvite.status === 'invite_email_sent',
      });
    }

    const pending =
      await base44.entities.PendingRoleAssignment.create({
        email,
        role: 'ce_student',
        access_level: 'ce_training_portal',
        org_id: orgId,
        invited_by_id: user.id,
        invited_by_name: user.full_name || user.email || '',
        invited_at: new Date().toISOString(),
        status: 'pending',
      });

    let emailSent = false;
    let finalStatus = 'pending';

    if (RESEND_API_KEY) {
      try {
        await sendInviteEmail({
          toEmail: email,
          inviterName: user.full_name || user.email || 'Your instructor',
          appUrl: APP_URL,
        });

        emailSent = true;
        finalStatus = 'invite_email_sent';

        await base44.entities.PendingRoleAssignment.update(pending.id, {
          status: finalStatus,
        });
      } catch (emailError) {
        finalStatus = 'pending_email_failed';

        await base44.entities.PendingRoleAssignment.update(pending.id, {
          status: finalStatus,
        });

        console.error(
          '[inviteCEStudent] Email delivery failed:',
          String(emailError)
        );
      }
    }

    return Response.json({
      ok: true,
      message: emailSent
        ? 'CE Student invitation created and email sent'
        : 'CE Student invitation created',
      pending_id: pending.id,
      email,
      status: finalStatus,
      email_sent: emailSent,
      existing_user: false,
    });
  } catch (error) {
    console.error('[inviteCEStudent] Error:', error);

    return Response.json(
      {
        ok: false,
        error: error.message || 'Unable to create CE Student invitation',
      },
      { status: 500 }
    );
  }
});