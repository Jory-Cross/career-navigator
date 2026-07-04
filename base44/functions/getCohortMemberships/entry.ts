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

const ROLE_ACCESS_LEVELS: Record<string, string> = {
  admin: "admin",
  management: "staff",
  ce_instructor: "ce_training_portal",
};

class RequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isActive(record: any) {
  return Boolean(
    record &&
      record?.is_active !== false &&
      record?.is_archived !== true
  );
}

function getCanonicalRoleProfile(user: any) {
  const role = normalizeText(user?.role).toLowerCase();
  const accessLevel = normalizeText(
    user?.access_level
  ).toLowerCase();

  if (ROLE_ACCESS_LEVELS[role] !== accessLevel) {
    return null;
  }

  return {
    role,
    access_level: accessLevel,
  };
}

async function resolveCanonicalCaller(
  base44: any,
  authenticatedUserId: string
) {
  const caller = await base44.asServiceRole.entities.User.get(
    authenticatedUserId
  ).catch(() => null);

  const callerId = normalizeText(caller?.id);
  const callerEmail = normalizeEmail(caller?.email);
  const organizationId = normalizeText(caller?.org_id);
  const roleProfile = getCanonicalRoleProfile(caller);

  if (
    !caller ||
    !isActive(caller) ||
    !callerId ||
    !isValidEmail(callerEmail)
  ) {
    throw new RequestError(
      403,
      "Your account is unavailable or does not have a verified email address."
    );
  }

  if (!organizationId) {
    throw new RequestError(
      403,
      "Your account is not assigned to an organization."
    );
  }

  if (!roleProfile) {
    throw new RequestError(
      403,
      "Your current role does not allow CE cohort roster access."
    );
  }

  const organization =
    await base44.asServiceRole.entities.Organization.get(
      organizationId
    ).catch(() => null);

  if (!organization || !isActive(organization)) {
    throw new RequestError(
      403,
      "Your organization assignment is unavailable or inactive."
    );
  }

  return {
    caller,
    callerId,
    organizationId,
    roleProfile,
  };
}

