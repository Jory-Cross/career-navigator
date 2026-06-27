import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") || "";
const APP_URL = Deno.env.get("APP_URL") || "https://app.base44.com";

const FREE_DOMAINS = [
  "gmail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "icloud.com",
];

const fromDomain = RESEND_FROM_EMAIL.split("@")[1] || "";

const RESEND_FROM =
  RESEND_FROM_EMAIL && !FREE_DOMAINS.includes(fromDomain)
    ? RESEND_FROM_EMAIL
    : "onboarding@resend.dev";

const OPEN_INVITE_STATUSES = [
  "pending",
  "invite_email_sent",
  "pending_email_failed",
];

const PAYMENT_RESPONSIBILITIES = [
  "student_paid",
  "instructor_paid",
];

const INSTRUCTOR_PAYMENT_MODES = [
  "pay_now",
  "invoice_with_cohort",
];

function normalizeEmail(value) {
  return String(value || "").toLowerCase().trim();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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

function isNeutralExistingAccount(user) {
  const role = String(user?.role || "").trim();
  const accessLevel = String(user?.access_level || "").trim();
  const orgId = String(user?.org_id || "").trim();
  const managerId = String(user?.manager_id || "").trim();
  const linkedClientId = String(user?.linked_client_id || "").trim();

  return (
    ["", "user", "employee"].includes(role) &&
    !accessLevel &&
    !orgId &&
    !managerId &&
    !linkedClientId
  );
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

function getEnrollmentMessage(
  paymentResponsibility,
  instructorPaymentMode
) {
  if (paymentResponsibility === "student_paid") {
    return "Your CE Training registration fee must be settled before CE Training Portal access is activated.";
  }

  if (instructorPaymentMode === "pay_now") {
    return "Your instructor is handling your CE Training registration payment. CE Training Portal access will be activated after payment is confirmed.";
  }

  return "Your instructor will include your CE Training registration on a cohort invoice. CE Training Portal access will be activated after that invoice is settled.";
}

async function sendInviteEmail({
  toEmail,
  inviterName,
  appUrl,
  paymentResponsibility,
  instructorPaymentMode,
}) {
  const safeEmail = escapeHtml(toEmail);
  const safeInviterName = escapeHtml(inviterName);
  const safeEnrollmentMessage = escapeHtml(
    getEnrollmentMessage(
      paymentResponsibility,
      instructorPaymentMode
    )
  );

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `CE Training <${RESEND_FROM}>`,
      to: [toEmail],
      subject: "You're invited to CE Training",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b;">
          <h2 style="color: #7c3aed; margin-bottom: 8px;">You're invited to CE Training!</h2>

          <p style="font-size: 16px; margin-bottom: 16px;">
            <strong>${safeInviterName}</strong> has started your CE Training enrollment.
          </p>

          <p style="margin-bottom: 16px;">
            ${safeEnrollmentMessage}
          </p>

          <p style="margin-bottom: 8px;">To get started:</p>

          <ol style="margin-bottom: 24px; padding-left: 20px; line-height: 1.8;">
            <li>Click the link below to open the CE Training Portal</li>
            <li>Register or sign in using <strong>${safeEmail}</strong></li>
            <li>CE Training access will appear after your registration is settled</li>
          </ol>

          <a
            href="${appUrl}"
            style="display: inline-block; background: #7c3aed; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;"
          >
            View Enrollment →
          </a>

          <p style="color: #64748b; font-size: 13px; margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
            Use <strong>${safeEmail}</strong>. A different email address will not connect to this invitation.
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
      return Response.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (user.role !== "ce_instructor") {
      return Response.json(
        { error: "Only CE instructors can invite students" },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));

    const email = normalizeEmail(body.email);
    const cohortId = String(body?.cohort_id || "").trim();

    const paymentResponsibility = String(
      body?.payment_responsibility || "student_paid"
    ).trim();

    const instructorPaymentMode = String(
      body?.instructor_payment_mode || ""
    ).trim();

    if (!isValidEmail(email)) {
      return Response.json(
        { error: "A valid student email address is required" },
        { status: 400 }
      );
    }

    if (!PAYMENT_RESPONSIBILITIES.includes(paymentResponsibility)) {
      return Response.json(
        {
          error:
            'payment_responsibility must be "student_paid" or "instructor_paid".',
        },
        { status: 400 }
      );
    }

    if (
      paymentResponsibility === "instructor_paid" &&
      !INSTRUCTOR_PAYMENT_MODES.includes(instructorPaymentMode)
    ) {
      return Response.json(
        {
          error:
            'instructor_payment_mode must be "pay_now" or "invoice_with_cohort" when instructor_paid is selected.',
        },
        { status: 400 }
      );
    }

    const orgId = String(user.org_id || "").trim();

    if (!orgId) {
      return Response.json(
        {
          error:
            "Your instructor account is missing organization access",
        },
        { status: 400 }
      );
    }

    if (cohortId) {
      const cohortRows =
        await base44.asServiceRole.entities.CETrainingCohort.filter({
          id: cohortId,
        });

      const cohort = Array.isArray(cohortRows)
        ? cohortRows[0]
        : null;

      if (!cohort) {
        return Response.json(
          { error: "Selected CE training cohort was not found." },
          { status: 404 }
        );
      }

      if (cohort.org_id && cohort.org_id !== orgId) {
        return Response.json(
          {
            error:
              "Selected CE training cohort does not belong to your organization.",
          },
          { status: 403 }
        );
      }

      if (cohort.cohort_type !== "training") {
        return Response.json(
          {
            error:
              "CE student invitations may only reference Training cohorts.",
          },
          { status: 400 }
        );
      }
    }

    const existingUser = await findExistingUserByEmail(
      base44,
      email
    );

    if (existingUser?.id) {
      if (existingUser.is_active === false) {
        return Response.json(
          {
            error:
              "This email belongs to a deactivated account and cannot be invited.",
          },
          { status: 409 }
        );
      }

      if (existingUser.role === "ce_student") {
        if (
          existingUser.org_id &&
          existingUser.org_id !== orgId
        ) {
          return Response.json(
            {
              error:
                "This CE Student account belongs to a different organization.",
            },
            { status: 409 }
          );
        }

        return Response.json({
          ok: true,
          message: "This CE Student is already registered",
          email,
          user_id: existingUser.id,
          existing_user: true,
          already_registered: true,
          email_sent: false,
        });
      }

      if (!isNeutralExistingAccount(existingUser)) {
        return Response.json(
          {
            error:
              "An active non-CE account already exists for this email and cannot be used for CE student enrollment.",
          },
          { status: 409 }
        );
      }
    }

    const pendingAssignments =
      await base44.asServiceRole.entities.PendingRoleAssignment.list();

    const existingInvite = (pendingAssignments || []).find(
      (assignment) =>
        normalizeEmail(assignment.email) === email &&
        assignment.role === "ce_student" &&
        assignment.org_id === orgId &&
        OPEN_INVITE_STATUSES.includes(assignment.status)
    );

    if (existingInvite) {
      return Response.json({
        ok: true,
        message:
          "A CE Student invitation already exists for this email",
        email,
        pending_id: existingInvite.id,
        status: existingInvite.status,
        already_invited: true,
        email_sent:
          existingInvite.status === "invite_email_sent",
        payment_responsibility:
          existingInvite.payment_responsibility ||
          "student_paid",
        instructor_payment_mode:
          existingInvite.instructor_payment_mode || null,
      });
    }

    const pending =
      await base44.entities.PendingRoleAssignment.create({
        email,
        role: "ce_student",
        access_level: "ce_training_portal",
        org_id: orgId,
        invited_by_id: user.id,
        invited_by_name: user.full_name || user.email || "",
        invited_at: new Date().toISOString(),
        cohort_id: cohortId || undefined,
        payment_responsibility: paymentResponsibility,
        instructor_payment_mode:
          paymentResponsibility === "instructor_paid"
            ? instructorPaymentMode
            : undefined,
        status: "pending",
      });

    let emailSent = false;
    let finalStatus = "pending";

    if (RESEND_API_KEY) {
      try {
        await sendInviteEmail({
          toEmail: email,
          inviterName:
            user.full_name || user.email || "Your instructor",
          appUrl: APP_URL,
          paymentResponsibility,
          instructorPaymentMode:
            paymentResponsibility === "instructor_paid"
              ? instructorPaymentMode
              : "",
        });

        emailSent = true;
        finalStatus = "invite_email_sent";

        await base44.entities.PendingRoleAssignment.update(
          pending.id,
          {
            status: finalStatus,
          }
        );
      } catch (emailError) {
        finalStatus = "pending_email_failed";

        await base44.entities.PendingRoleAssignment.update(
          pending.id,
          {
            status: finalStatus,
          }
        );

        console.error(
          "[inviteCEStudent] Email delivery failed:",
          String(emailError)
        );
      }
    }

    return Response.json({
      ok: true,
      message: emailSent
        ? "CE Student enrollment invitation created and email sent"
        : "CE Student enrollment invitation created",
      pending_id: pending.id,
      email,
      status: finalStatus,
      email_sent: emailSent,
      existing_user: !!existingUser?.id,
      payment_responsibility: paymentResponsibility,
      instructor_payment_mode:
        paymentResponsibility === "instructor_paid"
          ? instructorPaymentMode
          : null,
      cohort_id: cohortId || null,
    });
  } catch (error) {
    console.error("[inviteCEStudent] Error:", error);

    return Response.json(
      {
        ok: false,
        error:
          error.message ||
          "Unable to create CE Student invitation",
      },
      { status: 500 }
    );
  }
});
