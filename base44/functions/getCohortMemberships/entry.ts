import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

const OPEN_INVITE_STATUSES = new Set([
  "pending",
  "invite_email_sent",
  "pending_email_failed",
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

function isActive(record: any) {
  return record?.is_active !== false;
}

function buildRegistrationBillingEventKey(
  organizationId: string,
  email: string
) {
  return `ce_student_registration:${organizationId}:${encodeURIComponent(
    normalizeEmail(email)
  )}`;
}

function getRecordTimestamp(record: any) {
  return new Date(
    record?.invited_at ||
      record?.triggered_at ||
      record?.created_date ||
      record?.updated_date ||
      0
  ).getTime();
}

function getPendingEnrollmentBillingDetails(
  invite: any,
  organizationId: string,
  cohortId: string,
  billingEventsByKey: Map<string, any[]>
) {
  const email = normalizeEmail(invite.email);

  if (!email) {
    return {
      billing_event_id: null,
      billing_event_status: null,
      billing_event_amount_cents: null,
      billing_event_currency: null,
      billing_event_missing: true,
      billing_event_conflict: false,
      billing_event_cohort_matches: false,
      billing_issue:
        "The pending invitation is missing its invited email address.",
    };
  }

  const billingEventKey = buildRegistrationBillingEventKey(
    organizationId,
    email
  );

  const matchingBillingEvents =
    billingEventsByKey.get(billingEventKey) || [];

  if (matchingBillingEvents.length === 0) {
    return {
      billing_event_id: null,
      billing_event_status: null,
      billing_event_amount_cents: null,
      billing_event_currency: null,
      billing_event_missing: true,
      billing_event_conflict: false,
      billing_event_cohort_matches: false,
      billing_issue:
        "No matching CE registration billing event was found.",
    };
  }

  if (matchingBillingEvents.length > 1) {
    return {
      billing_event_id: null,
      billing_event_status: null,
      billing_event_amount_cents: null,
      billing_event_currency: null,
      billing_event_missing: false,
      billing_event_conflict: true,
      billing_event_cohort_matches: false,
      billing_issue:
        "Multiple matching CE registration billing events were found.",
    };
  }

  const billingEvent = matchingBillingEvents[0];

  const identityMatches =
    normalizeText(billingEvent.organization_id) === organizationId &&
    normalizeEmail(billingEvent.subject_verified_email) === email &&
    CE_REGISTRATION_FEE_KINDS.has(
      normalizeText(billingEvent.fee_kind)
    ) &&
    billingEvent.billing_subject_type === "student";

  const cohortMatches =
    normalizeText(billingEvent.cohort_id) === cohortId;

  return {
    billing_event_id: billingEvent.id || null,
    billing_event_status:
      normalizeText(billingEvent.event_status) || null,
    billing_event_amount_cents:
      typeof billingEvent.amount_cents === "number"
        ? billingEvent.amount_cents
        : null,
    billing_event_currency:
      normalizeText(billingEvent.currency) || null,
    billing_event_missing: false,
    billing_event_conflict: !identityMatches,
    billing_event_cohort_matches: cohortMatches,
    billing_issue: !identityMatches
      ? "The matching billing event does not safely match this CE enrollment."
      : !cohortMatches
        ? "The matching billing event is not linked to this Training cohort."
        : null,
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me();

    if (!caller) {
      return Response.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (
      !["admin", "management", "ce_instructor"].includes(
        caller.role
      )
    ) {
      return Response.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const cohortId = normalizeText(body?.cohort_id);

    if (!cohortId) {
      return Response.json(
        { error: "cohort_id is required" },
        { status: 400 }
      );
    }

    let organizationId = normalizeText(caller.org_id);

    if (!organizationId) {
      const organizations =
        await base44.asServiceRole.entities.Organization.filter({
          owner_email: caller.email,
        });

      organizationId = normalizeText(organizations?.[0]?.id);
    }

    const cohort =
      await base44.asServiceRole.entities.CETrainingCohort.get(
        cohortId
      );

    if (!cohort) {
      return Response.json(
        { error: "Cohort not found" },
        { status: 404 }
      );
    }

    if (
      organizationId &&
      cohort.org_id &&
      cohort.org_id !== organizationId
    ) {
      return Response.json(
        {
          error:
            "Cohort does not belong to caller organization",
        },
        { status: 403 }
      );
    }

    let authorized = ["admin", "management"].includes(
      caller.role
    );

    if (!authorized && caller.role === "ce_instructor") {
      const managerRows =
        await base44.asServiceRole.entities.CETrainingCohortMember.filter(
          {
            cohort_id: cohortId,
            user_id: caller.id,
            cohort_role: "manager",
            is_active: true,
          }
        );

      authorized =
        Array.isArray(managerRows) &&
        managerRows.length > 0;
    }

    if (!authorized) {
      return Response.json(
        {
          error:
            "Only cohort managers may view this cohort roster",
        },
        { status: 403 }
      );
    }

      const [
      allMemberships,
      pendingInviteRows,
      organizationBillingEvents,
      durableEnrollmentRows,
    ] = await Promise.all([
      base44.asServiceRole.entities.CETrainingCohortMember.filter({
        cohort_id: cohortId,
      }),
      base44.asServiceRole.entities.PendingRoleAssignment.filter({
        org_id: organizationId,
        role: "ce_student",
        cohort_id: cohortId,
      }),
      base44.asServiceRole.entities.OrganizationBillingEvent.filter({
        organization_id: organizationId,
      }),
      base44.asServiceRole.entities.CETrainingStudentEnrollment.filter({
        org_id: organizationId,
        cohort_id: cohortId,
      }),
    ]);

    const activeMemberships = (
      Array.isArray(allMemberships) ? allMemberships : []
    ).filter((membership) => membership.is_active !== false);

    const registrationBillingEvents = (
      Array.isArray(organizationBillingEvents)
        ? organizationBillingEvents
        : []
    ).filter(
      (event) =>
        CE_REGISTRATION_FEE_KINDS.has(
          normalizeText(event?.fee_kind)
        ) && event?.billing_subject_type === "student"
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

    const settledStudentUserIds = new Set(
      registrationBillingEvents
        .filter((event) => {
          const isSettled =
            event.event_status === "paid" ||
            event.event_status === "waived";

          return (
            isSettled &&
            normalizeText(event.cohort_id) === cohortId
          );
        })
        .map((event) =>
          normalizeText(event.subject_user_id)
        )
        .filter(Boolean)
    );

    const memberships = activeMemberships.map((membership) => ({
      ...membership,
      has_settled_registration:
        membership.cohort_role === "member" &&
        settledStudentUserIds.has(
          normalizeText(membership.user_id)
        ),
    }));

    const memberUserIds = new Set(
      memberships
        .map((membership) => membership.user_id)
        .filter(Boolean)
    );

    const allUsers =
      await base44.asServiceRole.entities.User.list();

    const users = (
      Array.isArray(allUsers) ? allUsers : []
    ).filter((candidate) => memberUserIds.has(candidate.id));

    const pendingEnrollments = (
      Array.isArray(pendingInviteRows) ? pendingInviteRows : []
    )
      .filter((invite) =>
        OPEN_INVITE_STATUSES.has(normalizeText(invite.status))
      )
      .map((invite) => ({
        id: invite.id,
        email: invite.email || "",
        invited_at: invite.invited_at || null,
        invited_by_name: invite.invited_by_name || "",
        invite_status: invite.status,
        payment_responsibility:
          invite.payment_responsibility || "student_paid",
        instructor_payment_mode:
          invite.payment_responsibility === "instructor_paid"
            ? invite.instructor_payment_mode || "pay_now"
            : null,
        cohort_id: cohortId,
        ...getPendingEnrollmentBillingDetails(
          invite,
          organizationId,
          cohortId,
          billingEventsByKey
        ),
      }))
      .sort(
        (a, b) =>
          getRecordTimestamp(b) - getRecordTimestamp(a)
      );

    return Response.json({
      ok: true,
      memberships,
      users,
      pending_enrollments: pendingEnrollments,
    });
  } catch (error) {
    console.error(
      "getCohortMemberships error:",
      error?.message || error
    );

    return Response.json(
      {
        error:
          error?.message ||
          "Unable to load cohort memberships.",
      },
      { status: 500 }
    );
  }
});
