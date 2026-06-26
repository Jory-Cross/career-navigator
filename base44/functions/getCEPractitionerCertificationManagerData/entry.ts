import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

const ALLOWED_PLATFORM_ROLES = new Set(["platform_owner"]);

const PAID_TRAINING_FEE_KINDS = new Set([
  "training_registration",
  "training_reactivation",
]);

const TRAINING_COHORT_TYPE = "training";
const STUDENT_COHORT_ROLE = "member";

const PIPELINE_STATUS_ORDER: Record<string, number> = {
  in_training: 1,
  pending_certification: 2,
  certified: 3,
  revoked: 4,
};

function getDisplayName(user: any) {
  const fullName = String(user?.full_name || "").trim();
  const email = String(user?.email || "").trim();

  return fullName || email || "Unnamed user";
}

function normalizeUser(user: any) {
  return {
    id: user.id,
    full_name: String(user.full_name || "").trim(),
    email: String(user.email || "").trim(),
    display_name: getDisplayName(user),
    role: user.role || null,
    access_level: user.access_level || null,
    is_active: user.is_active !== false,
  };
}

function normalizeTrainingStatus(member: any) {
  const status = String(member?.training_status || "").trim();

  if (
    status === "in_training" ||
    status === "completed" ||
    status === "withdrawn"
  ) {
    return status;
  }

  return "in_training";
}

function getEnrollmentKey(userId: unknown, cohortId: unknown) {
  return `${String(userId || "").trim()}::${String(cohortId || "").trim()}`;
}

function sortNewestFirst(left: any, right: any) {
  const leftDate = String(
    left?.training_completed_at || left?.joined_at || ""
  );
  const rightDate = String(
    right?.training_completed_at || right?.joined_at || ""
  );

  return rightDate.localeCompare(leftDate);
}

function getPipelineStatus(certification: any, enrollment: any) {
  if (certification?.certification_status === "verified") {
    return "certified";
  }

  if (certification?.certification_status === "revoked") {
    return "revoked";
  }

  if (certification?.certification_status === "pending_verification") {
    return "pending_certification";
  }

  if (enrollment?.training_status === "completed") {
    return "pending_certification";
  }

  return "in_training";
}

function getPipelineStatusLabel(status: string) {
  const labels: Record<string, string> = {
    in_training: "In Training",
    pending_certification: "Pending Certification",
    certified: "Certified",
    revoked: "Revoked",
  };

  return labels[status] || "Unknown";
}

function normalizeCertification(record: any, userById: Map<string, any>) {
  const practitioner = userById.get(record.user_id);

  return {
    id: record.id,
    user_id: record.user_id,
    practitioner_name: practitioner?.display_name || "Unknown student",
    practitioner_email: practitioner?.email || "",
    practitioner_is_active:
      practitioner?.is_active === false ? false : practitioner ? true : null,
    certification_status: record.certification_status,
    completed_at: record.completed_at || null,
    verified_at: record.verified_at || null,
    verified_by_user_id: record.verified_by_user_id || null,
    revoked_at: record.revoked_at || null,
    revoked_by_user_id: record.revoked_by_user_id || null,
    certification_source: record.certification_source,
    source_cohort_id: record.source_cohort_id || null,
    notes: record.notes || "",
  };
}

function choosePrimaryEnrollment(enrollments: any[], certification: any) {
  const sourceCohortId = String(
    certification?.source_cohort_id || ""
  ).trim();

  if (sourceCohortId) {
    const sourceEnrollment = enrollments.find(
      (enrollment) => enrollment.cohort_id === sourceCohortId
    );

    if (sourceEnrollment) {
      return sourceEnrollment;
    }
  }

  const activeCompleted = enrollments
    .filter(
      (enrollment) =>
        enrollment.membership_is_active &&
        enrollment.training_status === "completed"
    )
    .sort(sortNewestFirst);

  if (activeCompleted[0]) {
    return activeCompleted[0];
  }

  const activeInTraining = enrollments
    .filter(
      (enrollment) =>
        enrollment.membership_is_active &&
        enrollment.training_status === "in_training"
    )
    .sort(sortNewestFirst);

  if (activeInTraining[0]) {
    return activeInTraining[0];
  }

  return [...enrollments].sort(sortNewestFirst)[0] || null;
}

