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

const CE_STUDENT_REGISTRATION_FEE_KIND = "training_registration";

const CHECKOUT_ELIGIBLE_EVENT_STATUSES = new Set([
  "pending",
  "ready_for_checkout",
  "payment_processing",
  "failed",
]);

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function normalizeText(value: unknown) {
  return String(value || "").trim();
}

function isActive(record: any) {
  return record?.is_active !== false;
}

function getDisplayUser(user: any) {
  return {
    id: user.id,
    full_name: user.full_name || "",
    email: user.email || "",
  };
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
    record?.triggered_at ||
      record?.created_date ||
      record?.updated_date ||
      0
  ).getTime();
}

function getPendingInviteBillingDetails(
  invite: any,
  organizationId: string,
  billingEventsByKey: Map<string, any[]>
) {
  const expectedBillingEventKey = buildRegistrationBillingEventKey(
    organizationId,
    invite.email
  );

  const matchingEvents =
    billingEventsByKey.get(expectedBillingEventKey) || [];

  if (matchingEvents.length === 0) {
    return {
      billing_event_id: null,
      billing_event_status: null,
      billing_event_amount_cents: null,
      billing_event_currency: null,
      billing_event_triggered_at: null,
      billing_event_missing: true,
      billing_event_conflict: false,
      checkout_available: false,
    };
  }

  if (matchingEvents.length > 1) {
    return {
      billing_event_id: null,
      billing_event_status: null,
      billing_event_amount_cents: null,
      billing_event_currency: null,
      billing_event_triggered_at: null,
      billing_event_missing: false,
      billing_event_conflict: true,
      checkout_available: false,
    };
  }

  const billingEvent = matchingEvents[0];

  const paymentResponsibility =
    invite.payment_responsibility || "student_paid";

  const instructorPaymentMode =
    paymentResponsibility === "instructor_paid"
      ? invite.instructor_payment_mode || "pay_now"
      : null;

  const requiresFutureInvoice =
    paymentResponsibility === "instructor_paid" &&
    instructorPaymentMode === "invoice_with_cohort";

  const checkoutAvailable =
    !requiresFutureInvoice &&
    CHECKOUT_ELIGIBLE_EVENT_STATUSES.has(
      billingEvent.event_status
    );

  return {
    billing_event_id: billingEvent.id || null,
    billing_event_status: billingEvent.event_status || null,
    billing_event_amount_cents:
      typeof billingEvent.amount_cents === "number"
        ? billingEvent.amount_cents
        : null,
    billing_event_currency: billingEvent.currency || null,
    billing_event_triggered_at:
      billingEvent.triggered_at || null,
    billing_event_missing: false,
    billing_event_conflict: false,
    checkout_available: checkoutAvailable,
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
            "Only authorized CE organization users may view CE students.",
        },
        { status: 403 }
      );
    }

    let orgId = normalizeText(caller.org_id);

    if (!orgId) {
      const organizations =
        await base44.asServiceRole.entities.Organization.filter({
          owner_email: caller.email,
        });

      orgId = normalizeText(organizations?.[0]?.id);
    }

    if (!orgId) {
      return Response.json(
        {
          ok: false,
          error:
            "Your account is not connected to an organization.",
        },
        { status: 400 }
      );
    }

    const [
      orgUsers,
      ceInviteRows,
      orgCohorts,
      organizationBillingEventRows,
    ] = await Promise.all([
      base44.asServiceRole.entities.User.filter({
        org_id: orgId,
      }),
      base44.asServiceRole.entities.PendingRoleAssignment.filter({
        org_id: orgId,
        role: "ce_student",
      }),
      base44.asServiceRole.entities.CETrainingCohort.filter({
        org_id: orgId,
      }),
      base44.asServiceRole.entities.OrganizationBillingEvent.filter({
        organization_id: orgId,
      }),
    ]);

    const users = Array.isArray(orgUsers) ? orgUsers : [];
    const invites = Array.isArray(ceInviteRows) ? ceInviteRows : [];
    const cohorts = Array.isArray(orgCohorts) ? orgCohorts : [];
    const organizationBillingEvents = Array.isArray(
      organizationBillingEventRows
    )
      ? organizationBillingEventRows
      : [];

    const registrationBillingEvents =
      organizationBillingEvents.filter(
        (billingEvent) =>
          billingEvent?.fee_kind ===
            CE_STUDENT_REGISTRATION_FEE_KIND &&
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

    for (const billingEvents of billingEventsByKey.values()) {
      billingEvents.sort(
        (a, b) => getRecordTimestamp(b) - getRecordTimestamp(a)
      );
    }

    const cohortById = new Map(
      cohorts
        .filter(Boolean)
        .map((cohort) => [cohort.id, cohort])
    );

    const membershipsByCohort = await Promise.all(
      cohorts.map(async (cohort) => {
        const rows =
          await base44.asServiceRole.entities.CETrainingCohortMember.filter({
            cohort_id: cohort.id,
          });

        return Array.isArray(rows) ? rows : [];
      })
    );

    const allOrgCohortMemberships = membershipsByCohort.flat();

    const invitedEmails = new Set(
      invites
        .map((invite) => normalizeEmail(invite.email))
        .filter(Boolean)
    );

    const registeredStudents = users
      .filter(isActive)
      .filter((user) => user.role === "ce_student")
      .filter((user) => invitedEmails.has(normalizeEmail(user.email)));

    const managedCohortIds = new Set(
      allOrgCohortMemberships
        .filter(
          (membership) =>
            membership.user_id === caller.id &&
            membership.cohort_role === "manager" &&
            isActive(membership) &&
            cohortById.has(membership.cohort_id)
        )
        .map((membership) => membership.cohort_id)
    );

    const managedCohorts = cohorts.filter((cohort) =>
      managedCohortIds.has(cohort.id)
    );

    const cohortsByStudentId: Record<string, any[]> = {};

    for (const membership of allOrgCohortMemberships) {
      if (
        membership.cohort_role !== "member" ||
        !isActive(membership) ||
        !managedCohortIds.has(membership.cohort_id) ||
        !membership.user_id
      ) {
        continue;
      }

      const cohort = cohortById.get(membership.cohort_id);

      if (!cohort) {
        continue;
      }

      if (!cohortsByStudentId[membership.user_id]) {
        cohortsByStudentId[membership.user_id] = [];
      }

      cohortsByStudentId[membership.user_id].push(cohort);
    }

    const active = registeredStudents.map((student) => ({
      id: student.id,
      email: student.email,
      user: getDisplayUser(student),
      cohorts: cohortsByStudentId[student.id] || [],
      status: "active",
    }));

    const pending = invites
      .filter((invite) => OPEN_INVITE_STATUSES.has(invite.status))
      .map((invite) => {
        const paymentResponsibility =
          invite.payment_responsibility || "student_paid";

        const instructorPaymentMode =
          paymentResponsibility === "instructor_paid"
            ? invite.instructor_payment_mode || "pay_now"
            : null;

        return {
          id: invite.id,
          email: invite.email,
          user: null,
          cohorts: [],
          status: "pending",
          payment_responsibility: paymentResponsibility,
          instructor_payment_mode: instructorPaymentMode,
          ...getPendingInviteBillingDetails(
            invite,
            orgId,
            billingEventsByKey
          ),
        };
      });

    return Response.json({
      ok: true,
      organization_id: orgId,
      cohorts: managedCohorts,
      active,
      pending,
    });
  } catch (error) {
    console.error(
      "getCEInstructorStudents error:",
      error?.message || error
    );

    return Response.json(
      {
        ok: false,
        error:
          error?.message ||
          "Unable to load CE students for this organization.",
      },
      { status: 500 }
    );
  }
});
