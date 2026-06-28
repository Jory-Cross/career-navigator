import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

const ALLOWED_ROLES = new Set([
  "admin",
  "management",
  "ce_instructor",
]);

const OPEN_INVITE_STATUSES = new Set([
  "pending",
  "invite_email_sent",
  "pending_email_failed",
]);

const INVOICE_ELIGIBLE_EVENT_STATUSES = new Set([
  "pending",
]);

const SETTLED_EVENT_STATUSES = new Set([
  "paid",
  "waived",
]);

const CE_REGISTRATION_FEE_KINDS = new Set([
  "training_registration",
  "training_reactivation",
]);

function normalizeText(value: unknown) {
  return String(value || "").trim();
}

function normalizeEmail(value: unknown) {
  return normalizeText(value).toLowerCase();
}

function buildRegistrationBillingEventKey(
  organizationId: string,
  email: string
) {
  return `ce_student_registration:${organizationId}:${encodeURIComponent(
    normalizeEmail(email)
  )}`;
}

function isActive(record: any) {
  return record?.is_active !== false;
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

function createBlockedRecord(
  invite: any,
  reasonCode: string,
  reason: string,
  billingEvent: any = null
) {
  return {
    pending_invite_id: invite.id,
    email: invite.email,
    reason_code: reasonCode,
    reason,
    billing_event_id: billingEvent?.id || null,
    billing_event_status:
      normalizeText(billingEvent?.event_status) || null,
  };
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

    if (!ALLOWED_ROLES.has(caller.role)) {
      return Response.json(
        {
          ok: false,
          error:
            "Only authorized CE organization users may preview cohort invoice registrations.",
        },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const cohortId = normalizeText(body?.cohort_id);

    if (!cohortId) {
      return Response.json(
        {
          ok: false,
          error: "cohort_id is required.",
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
          error: "The requested CE Training cohort was not found.",
        },
        { status: 404 }
      );
    }

    if (normalizeText(cohort.org_id) !== organizationId) {
      return Response.json(
        {
          ok: false,
          error:
            "The requested CE Training cohort belongs to a different organization.",
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
            "This Training cohort is inactive and cannot receive new invoice-billed CE registrations.",
        },
        { status: 409 }
      );
    }

    if (caller.role === "ce_instructor") {
      const membershipRows =
        await base44.asServiceRole.entities.CETrainingCohortMember.filter({
          cohort_id: cohortId,
          user_id: caller.id,
        });

      const callerIsCohortManager = (
        Array.isArray(membershipRows) ? membershipRows : []
      ).some(
        (membership) =>
          membership.cohort_role === "manager" &&
          isActive(membership)
      );

      if (!callerIsCohortManager) {
        return Response.json(
          {
            ok: false,
            error:
              "You must be an active manager of this Training cohort to preview its registration invoice.",
          },
          { status: 403 }
        );
      }
    }

    const [inviteRows, billingEventRows] = await Promise.all([
      base44.asServiceRole.entities.PendingRoleAssignment.filter({
        org_id: organizationId,
        role: "ce_student",
        cohort_id: cohortId,
      }),
      base44.asServiceRole.entities.OrganizationBillingEvent.filter({
        organization_id: organizationId,
      }),
    ]);

    const cohortInvites = (
      Array.isArray(inviteRows) ? inviteRows : []
    ).filter((invite) =>
      OPEN_INVITE_STATUSES.has(normalizeText(invite.status))
    );

    const invoiceBilledInvites = cohortInvites.filter(
      (invite) =>
        normalizeText(invite.payment_responsibility) ===
          "instructor_paid" &&
        normalizeText(invite.instructor_payment_mode) ===
          "invoice_with_cohort"
    );

    const registrationBillingEvents = (
      Array.isArray(billingEventRows) ? billingEventRows : []
    ).filter(
      (billingEvent) =>
        CE_REGISTRATION_FEE_KINDS.has(
          normalizeText(billingEvent?.fee_kind)
        ) &&
        billingEvent?.billing_subject_type === "student"
    );

    const billingEventsByKey = new Map<string, any[]>();

    for (const billingEvent of registrationBillingEvents) {
      const billingEventKey = normalizeText(
        billingEvent?.billing_event_key
      );

      if (!billingEventKey) {
        continue;
      }

      if (!billingEventsByKey.has(billingEventKey)) {
        billingEventsByKey.set(billingEventKey, []);
      }

      billingEventsByKey.get(billingEventKey)?.push(billingEvent);
    }

    const eligibleStudents: any[] = [];
    const blockedStudents: any[] = [];
    const totalsByCurrency = new Map<
      string,
      {
        currency: string;
        student_count: number;
        total_amount_cents: number;
      }
    >();

    for (const invite of invoiceBilledInvites) {
      const studentEmail = normalizeEmail(invite.email);

      if (!studentEmail) {
        blockedStudents.push(
          createBlockedRecord(
            invite,
            "missing_invited_email",
            "This CE student invitation is missing its invited email address."
          )
        );
        continue;
      }

      const billingEventKey = buildRegistrationBillingEventKey(
        organizationId,
        studentEmail
      );

      const matchingBillingEvents =
        billingEventsByKey.get(billingEventKey) || [];

      if (matchingBillingEvents.length === 0) {
        blockedStudents.push(
          createBlockedRecord(
            invite,
            "billing_event_missing",
            "This CE student invitation has no matching registration billing event."
          )
        );
        continue;
      }

      if (matchingBillingEvents.length > 1) {
        blockedStudents.push(
          createBlockedRecord(
            invite,
            "billing_event_conflict",
            "Multiple matching CE registration billing events exist for this student. Resolve the billing conflict before invoicing."
          )
        );
        continue;
      }

      const billingEvent = matchingBillingEvents[0];

      const billingIdentityMatches =
        normalizeText(billingEvent.organization_id) ===
          organizationId &&
        normalizeEmail(billingEvent.subject_verified_email) ===
          studentEmail &&
        CE_REGISTRATION_FEE_KINDS.has(
          normalizeText(billingEvent.fee_kind)
        ) &&
        billingEvent.billing_subject_type === "student" &&
        normalizeText(billingEvent.cohort_id) === cohortId;

      if (!billingIdentityMatches) {
        blockedStudents.push(
          createBlockedRecord(
            invite,
            "billing_event_identity_mismatch",
            "The CE registration billing event does not safely match this cohort invitation.",
            billingEvent
          )
        );
        continue;
      }

      const billingStatus = normalizeText(
        billingEvent.event_status
      );

      if (SETTLED_EVENT_STATUSES.has(billingStatus)) {
        blockedStudents.push(
          createBlockedRecord(
            invite,
            "registration_already_settled",
            "This CE registration is already settled and must not be billed again on a cohort invoice.",
            billingEvent
          )
        );
        continue;
      }

      if (
        !INVOICE_ELIGIBLE_EVENT_STATUSES.has(billingStatus)
      ) {
        blockedStudents.push(
          createBlockedRecord(
            invite,
            "billing_event_not_invoice_ready",
            `This CE registration billing event is currently "${billingStatus || "unknown"}" and is not eligible for a cohort invoice.`,
            billingEvent
          )
        );
        continue;
      }

      const amountCents = Number(billingEvent.amount_cents);
      const currency = normalizeText(
        billingEvent.currency || "USD"
      ).toUpperCase();

      if (!Number.isInteger(amountCents) || amountCents < 0) {
        blockedStudents.push(
          createBlockedRecord(
            invite,
            "invalid_locked_amount",
            "This CE registration billing event has an invalid locked amount.",
            billingEvent
          )
        );
        continue;
      }

      const total = totalsByCurrency.get(currency) || {
        currency,
        student_count: 0,
        total_amount_cents: 0,
      };

      total.student_count += 1;
      total.total_amount_cents += amountCents;

      totalsByCurrency.set(currency, total);

      eligibleStudents.push({
        pending_invite_id: invite.id,
        email: invite.email,
        billing_event_id: billingEvent.id,
        billing_event_key: billingEvent.billing_event_key,
        amount_cents: amountCents,
        currency,
        billing_event_status: billingStatus,
      });
    }

    return Response.json({
      ok: true,
      preview_only: true,
      access_changed: false,
      checkout_created: false,
      invoice_created: false,
      cohort: {
        id: cohort.id,
        name: cohort.name || "",
        code: cohort.code || "",
      },
      summary: {
        pending_cohort_invitation_count: cohortInvites.length,
        invoice_billed_invitation_count:
          invoiceBilledInvites.length,
        eligible_student_count: eligibleStudents.length,
        blocked_student_count: blockedStudents.length,
        totals_by_currency: Array.from(
          totalsByCurrency.values()
        ).sort((a, b) =>
          a.currency.localeCompare(b.currency)
        ),
      },
      eligible_students: eligibleStudents,
      blocked_students: blockedStudents,
    });
  } catch (error) {
    console.error(
      "getCETrainingCohortInvoicePreview error:",
      error?.message || error
    );

    return Response.json(
      {
        ok: false,
        error:
          error?.message ||
          "Unable to preview CE Training cohort invoice registrations.",
      },
      { status: 500 }
    );
  }
});
