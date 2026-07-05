import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

const CANONICAL_ACCESS_BY_ROLE: Record<string, string> = {
  admin: "admin",
  management: "staff",
  ce_instructor: "ce_training_portal",
};

const OPEN_INVITE_STATUSES = new Set([
  "pending",
  "invite_email_sent",
  "pending_email_failed",
]);

const INVOICE_ELIGIBLE_EVENT_STATUSES = new Set(["pending"]);
const SETTLED_EVENT_STATUSES = new Set(["paid", "waived"]);
const CE_REGISTRATION_FEE_KINDS = new Set([
  "training_registration",
  "training_reactivation",
]);

class RequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value: unknown) {
  return normalizeText(value).toLowerCase();
}

function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function isActive(record: any) {
  return record?.is_active !== false && record?.is_archived !== true;
}

function getCanonicalRole(user: any) {
  const role = normalizeText(user?.role).toLowerCase();
  const accessLevel = normalizeText(user?.access_level).toLowerCase();

  return CANONICAL_ACCESS_BY_ROLE[role] === accessLevel ? role : "";
}

function buildRegistrationBillingEventKey(
  organizationId: string,
  email: string
) {
  return `ce_student_registration:${organizationId}:${encodeURIComponent(
    normalizeEmail(email)
  )}`;
}

function createBlockedRecord(
  invite: any,
  reasonCode: string,
  reason: string,
  billingEvent: any = null
) {
  return {
    pending_invite_id: normalizeText(invite?.id),
    email: normalizeEmail(invite?.email),
    reason_code: reasonCode,
    reason,
    billing_event_id: normalizeText(billingEvent?.id) || null,
    billing_event_status:
      normalizeText(billingEvent?.event_status) || null,
  };
}

async function resolveCanonicalCaller(
  base44: any,
  authenticatedUserId: string
) {
  const caller = await base44.asServiceRole.entities.User.get(
    authenticatedUserId
  ).catch(() => null);

  if (!caller || !isActive(caller)) {
    throw new RequestError(403, "Your account is inactive or unavailable.");
  }

  const callerId = normalizeText(caller?.id);
  const organizationId = normalizeText(caller?.org_id);
  const callerRole = getCanonicalRole(caller);

  if (!callerId || !organizationId || !callerRole) {
    throw new RequestError(
      403,
      "You are not authorized to preview cohort invoice registrations."
    );
  }

  const organization = await base44.asServiceRole.entities.Organization.get(
    organizationId
  ).catch(() => null);

  if (!organization || !isActive(organization)) {
    throw new RequestError(403, "Your organization is inactive or unavailable.");
  }

  return {
    caller,
    callerId,
    callerRole,
    organizationId,
  };
}

async function resolveAuthorizedTrainingCohort(
  base44: any,
  context: any,
  cohortId: string
) {
  const cohort = await base44.asServiceRole.entities.CETrainingCohort.get(
    cohortId
  ).catch(() => null);

  if (
    !cohort ||
    !isActive(cohort) ||
    normalizeText(cohort?.org_id) !== context.organizationId ||
    normalizeText(cohort?.cohort_type).toLowerCase() !== "training" ||
    normalizeText(cohort?.status).toLowerCase() === "archived"
  ) {
    throw new RequestError(404, "The selected Training cohort is unavailable.");
  }

  if (["admin", "management"].includes(context.callerRole)) {
    return cohort;
  }

  const membershipRows =
    await base44.asServiceRole.entities.CETrainingCohortMember.filter({
      org_id: context.organizationId,
      cohort_id: cohortId,
      user_id: context.callerId,
      cohort_role: "manager",
      is_active: true,
    });

  const isActiveManager = asArray(membershipRows).some(
    (membership: any) =>
      isActive(membership) &&
      normalizeText(membership?.org_id) === context.organizationId &&
      normalizeText(membership?.cohort_id) === cohortId &&
      normalizeText(membership?.user_id) === context.callerId &&
      normalizeText(membership?.cohort_role).toLowerCase() === "manager"
  );

  if (!isActiveManager) {
    throw new RequestError(
      403,
      "You must be an active manager of this Training cohort to preview its registration invoice."
    );
  }

  return cohort;
}

