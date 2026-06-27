import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

const ALLOWED_VERIFIER_ROLES = new Set(["platform_owner"]);

const PAID_TRAINING_FEE_KINDS = new Set([
  "training_registration",
  "training_reactivation",
]);

const SETTLED_TRAINING_REGISTRATION_STATUSES = new Set([
  "paid",
  "waived",
]);

const TRAINING_COHORT_TYPE = "training";
const STUDENT_COHORT_ROLE = "member";
const TRAINER_BUSINESS_SOURCE = "trainer_business";
function getRequiredString(value: unknown, fieldName: string) {
  const normalized = String(value || "").trim();

  if (!normalized) {
    throw new Error(`${fieldName} is required.`);
  }

  return normalized;
}

function getOptionalString(value: unknown) {
  const normalized = String(value || "").trim();
  return normalized || undefined;
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

function sortNewestFirst(left: any, right: any) {
  const leftDate = String(
    left?.training_completed_at || left?.joined_at || ""
  );
  const rightDate = String(
    right?.training_completed_at || right?.joined_at || ""
  );

  return rightDate.localeCompare(leftDate);
}

async function getPlatformRoles(base44: any, userId: string) {
  const rows = await base44.asServiceRole.entities.PlatformAdmin.filter({
    user_id: userId,
    is_active: true,
  });

  return Array.from(
    new Set(
      (Array.isArray(rows) ? rows : [])
        .filter((row) => row?.is_active !== false)
        .map((row) => row?.platform_role)
        .filter(Boolean)
    )
  );
}

async function getSingleCertificationForUser(base44: any, userId: string) {
  const rows =
    await base44.asServiceRole.entities.CEPractitionerCertification.filter({
      user_id: userId,
    });

  const certifications = Array.isArray(rows) ? rows : [];

  if (certifications.length > 1) {
    throw new Error(
      "More than one CE practitioner certification record exists for this user. No change was made."
    );
  }

  return certifications[0] || null;
}

async function getStudentTrainingEligibility(base44: any, userId: string) {
  const [memberRows, cohortRows, billingRows] = await Promise.all([
    base44.asServiceRole.entities.CETrainingCohortMember.filter({
      user_id: userId,
    }),
    base44.asServiceRole.entities.CETrainingCohort.list(),
    base44.asServiceRole.entities.OrganizationBillingEvent.list(),
  ]);

  const cohorts = Array.isArray(cohortRows) ? cohortRows : [];
  const members = Array.isArray(memberRows) ? memberRows : [];
  const billingEvents = Array.isArray(billingRows) ? billingRows : [];

  const cohortById = new Map(
    cohorts
      .filter((cohort) => cohort?.id)
      .map((cohort) => [cohort.id, cohort])
  );

  const paidTrainingCohortIds = new Set(
    billingEvents
      .filter((event) => {
        return (
          event?.event_status === "paid" &&
          event?.billing_subject_type === "student" &&
          event?.subject_user_id === userId &&
          PAID_TRAINING_FEE_KINDS.has(event?.fee_kind) &&
          String(event?.cohort_id || "").trim()
        );
      })
      .map((event) => String(event.cohort_id))
  );

  const paidTrainingEnrollments = members
    .filter((member) => {
      const cohort = cohortById.get(member?.cohort_id);

      return (
        member?.cohort_role === STUDENT_COHORT_ROLE &&
        cohort?.cohort_type === TRAINING_COHORT_TYPE &&
        paidTrainingCohortIds.has(String(member?.cohort_id || ""))
      );
    })
    .map((member) => {
      const cohort = cohortById.get(member.cohort_id);

      return {
        membership_id: member.id,
        cohort_id: member.cohort_id,
        cohort_name: cohort?.name || "Unnamed CE training cohort",
        cohort_status: cohort?.status || null,
        membership_is_active: member?.is_active !== false,
        training_status: normalizeTrainingStatus(member),
        training_completed_at: member?.training_completed_at || null,
        joined_at: member?.joined_at || null,
      };
    })
    .sort(sortNewestFirst);

  const activePaidTrainingEnrollments = paidTrainingEnrollments.filter(
    (enrollment) => enrollment.membership_is_active
  );

  const completedActiveEnrollments = activePaidTrainingEnrollments
    .filter(
      (enrollment) =>
        enrollment.training_status === "completed" &&
        enrollment.training_completed_at
    )
    .sort(sortNewestFirst);

  const activeInTrainingEnrollments = activePaidTrainingEnrollments
    .filter(
      (enrollment) =>
        enrollment.training_status === "in_training" &&
        enrollment.cohort_status === "active"
    )
    .sort(sortNewestFirst);

  return {
    has_paid_training_history: paidTrainingEnrollments.length > 0,
    paid_training_enrollments: paidTrainingEnrollments,
    active_paid_training_enrollments: activePaidTrainingEnrollments,
    completed_active_enrollments: completedActiveEnrollments,
    active_in_training_enrollments: activeInTrainingEnrollments,
    preferred_completed_enrollment: completedActiveEnrollments[0] || null,
  };
}

function getCompletedEnrollmentForCertification(
  eligibility: any,
  sourceCohortId?: string | null
) {
  const completedEnrollments =
    eligibility?.completed_active_enrollments || [];

  if (sourceCohortId) {
    return (
      completedEnrollments.find(
        (enrollment: any) => enrollment.cohort_id === sourceCohortId
      ) || null
    );
  }

  return eligibility?.preferred_completed_enrollment || null;
}

async function writeAuditLog(
  base44: any,
  userId: string,
  eventKey: string,
  eventSummary: string,
  certificationRecordId: string,
  details: Record<string, unknown>
) {
  try {
    await base44.asServiceRole.entities.PlatformAuditLog.create({
      platform_admin_user_id: userId,
      event_key: eventKey,
      event_summary: eventSummary,
      actor_type: "platform_admin",
      target_entity: "CEPractitionerCertification",
      target_record_id: certificationRecordId,
      tenant_visible: false,
      occurred_at: new Date().toISOString(),
      details,
    });
  } catch (error) {
    console.error(
      "manageCEPractitionerCertification audit error:",
      error?.message || error
    );
  }
}

/**
 * manageCEPractitionerCertification
 *
 * CE certification pipeline:
 * - In Training: active paid CE student with training_status=in_training
 * - Pending Certification: active paid CE student with training_status=completed
 * - Certified: pending record verified by Platform Owner
 * - Revoked: verified record later revoked
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

    const platformRoles = await getPlatformRoles(base44, user.id);

    const canManageCertification = platformRoles.some((role) =>
      ALLOWED_VERIFIER_ROLES.has(role)
    );

    if (!canManageCertification) {
      return Response.json(
        {
          ok: false,
          error:
            "Only an active Platform Owner may manage CE practitioner certification records.",
        },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "").trim();

    if (
      ![
        "list_all",
        "read_user",
        "create_pending",
        "verify",
        "revoke",
      ].includes(action)
    ) {
      return Response.json(
        {
          ok: false,
          error: "A valid certification-management action is required.",
        },
        { status: 400 }
      );
    }

    if (action === "list_all") {
      const rows =
        await base44.asServiceRole.entities.CEPractitionerCertification.list();

      const certifications = (Array.isArray(rows) ? rows : [])
        .map((record) => ({
          id: record.id,
          user_id: record.user_id,
          certification_status: record.certification_status,
          completed_at: record.completed_at || null,
          verified_at: record.verified_at || null,
          verified_by_user_id: record.verified_by_user_id || null,
          revoked_at: record.revoked_at || null,
          revoked_by_user_id: record.revoked_by_user_id || null,
          certification_source: record.certification_source,
          source_cohort_id: record.source_cohort_id || null,
          notes: record.notes || "",
        }))
        .sort((a, b) =>
          String(a.user_id).localeCompare(String(b.user_id))
        );

      return Response.json({
        ok: true,
        action,
        certifications,
      });
    }

    const targetUserId = getRequiredString(body?.user_id, "user_id");

    if (action === "read_user") {
      const certification = await getSingleCertificationForUser(
        base44,
        targetUserId
      );

      return Response.json({
        ok: true,
        action,
        certification,
      });
    }

    const existingCertification = await getSingleCertificationForUser(
      base44,
      targetUserId
    );

    if (action === "create_pending") {
      if (existingCertification) {
        return Response.json(
          {
            ok: false,
            error:
              "A CE practitioner certification record already exists for this user. No duplicate record was created.",
            existing_certification_status:
              existingCertification.certification_status,
          },
          { status: 409 }
        );
      }

      const eligibility = await getStudentTrainingEligibility(
        base44,
        targetUserId
      );

      const completedEnrollment = getCompletedEnrollmentForCertification(
        eligibility
      );

      if (!completedEnrollment) {
        return Response.json(
          {
            ok: false,
            error:
              "Pending Certification is available only after an active paid CE student has completed individual training requirements and has a recorded training completion date.",
          },
          { status: 409 }
        );
      }

      const createdCertification =
        await base44.asServiceRole.entities.CEPractitionerCertification.create(
          {
            user_id: targetUserId,
            certification_status: "pending_verification",
            completed_at: completedEnrollment.training_completed_at,
            certification_source: TRAINER_BUSINESS_SOURCE,
            source_cohort_id: completedEnrollment.cohort_id,
            notes: getOptionalString(body?.notes),
          }
        );

      await writeAuditLog(
        base44,
        user.id,
        "ce_practitioner_certification_pending_created",
        "A paid CE student who completed training entered Pending Certification.",
        createdCertification.id,
        {
          user_id: targetUserId,
          cohort_id: completedEnrollment.cohort_id,
          cohort_name: completedEnrollment.cohort_name,
          training_completed_at: completedEnrollment.training_completed_at,
        }
      );

      return Response.json({
        ok: true,
        action,
        certification: createdCertification,
      });
    }

    if (action === "verify") {
      if (!existingCertification) {
        return Response.json(
          {
            ok: false,
            error:
              "A CE student must first be placed in Pending Certification before certification can be verified.",
          },
          { status: 409 }
        );
      }

      if (existingCertification.certification_status === "verified") {
        return Response.json(
          {
            ok: false,
            error:
              "This user already has a verified CE practitioner certification record. No change was made.",
          },
          { status: 409 }
        );
      }

      if (existingCertification.certification_status === "revoked") {
        return Response.json(
          {
            ok: false,
            error:
              "This certification record was revoked. A future re-certification workflow is required rather than overwriting revocation history.",
          },
          { status: 409 }
        );
      }

      if (
        existingCertification.certification_status !==
        "pending_verification"
      ) {
        return Response.json(
          {
            ok: false,
            error:
              "Only a Pending Certification record may be verified.",
          },
          { status: 409 }
        );
      }

      const eligibility = await getStudentTrainingEligibility(
        base44,
        targetUserId
      );

      const completedEnrollment = getCompletedEnrollmentForCertification(
        eligibility,
        existingCertification.source_cohort_id
      );

      if (!completedEnrollment) {
        return Response.json(
          {
            ok: false,
            error:
              "Certification cannot be verified because the required paid CE training completion record is not available.",
          },
          { status: 409 }
        );
      }

      const now = new Date().toISOString();

      await base44.asServiceRole.entities.CEPractitionerCertification.update(
        existingCertification.id,
        {
          certification_status: "verified",
          completed_at:
            existingCertification.completed_at ||
            completedEnrollment.training_completed_at,
          verified_at: now,
          verified_by_user_id: user.id,
          certification_source: TRAINER_BUSINESS_SOURCE,
          source_cohort_id: completedEnrollment.cohort_id,
          notes:
            getOptionalString(body?.notes) ||
            existingCertification.notes ||
            undefined,
        }
      );

      await writeAuditLog(
        base44,
        user.id,
        "ce_practitioner_certification_verified",
        "A Pending Certification record was verified for a paid CE student.",
        existingCertification.id,
        {
          user_id: targetUserId,
          cohort_id: completedEnrollment.cohort_id,
          cohort_name: completedEnrollment.cohort_name,
          training_completed_at: completedEnrollment.training_completed_at,
        }
      );

      return Response.json({
        ok: true,
        action,
        certification_record_id: existingCertification.id,
        certification_status: "verified",
      });
    }

    if (action === "revoke") {
      if (!existingCertification) {
        return Response.json(
          {
            ok: false,
            error:
              "No CE practitioner certification record exists for this user.",
          },
          { status: 404 }
        );
      }

      if (existingCertification.certification_status !== "verified") {
        return Response.json(
          {
            ok: false,
            error:
              "Only a Certified CE practitioner record may be revoked.",
          },
          { status: 409 }
        );
      }

      const eligibility = await getStudentTrainingEligibility(
        base44,
        targetUserId
      );

      if (!eligibility.has_paid_training_history) {
        return Response.json(
          {
            ok: false,
            error:
              "This record cannot be changed through the CE student certification pipeline because no paid CE training enrollment history was found.",
          },
          { status: 409 }
        );
      }

      const revocationNotes = getRequiredString(
        body?.notes,
        "notes explaining the revocation"
      );

      const now = new Date().toISOString();

      await base44.asServiceRole.entities.CEPractitionerCertification.update(
        existingCertification.id,
        {
          certification_status: "revoked",
          revoked_at: now,
          revoked_by_user_id: user.id,
          notes: revocationNotes,
        }
      );

      await writeAuditLog(
        base44,
        user.id,
        "ce_practitioner_certification_revoked",
        "A Certified CE practitioner record was revoked.",
        existingCertification.id,
        {
          user_id: targetUserId,
          source_cohort_id: existingCertification.source_cohort_id || null,
        }
      );

      return Response.json({
        ok: true,
        action,
        certification_record_id: existingCertification.id,
        certification_status: "revoked",
      });
    }

    return Response.json(
      { ok: false, error: "Unsupported certification-management action." },
      { status: 400 }
    );
  } catch (error) {
    console.error(
      "manageCEPractitionerCertification error:",
      error?.message || error
    );

    return Response.json(
      {
        ok: false,
        error:
          error?.message ||
          "Unable to manage CE practitioner certification records.",
      },
      { status: 500 }
    );
  }
});
