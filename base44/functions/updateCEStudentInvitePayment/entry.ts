import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

const ALLOWED_CALLER_ROLES = new Set([
  "admin",
  "management",
  "ce_instructor",
]);

const OPEN_INVITE_STATUSES = new Set([
  "pending",
  "invite_email_sent",
  "pending_email_failed",
]);

const PAYMENT_RESPONSIBILITIES = new Set([
  "student_paid",
  "instructor_paid",
]);

const INSTRUCTOR_PAYMENT_MODES = new Set([
  "pay_now",
  "invoice_with_cohort",
]);

const CE_REGISTRATION_FEE_KINDS = new Set([
  "training_registration",
  "training_reactivation",
]);

const BILLING_STATUSES_THAT_LOCK_PAYMENT_CHOICE = new Set([
  "ready_for_checkout",
  "payment_processing",
  "paid",
  "waived",
]);

function normalizeText(value: unknown) {
  return String(value || "").trim();
}

function normalizeEmail(value: unknown) {
  return normalizeText(value).toLowerCase();
}

async function resolveOrganizationId(base44: any, caller: any) {
  const directOrgId = normalizeText(caller?.org_id);

  if (directOrgId) {
    return directOrgId;
  }

  const organizations =
    await base44.asServiceRole.entities.Organization.filter({
      owner_email: caller.email,
    });

  return normalizeText(organizations?.[0]?.id);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me();

    if (!caller) {
      return Response.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!ALLOWED_CALLER_ROLES.has(caller.role)) {
      return Response.json(
        {
          ok: false,
          error:
            "Only authorized CE organization users may update student invite payment options.",
        },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));

    const pendingInviteId = normalizeText(
      body?.pending_invite_id
    );

    const paymentResponsibility = normalizeText(
      body?.payment_responsibility
    );

    const instructorPaymentMode = normalizeText(
      body?.instructor_payment_mode
    );

    if (!pendingInviteId) {
      return Response.json(
        {
          ok: false,
          error: "pending_invite_id is required.",
        },
        { status: 400 }
      );
    }

    if (!PAYMENT_RESPONSIBILITIES.has(paymentResponsibility)) {
      return Response.json(
        {
          ok: false,
          error:
            'payment_responsibility must be "student_paid" or "instructor_paid".',
        },
        { status: 400 }
      );
    }

    if (
      paymentResponsibility === "instructor_paid" &&
      !INSTRUCTOR_PAYMENT_MODES.has(instructorPaymentMode)
    ) {
      return Response.json(
        {
          ok: false,
          error:
            'instructor_payment_mode must be "pay_now" or "invoice_with_cohort" when instructor_paid is selected.',
        },
        { status: 400 }
      );
    }

    const organizationId = await resolveOrganizationId(
      base44,
      caller
    );

    if (!organizationId) {
      return Response.json(
        {
          ok: false,
          error: "Your account is not connected to an organization.",
        },
        { status: 400 }
      );
    }

    const inviteRows =
      await base44.asServiceRole.entities.PendingRoleAssignment.filter({
        id: pendingInviteId,
      });

    const invite = Array.isArray(inviteRows)
      ? inviteRows[0]
      : null;

    if (!invite) {
      return Response.json(
        {
          ok: false,
          error: "CE student invitation not found.",
        },
        { status: 404 }
      );
    }

    if (
      invite.role !== "ce_student" ||
      normalizeText(invite.org_id) !== organizationId
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "This CE student invitation does not belong to your organization.",
        },
        { status: 403 }
      );
    }

    if (!OPEN_INVITE_STATUSES.has(invite.status)) {
      return Response.json(
        {
          ok: false,
          error:
            "Only pending CE student invitations may have their payment option changed.",
        },
        { status: 409 }
      );
    }

    if (
      paymentResponsibility === "instructor_paid" &&
      instructorPaymentMode === "invoice_with_cohort"
    ) {
      const cohortId = normalizeText(invite.cohort_id);

      if (!cohortId) {
        return Response.json(
          {
            ok: false,
            error:
              "A Training cohort must be selected before this CE student can be included on a future cohort invoice.",
          },
          { status: 409 }
        );
      }

      const cohortRows =
        await base44.asServiceRole.entities.CETrainingCohort.filter({
          id: cohortId,
        });

      const cohort = Array.isArray(cohortRows)
        ? cohortRows[0]
        : null;

      if (!cohort) {
        return Response.json(
          {
            ok: false,
            error:
              "The Training cohort connected to this invitation could not be found.",
          },
          { status: 409 }
        );
      }

      if (normalizeText(cohort.org_id) !== organizationId) {
        return Response.json(
          {
            ok: false,
            error:
              "The Training cohort connected to this invitation belongs to a different organization.",
          },
          { status: 403 }
        );
      }

      if (cohort.cohort_type !== "training") {
        return Response.json(
          {
            ok: false,
            error:
              "Only Training cohorts may be used for CE registration invoice billing.",
          },
          { status: 409 }
        );
      }

      if (cohort.is_active === false) {
        return Response.json(
          {
            ok: false,
            error:
              "The selected Training cohort is inactive and cannot receive new invoice-billed CE registrations.",
          },
          { status: 409 }
        );
      }
    }

    const billingRows =
      await base44.asServiceRole.entities.OrganizationBillingEvent.filter({
        organization_id: organizationId,
      });

    const inviteEmail = normalizeEmail(invite.email);

    const lockingBillingEvent = (
      Array.isArray(billingRows) ? billingRows : []
    ).find((billingEvent) => {
      const matchesEmail =
        normalizeEmail(billingEvent?.subject_verified_email) ===
        inviteEmail;

      const isStudentRegistration =
        billingEvent?.billing_subject_type === "student" &&
        CE_REGISTRATION_FEE_KINDS.has(billingEvent?.fee_kind);

      return (
        matchesEmail &&
        isStudentRegistration &&
        BILLING_STATUSES_THAT_LOCK_PAYMENT_CHOICE.has(
          billingEvent?.event_status
        )
      );
    });

    if (lockingBillingEvent) {
      return Response.json(
        {
          ok: false,
          error:
            "This payment option cannot be changed because registration billing has already started or settled. Cancel or resolve the related billing transaction first.",
          billing_event_status: lockingBillingEvent.event_status,
        },
        { status: 409 }
      );
    }

    await base44.asServiceRole.entities.PendingRoleAssignment.update(
      invite.id,
      {
        payment_responsibility: paymentResponsibility,
        instructor_payment_mode:
          paymentResponsibility === "instructor_paid"
            ? instructorPaymentMode
            : null,
      }
    );

    return Response.json({
      ok: true,
      message: "CE student invite payment option updated.",
      pending_invite_id: invite.id,
      email: invite.email,
      payment_responsibility: paymentResponsibility,
      instructor_payment_mode:
        paymentResponsibility === "instructor_paid"
          ? instructorPaymentMode
          : null,
      cohort_id: normalizeText(invite.cohort_id) || null,
    });
  } catch (error) {
    console.error(
      "updateCEStudentInvitePayment error:",
      error?.message || error
    );

    return Response.json(
      {
        ok: false,
        error:
          error?.message ||
          "Unable to update the CE student invite payment option.",
      },
      { status: 500 }
    );
  }
});