function isOpenInvoiceBilledInvite(
  invite: any,
  organizationId: string,
  cohortId: string
) {
  return (
    isActive(invite) &&
    normalizeText(invite?.org_id) === organizationId &&
    normalizeText(invite?.cohort_id) === cohortId &&
    normalizeText(invite?.role).toLowerCase() === "ce_student" &&
    normalizeText(invite?.access_level).toLowerCase() ===
      "ce_training_portal" &&
    OPEN_INVITE_STATUSES.has(normalizeText(invite?.status).toLowerCase()) &&
    normalizeText(invite?.payment_responsibility).toLowerCase() ===
      "instructor_paid" &&
    normalizeText(invite?.instructor_payment_mode).toLowerCase() ===
      "invoice_with_cohort"
  );
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json(
        {
          ok: false,
          error: "This cohort invoice-preview request must use POST.",
        },
        { status: 405 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const cohortId = normalizeText(body?.cohort_id);

    if (!cohortId) {
      throw new RequestError(400, "A Training cohort must be selected.");
    }

    const base44 = createClientFromRequest(req);
    const authenticatedUser = await base44.auth.me().catch(() => null);

    if (!authenticatedUser?.id) {
      throw new RequestError(
        401,
        "Please sign in before previewing cohort invoice registrations."
      );
    }

    const context = await resolveCanonicalCaller(base44, authenticatedUser.id);
    const cohort = await resolveAuthorizedTrainingCohort(
      base44,
      context,
      cohortId
    );

    const [inviteRows, billingEventRows] = await Promise.all([
      base44.asServiceRole.entities.PendingRoleAssignment.filter({
        org_id: context.organizationId,
        role: "ce_student",
        cohort_id: cohortId,
      }),
      base44.asServiceRole.entities.OrganizationBillingEvent.filter({
        organization_id: context.organizationId,
        cohort_id: cohortId,
      }),
    ]);

    const invoiceBilledInvites = asArray(inviteRows).filter((invite: any) =>
      isOpenInvoiceBilledInvite(invite, context.organizationId, cohortId)
    );

    const billingEventsByKey = new Map<string, any[]>();
    for (const billingEvent of asArray(billingEventRows)) {
      const billingEventKey = normalizeText(billingEvent?.billing_event_key);

      if (
        !billingEventKey ||
        normalizeText(billingEvent?.organization_id) !==
          context.organizationId ||
        normalizeText(billingEvent?.cohort_id) !== cohortId ||
        normalizeText(billingEvent?.billing_subject_type).toLowerCase() !==
          "student" ||
        !CE_REGISTRATION_FEE_KINDS.has(
          normalizeText(billingEvent?.fee_kind).toLowerCase()
        )
      ) {
        continue;
      }

      const matchingEvents = billingEventsByKey.get(billingEventKey) || [];
      matchingEvents.push(billingEvent);
      billingEventsByKey.set(billingEventKey, matchingEvents);
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
      const studentEmail = normalizeEmail(invite?.email);

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
        context.organizationId,
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
        normalizeText(billingEvent?.organization_id) ===
          context.organizationId &&
        normalizeText(billingEvent?.cohort_id) === cohortId &&
        normalizeEmail(billingEvent?.subject_verified_email) === studentEmail &&
        normalizeText(billingEvent?.billing_subject_type).toLowerCase() ===
          "student" &&
        CE_REGISTRATION_FEE_KINDS.has(
          normalizeText(billingEvent?.fee_kind).toLowerCase()
        );

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
        billingEvent?.event_status
      ).toLowerCase();

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

      if (!INVOICE_ELIGIBLE_EVENT_STATUSES.has(billingStatus)) {
        blockedStudents.push(
          createBlockedRecord(
            invite,
            "billing_event_not_invoice_ready",
            `This CE registration billing event is currently "${
              billingStatus || "unknown"
            }" and is not eligible for a cohort invoice.`,
            billingEvent
          )
        );
        continue;
      }

      const amountCents = Number(billingEvent?.amount_cents);
      const currency = normalizeText(
        billingEvent?.currency || "USD"
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
        pending_invite_id: normalizeText(invite?.id),
        email: studentEmail,
        billing_event_id: normalizeText(billingEvent?.id),
        billing_event_key: normalizeText(billingEvent?.billing_event_key),
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
        id: normalizeText(cohort?.id),
        name: normalizeText(cohort?.name),
        code: normalizeText(cohort?.code),
      },
      summary: {
        pending_cohort_invitation_count: invoiceBilledInvites.length,
        invoice_billed_invitation_count: invoiceBilledInvites.length,
        eligible_student_count: eligibleStudents.length,
        blocked_student_count: blockedStudents.length,
        totals_by_currency: Array.from(totalsByCurrency.values()).sort(
          (left, right) => left.currency.localeCompare(right.currency)
        ),
      },
      eligible_students: eligibleStudents,
      blocked_students: blockedStudents,
    });
  } catch (error: any) {
    if (!(error instanceof RequestError)) {
      console.error(
        "getCETrainingCohortInvoicePreview error:",
        error?.message || error
      );
    }

    return Response.json(
      {
        ok: false,
        error:
          error instanceof RequestError
            ? error.message
            : "Unable to preview CE Training cohort invoice registrations.",
      },
      { status: error instanceof RequestError ? error.status : 500 }
    );
  }
});
