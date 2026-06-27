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

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
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

    let orgId = String(caller.org_id || "").trim();

    if (!orgId) {
      const organizations =
        await base44.asServiceRole.entities.Organization.filter({
          owner_email: caller.email,
        });

      orgId = String(organizations?.[0]?.id || "").trim();
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

    const [orgUsers, ceInviteRows, orgCohorts] = await Promise.all([
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
    ]);

    const users = Array.isArray(orgUsers) ? orgUsers : [];
    const invites = Array.isArray(ceInviteRows) ? ceInviteRows : [];
    const cohorts = Array.isArray(orgCohorts) ? orgCohorts : [];

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
  .map((invite) => ({
    id: invite.id,
    email: invite.email,
    user: null,
    cohorts: [],
    status: "pending",
    payment_responsibility:
      invite.payment_responsibility || "student_paid",
    instructor_payment_mode:
      invite.payment_responsibility === "instructor_paid"
        ? invite.instructor_payment_mode || "pay_now"
        : null,
  }));

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
