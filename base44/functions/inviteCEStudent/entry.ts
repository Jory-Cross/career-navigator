import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const RESEND_FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') || '';
const FREE_DOMAINS = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'live.com', 'icloud.com'];
const fromDomain = RESEND_FROM_EMAIL.split('@')[1] || '';
const RESEND_FROM = RESEND_FROM_EMAIL && !FREE_DOMAINS.includes(fromDomain)
  ? RESEND_FROM_EMAIL
  : 'onboarding@resend.dev';
const APP_URL = Deno.env.get('APP_URL') || 'https://app.base44.com';

async function sendInviteEmail({ toEmail, inviterName, cohortName, appUrl }) {
  const subject = `You're invited to join the CE Training cohort: ${cohortName}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b;">
      <h2 style="color: #7c3aed; margin-bottom: 8px;">You're invited to CE Training!</h2>
      <p style="font-size: 16px; margin-bottom: 16px;">
        <strong>${inviterName}</strong> has invited you to join the <strong>${cohortName}</strong> cohort as a CE Student.
      </p>
      <p style="margin-bottom: 8px;">To get started:</p>
      <ol style="margin-bottom: 24px; padding-left: 20px; line-height: 1.8;">
        <li>Click the link below to open the app</li>
        <li>Register or sign in using <strong>exactly this email address: ${toEmail}</strong></li>
        <li>You will automatically be added to the cohort after registration</li>
      </ol>
      <a href="${appUrl}" style="display: inline-block; background: #7c3aed; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-bottom: 24px;">
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
      from: `CE Training <${RESEND_FROM}>`,
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
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { email, cohort_id } = await req.json();
    
    // Validate inputs
    if (!email || !cohort_id) {
      return Response.json({ error: 'Missing email or cohort_id' }, { status: 400 });
    }

    // Verify user is an instructor
    if (user.role !== 'ce_instructor') {
      return Response.json({ error: 'Only instructors can invite students' }, { status: 403 });
    }

    // Verify cohort exists and user is a manager
    const cohort = await base44.entities.CETrainingCohort.get(cohort_id);
    if (!cohort) {
      return Response.json({ error: 'Cohort not found' }, { status: 404 });
    }

    const membership = await base44.entities.CETrainingCohortMember.filter({
      cohort_id,
      user_id: user.id,
      cohort_role: 'manager',
    });
    
    if (!membership || membership.length === 0) {
      return Response.json({ error: 'You are not a manager of this cohort' }, { status: 403 });
    }

    // Create pending role assignment for ce_student
    const pending = await base44.entities.PendingRoleAssignment.create({
      email: email.toLowerCase().trim(),
      role: 'ce_student',
      access_level: 'ce_training_portal',
      org_id: user.org_id,
      invited_by_id: user.id,
      invited_by_name: user.full_name || user.email,
      invited_at: new Date().toISOString(),
      client_id: null, // Not a client portal invite
      status: 'pending',
    });

    // Store cohort_id and cohort_role as metadata for the pending invite
    // (Will be applied when user registers via the invite flow)
    const pendingWithCohort = await base44.entities.PendingRoleAssignment.update(pending.id, {
      cohort_id,
      cohort_role: 'student',
    });

    // Send invitation email
    let emailSent = false;
    if (RESEND_API_KEY) {
      try {
        await sendInviteEmail({
          toEmail: email.toLowerCase().trim(),
          inviterName: user.full_name || user.email,
          cohortName: cohort.name,
          appUrl: APP_URL,
        });
        emailSent = true;
        console.log(`[inviteCEStudent] Invitation email sent to ${email}`);
        
        // Update status to reflect email was sent
        await base44.entities.PendingRoleAssignment.update(pending.id, {
          status: 'invite_email_sent',
        });
      } catch (emailErr) {
        console.error(`[inviteCEStudent] Email failed: ${emailErr.message}`);
        await base44.entities.PendingRoleAssignment.update(pending.id, {
          status: 'pending_email_failed',
        });
      }
    }

    return Response.json({
      ok: true,
      message: emailSent ? 'CE Student invitation created and email sent' : 'CE Student invitation created',
      pending_id: pending.id,
      email,
      cohort_id,
      status: emailSent ? 'invite_email_sent' : 'pending',
      email_sent: emailSent,
    });
  } catch (error) {
    console.error('[inviteCEStudent] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});