async function requireCohortAccess(
  base44: any,
  callerId: string,
  organizationId: string,
  roleProfile: {
    role: string;
    access_level: string;
  },
  cohort: any,
  cohortId: string
) {
  if (
    !cohort ||
    normalizeText(cohort?.org_id) !== organizationId ||
    !isActive(cohort) ||
    normalizeText(cohort?.status).toLowerCase() === "archived"
  ) {
    throw new RequestError(
      403,
      "The selected cohort is unavailable."
    );
  }

  if (
    roleProfile.role === "admin" ||
    roleProfile.role === "management"
  ) {
    return;
  }

  const instructorMemberships =
    await base44.asServiceRole.entities.CETrainingCohortMember.filter(
      {
        org_id: organizationId,
        cohort_id: cohortId,
        user_id: callerId,
        is_active: true,
      }
    );

  const isAuthorizedInstructor = asArray(
    instructorMemberships
  ).some(
    (membership: any) =>
      normalizeText(membership?.org_id) === organizationId &&
      normalizeText(membership?.cohort_id) === cohortId &&
      normalizeText(membership?.user_id) === callerId &&
      ["manager", "trainer"].includes(
        normalizeText(membership?.cohort_role).toLowerCase()
      ) &&
      isActive(membership)
  );

  if (!isAuthorizedInstructor) {
    throw new RequestError(
      403,
      "Only an active cohort manager or trainer may view this cohort roster."
    );
  }
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
    if (req.method !== "POST") {
      return Response.json(
        {
          ok: false,
          error:
            "This CE cohort-roster request must use POST.",
        },
        { status: 405 }
      );
    }

    const startedAt = performance.now();
    const timing: Record<string, number> = {};

    const mark = (stage: string) => {
      timing[stage] = Math.round(performance.now() - startedAt);
    };

    const base44 = createClientFromRequest(req);
    const authenticatedCaller = await base44.auth.me().catch(
      () => null
    );

    mark("auth_complete");

    if (!authenticatedCaller?.id) {
      throw new RequestError(
        401,
        "Please sign in before viewing a CE cohort roster."
      );
    }

    const body = await req.json().catch(() => ({}));
    const cohortId = normalizeText(body?.cohort_id);

    if (!cohortId) {
      throw new RequestError(
        400,
        "A cohort must be selected."
      );
    }

    const {
      caller,
      callerId,
      organizationId,
      roleProfile,
    } = await resolveCanonicalCaller(
      base44,
      authenticatedCaller.id
    );

    const cohort =
      await base44.asServiceRole.entities.CETrainingCohort.get(
        cohortId
      ).catch(() => null);

    await requireCohortAccess(
      base44,
      callerId,
      organizationId,
      roleProfile,
      cohort,
      cohortId
    );

    mark("organization_and_cohort_resolved");
    mark("cohort_access_verified");
    const [
      allMemberships,
      pendingInviteRows,
      organizationBillingEvents,
      durableEnrollmentRows,
      organizationUserRows,
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
        cohort_id: cohortId,
      }),
      base44.asServiceRole.entities.CETrainingStudentEnrollment.filter({
        org_id: organizationId,
        cohort_id: cohortId,
      }),
      base44.asServiceRole.entities.User.filter({
        org_id: organizationId,
      }),
    ]);

    mark("roster_source_reads_complete");
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

    const billingEventsById = new Map(
      registrationBillingEvents
        .filter((billingEvent) =>
          Boolean(normalizeText(billingEvent?.id))
        )
        .map((billingEvent) => [
          billingEvent.id,
          billingEvent,
        ])
    );

    const cohortInvites = Array.isArray(pendingInviteRows)
      ? pendingInviteRows
      : [];

    const invitesById = new Map(
      cohortInvites
        .filter((invite) => Boolean(normalizeText(invite?.id)))
        .map((invite) => [invite.id, invite])
    );

    const durableEnrollments = (
      Array.isArray(durableEnrollmentRows)
        ? durableEnrollmentRows
        : []
    )
      .filter(
        (enrollment) =>
          normalizeText(enrollment?.org_id) === organizationId &&
          normalizeText(enrollment?.cohort_id) === cohortId &&
          Boolean(normalizeEmail(enrollment?.student_email))
      )
      .sort(
        (a, b) =>
          getRecordTimestamp(b) - getRecordTimestamp(a)
      );

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

    const studentMemberships = memberships.filter(
      (membership) => membership.cohort_role === "member"
    );

    const studentMembershipById = new Map(
      studentMemberships.map((membership) => [
        membership.id,
        membership,
      ])
    );

    const studentMembershipByUserId = new Map(
      studentMemberships
        .filter((membership) =>
          Boolean(normalizeText(membership.user_id))
        )
        .map((membership) => [
          membership.user_id,
          membership,
        ])
    );

    const rosterUserIds = new Set(
      [
        ...memberships.map(
          (membership) => membership.user_id
        ),
        ...durableEnrollments.map(
          (enrollment) => enrollment.user_id
        ),
      ].filter(Boolean)
    );

         const rosterUserIdsToLoad = Array.from(rosterUserIds);

    const organizationUsers = (
      Array.isArray(organizationUserRows)
        ? organizationUserRows
        : []
    ).filter((candidate) =>
      rosterUserIds.has(candidate?.id)
    );

    const organizationUsersById = new Map(
      organizationUsers.map((candidate) => [
        candidate.id,
        candidate,
      ])
    );

    const missingUserIds = rosterUserIdsToLoad.filter(
      (userId) => !organizationUsersById.has(userId)
    );

    const fallbackUserRows = await Promise.all(
      missingUserIds.map(async (userId) => {
        const userRows =
          await base44.asServiceRole.entities.User.filter({
            id: userId,
          });

        return Array.isArray(userRows)
          ? userRows[0] || null
          : null;
      })
    );

    const users = [
      ...organizationUsers,
      ...fallbackUserRows.filter(Boolean),
    ];

    const usersById = new Map(
      users.map((candidate) => [candidate.id, candidate])
    );

    mark("user_profiles_loaded");
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

        const coveredStudentEmails = new Set<string>();
    const coveredStudentUserIds = new Set<string>();
    const studentRoster: any[] = [];

    for (const enrollment of durableEnrollments) {
      const studentEmail = normalizeEmail(enrollment.student_email);
      const userId = normalizeText(enrollment.user_id);
      const membershipId = normalizeText(
        enrollment.cohort_member_id
      );

      const membership =
        studentMembershipById.get(membershipId) ||
        studentMembershipByUserId.get(userId) ||
        null;

      const billingEvent =
        billingEventsById.get(
          normalizeText(
            enrollment.organization_billing_event_id
          )
        ) || null;

      const linkedInvite =
        invitesById.get(
          normalizeText(enrollment.pending_role_assignment_id)
        ) ||
        cohortInvites.find(
          (invite) =>
            normalizeEmail(invite?.email) === studentEmail
        ) ||
        null;

      const studentUser = userId
        ? usersById.get(userId) || null
        : null;

      const paymentStatus = normalizeText(
        billingEvent?.event_status
      );

      const enrollmentStatus =
        normalizeText(enrollment.enrollment_status) ||
        (membership
          ? membership.training_status === "completed"
            ? "training_completed"
            : "active"
          : ["paid", "waived"].includes(paymentStatus)
            ? "payment_settled_registration_pending"
            : "payment_pending");

      studentRoster.push({
        id: enrollment.id,
        enrollment_id: enrollment.id,
        detail_available: true,
        is_legacy: false,
        student_email: studentEmail,
        display_name:
          normalizeText(studentUser?.full_name) ||
          studentEmail ||
          "Unnamed CE student",
        user_id: userId || null,
        cohort_member_id: membership?.id || null,
        pending_role_assignment_id:
          normalizeText(
            enrollment.pending_role_assignment_id
          ) || null,
        billing_event_id:
          normalizeText(
            enrollment.organization_billing_event_id
          ) || null,
        payment_responsibility:
          normalizeText(enrollment.payment_responsibility) ||
          normalizeText(linkedInvite?.payment_responsibility) ||
          "student_paid",
        instructor_payment_mode:
          normalizeText(enrollment.instructor_payment_mode) ||
          normalizeText(
            linkedInvite?.instructor_payment_mode
          ) ||
          null,
        enrollment_status: enrollmentStatus,
        payment_status: paymentStatus || null,
        payment_settled_at:
          enrollment.payment_settled_at ||
          billingEvent?.paid_at ||
          billingEvent?.waived_at ||
          null,
        registered_at: enrollment.registered_at || null,
        training_status:
          membership?.training_status || null,
        training_completed_at:
          membership?.training_completed_at ||
          enrollment.training_completed_at ||
          null,
      });

      if (studentEmail) {
        coveredStudentEmails.add(studentEmail);
      }

      if (userId) {
        coveredStudentUserIds.add(userId);
      }
    }

    for (const membership of studentMemberships) {
      const userId = normalizeText(membership.user_id);

      if (!userId || coveredStudentUserIds.has(userId)) {
        continue;
      }

      const studentUser = usersById.get(userId) || null;
      const studentEmail = normalizeEmail(studentUser?.email);

      const billingEvent = registrationBillingEvents
        .filter(
          (event) =>
            normalizeText(event?.cohort_id) === cohortId &&
            normalizeText(event?.subject_user_id) === userId
        )
        .sort(
          (a, b) =>
            getRecordTimestamp(b) - getRecordTimestamp(a)
        )[0];

      studentRoster.push({
        id: `legacy-membership:${membership.id}`,
        enrollment_id: null,
        detail_available: false,
        is_legacy: true,
        student_email: studentEmail,
        display_name:
          normalizeText(studentUser?.full_name) ||
          studentEmail ||
          "Legacy CE student",
        user_id: userId,
        cohort_member_id: membership.id,
        pending_role_assignment_id: null,
        billing_event_id: billingEvent?.id || null,
        payment_responsibility: null,
        instructor_payment_mode: null,
        enrollment_status:
          membership.training_status === "completed"
            ? "training_completed"
            : "active",
        payment_status:
          normalizeText(billingEvent?.event_status) || null,
        payment_settled_at:
          billingEvent?.paid_at ||
          billingEvent?.waived_at ||
          null,
        registered_at: membership.joined_at || null,
        training_status:
          membership.training_status || "in_training",
        training_completed_at:
          membership.training_completed_at || null,
      });

      if (studentEmail) {
        coveredStudentEmails.add(studentEmail);
      }

      coveredStudentUserIds.add(userId);
    }

    for (const pendingEnrollment of pendingEnrollments) {
      const studentEmail = normalizeEmail(
        pendingEnrollment.email
      );

      if (!studentEmail || coveredStudentEmails.has(studentEmail)) {
        continue;
      }

      const paymentStatus = normalizeText(
        pendingEnrollment.billing_event_status
      );

      studentRoster.push({
        id: `legacy-invite:${pendingEnrollment.id}`,
        enrollment_id: null,
        detail_available: false,
        is_legacy: true,
        student_email: studentEmail,
        display_name: studentEmail,
        user_id: null,
        cohort_member_id: null,
        pending_role_assignment_id: pendingEnrollment.id,
        billing_event_id:
          pendingEnrollment.billing_event_id || null,
        payment_responsibility:
          pendingEnrollment.payment_responsibility ||
          "student_paid",
        instructor_payment_mode:
          pendingEnrollment.instructor_payment_mode || null,
        enrollment_status: ["paid", "waived"].includes(
          paymentStatus
        )
          ? "payment_settled_registration_pending"
          : "payment_pending",
        payment_status: paymentStatus || null,
        payment_settled_at: null,
        registered_at: null,
        training_status: null,
        training_completed_at: null,
      });

      coveredStudentEmails.add(studentEmail);
    }

    studentRoster.sort((a, b) =>
      String(a.display_name || a.student_email).localeCompare(
        String(b.display_name || b.student_email)
      )
    );

     mark("response_ready");

    return Response.json({
      ok: true,
      memberships,
      users,
      pending_enrollments: pendingEnrollments,
      student_roster: studentRoster,
      debug_timing_ms: {
        ...timing,
        total: Math.round(performance.now() - startedAt),
      },
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