/**
 * getCEPractitionerCertificationManagerData
 *
 * Read-only Platform Owner source for the CE Practitioner
 * Certification Manager.
 *
 * Inclusion rule:
 * - A person must be a CETrainingCohortMember with cohort_role="member"
 * - Their cohort must be cohort_type="training"
 * - Their registration or reactivation billing event must be paid
 * - Certified and revoked students remain visible as historical records
 *
 * Pipeline labels:
 * - In Training
 * - Pending Certification
 * - Certified
 * - Revoked
 *
 * Certification alone never grants CE Practitioner Workspace access.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const platformAdminRows =
      await base44.asServiceRole.entities.PlatformAdmin.filter({
        user_id: user.id,
        is_active: true,
      });

    const platformRoles = Array.from(
      new Set(
        (Array.isArray(platformAdminRows) ? platformAdminRows : [])
          .filter((row) => row?.is_active !== false)
          .map((row) => row?.platform_role)
          .filter(Boolean)
      )
    );

    const canViewCertificationManager = platformRoles.some((role) =>
      ALLOWED_PLATFORM_ROLES.has(role)
    );

    if (!canViewCertificationManager) {
      return Response.json(
        {
          ok: false,
          error:
            "Only an active Platform Owner may view CE practitioner certification administration.",
        },
        { status: 403 }
      );
    }

    const [
      userRows,
      cohortRows,
      cohortMemberRows,
      billingEventRows,
      certificationRows,
    ] = await Promise.all([
      base44.asServiceRole.entities.User.list(),
      base44.asServiceRole.entities.CETrainingCohort.list(),
      base44.asServiceRole.entities.CETrainingCohortMember.list(),
      base44.asServiceRole.entities.OrganizationBillingEvent.list(),
      base44.asServiceRole.entities.CEPractitionerCertification.list(),
    ]);

    const allUsers = (Array.isArray(userRows) ? userRows : [])
      .filter((person) => person?.id)
      .map(normalizeUser);

    const userById = new Map(
      allUsers.map((person) => [person.id, person])
    );

    const cohorts = Array.isArray(cohortRows) ? cohortRows : [];
    const cohortById = new Map(
      cohorts
        .filter((cohort) => cohort?.id)
        .map((cohort) => [cohort.id, cohort])
    );

    const paidEnrollmentKeys = new Set(
      (Array.isArray(billingEventRows) ? billingEventRows : [])
        .filter((event) => {
          return (
            event?.event_status === "paid" &&
            event?.billing_subject_type === "student" &&
            PAID_TRAINING_FEE_KINDS.has(event?.fee_kind) &&
            String(event?.subject_user_id || "").trim() &&
            String(event?.cohort_id || "").trim()
          );
        })
        .map((event) =>
          getEnrollmentKey(event.subject_user_id, event.cohort_id)
        )
    );

    const paidStudentEnrollments = (
      Array.isArray(cohortMemberRows) ? cohortMemberRows : []
    )
      .filter((member) => {
        const cohort = cohortById.get(member?.cohort_id);

        return (
          member?.cohort_role === STUDENT_COHORT_ROLE &&
          cohort?.cohort_type === TRAINING_COHORT_TYPE &&
          paidEnrollmentKeys.has(
            getEnrollmentKey(member?.user_id, member?.cohort_id)
          )
        );
      })
      .map((member) => {
        const cohort = cohortById.get(member.cohort_id);

        return {
          membership_id: member.id,
          user_id: member.user_id,
          cohort_id: member.cohort_id,
          cohort_name: cohort?.name || "Unnamed CE training cohort",
          course_name: cohort?.course_name || "",
          course_version: cohort?.course_version || "",
          cohort_status: cohort?.status || null,
          membership_is_active: member?.is_active !== false,
          training_status: normalizeTrainingStatus(member),
          training_completed_at: member?.training_completed_at || null,
          joined_at: member?.joined_at || null,
        };
      });

    const paidEnrollmentsByUserId = new Map<string, any[]>();

    for (const enrollment of paidStudentEnrollments) {
      const existing = paidEnrollmentsByUserId.get(enrollment.user_id) || [];

      existing.push(enrollment);
      paidEnrollmentsByUserId.set(enrollment.user_id, existing);
    }

    const certificationRowsArray = Array.isArray(certificationRows)
      ? certificationRows
      : [];

    const certificationCountByUserId = new Map<string, number>();

    for (const certification of certificationRowsArray) {
      if (!certification?.user_id) {
        continue;
      }

      certificationCountByUserId.set(
        certification.user_id,
        (certificationCountByUserId.get(certification.user_id) || 0) + 1
      );
    }

    const duplicateCertificationUserIds = Array.from(
      certificationCountByUserId.entries()
    )
      .filter(([, count]) => count > 1)
      .map(([userId]) => userId);

    const pipelineCertificationRows = certificationRowsArray.filter(
      (certification) => {
        const userEnrollments =
          paidEnrollmentsByUserId.get(certification?.user_id) || [];

        const sourceCohortId = String(
          certification?.source_cohort_id || ""
        ).trim();

        return Boolean(
          sourceCohortId &&
            userEnrollments.some(
              (enrollment) => enrollment.cohort_id === sourceCohortId
            )
        );
      }
    );

    const normalizedCertifications = pipelineCertificationRows
      .filter((record) => record?.id && record?.user_id)
      .map((record) => normalizeCertification(record, userById))
      .sort((left, right) => {
        const nameCompare = left.practitioner_name.localeCompare(
          right.practitioner_name,
          undefined,
          { sensitivity: "base" }
        );

        if (nameCompare !== 0) {
          return nameCompare;
        }

        return String(left.id).localeCompare(String(right.id));
      });

    const certificationByUserId = new Map<string, any>();

    for (const certification of normalizedCertifications) {
      if (!certificationByUserId.has(certification.user_id)) {
        certificationByUserId.set(certification.user_id, certification);
      }
    }

    const activePipelineUserIds = new Set(
      paidStudentEnrollments
        .filter(
          (enrollment) =>
            enrollment.membership_is_active &&
            enrollment.training_status !== "withdrawn"
        )
        .map((enrollment) => enrollment.user_id)
    );

    const historicalCertificationUserIds = new Set(
      normalizedCertifications.map((certification) => certification.user_id)
    );

    const pipelineUserIds = new Set([
      ...activePipelineUserIds,
      ...historicalCertificationUserIds,
    ]);

    const people = Array.from(pipelineUserIds)
      .map((userId) => userById.get(userId))
      .filter(Boolean)
      .map((person) => {
        const certifications = certificationByUserId.get(person.id) || null;
        const enrollments = paidEnrollmentsByUserId.get(person.id) || [];
        const primaryEnrollment = choosePrimaryEnrollment(
          enrollments,
          certifications
        );

        const pipelineStatus = getPipelineStatus(
          certifications,
          primaryEnrollment
        );

        return {
          ...person,
          certification_record_id: certifications?.id || null,
          certification_status:
            certifications?.certification_status || "none",
          certification_source:
            certifications?.certification_source || null,
          certification_completed_at: certifications?.completed_at || null,
          certification_verified_at: certifications?.verified_at || null,
          pipeline_status: pipelineStatus,
          pipeline_status_label: getPipelineStatusLabel(pipelineStatus),
          cohort_id: primaryEnrollment?.cohort_id || null,
          cohort_name: primaryEnrollment?.cohort_name || null,
          course_name: primaryEnrollment?.course_name || null,
          course_version: primaryEnrollment?.course_version || null,
          cohort_status: primaryEnrollment?.cohort_status || null,
          membership_is_active:
            primaryEnrollment?.membership_is_active === false
              ? false
              : primaryEnrollment
                ? true
                : null,
          training_status: primaryEnrollment?.training_status || null,
          training_completed_at:
            primaryEnrollment?.training_completed_at || null,
          paid_training_enrollment_count: enrollments.length,
        };
      })
      .sort((left, right) => {
        const statusDifference =
          (PIPELINE_STATUS_ORDER[left.pipeline_status] || 99) -
          (PIPELINE_STATUS_ORDER[right.pipeline_status] || 99);

        if (statusDifference !== 0) {
          return statusDifference;
        }

        return left.display_name.localeCompare(
          right.display_name,
          undefined,
          { sensitivity: "base" }
        );
      });

    return Response.json({
      ok: true,
      viewer: {
        user_id: user.id,
        platform_roles: platformRoles,
        can_manage_certifications: true,
      },
      people,
      certifications: normalizedCertifications,
      integrity: {
        duplicate_certification_user_ids: duplicateCertificationUserIds,
        duplicate_certification_count: duplicateCertificationUserIds.length,
        excluded_non_pipeline_certification_count:
          certificationRowsArray.length - normalizedCertifications.length,
      },
      counts: {
        people_count: people.length,
        in_training_count: people.filter(
          (person) => person.pipeline_status === "in_training"
        ).length,
        pending_certification_count: people.filter(
          (person) => person.pipeline_status === "pending_certification"
        ).length,
        certified_count: people.filter(
          (person) => person.pipeline_status === "certified"
        ).length,
        revoked_count: people.filter(
          (person) => person.pipeline_status === "revoked"
        ).length,
      },
    });
  } catch (error) {
    console.error(
      "getCEPractitionerCertificationManagerData error:",
      error?.message || error
    );

    return Response.json(
      {
        ok: false,
        error:
          error?.message ||
          "Unable to load CE practitioner certification administration data.",
      },
      { status: 500 }
    );
  }
});
