import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

const PAID_TRAINING_FEE_KINDS = new Set([
  "training_registration",
  "training_reactivation",
]);

const SETTLED_TRAINING_REGISTRATION_STATUSES = new Set([
  "paid",
  "waived",
]);

const ALLOWED_COHORT_STATUSES = new Set(["active", "completed"]);
function getRequiredString(value: unknown, fieldName: string) {
  const normalized = String(value || "").trim();

  if (!normalized) {
    throw new Error(`${fieldName} is required.`);
  }

  return normalized;
}

function normalizeTrainingStatus(value: unknown) {
  const status = String(value || "").trim();

  if (
    status === "in_training" ||
    status === "completed" ||
    status === "withdrawn"
  ) {
    return status;
  }

  return "in_training";
}

function getDisplayName(user: any) {
  return (
    String(user?.full_name || "").trim() ||
    String(user?.email || "").trim() ||
    "This student"
  );
}

/**
 * markCEStudentTrainingComplete
 *
 * Records that one paid CE student completed their individual training
 * requirements in a training cohort.
 *
 * Authorized callers:
 * - Legacy admin
 * - Active cohort manager
 * - Active cohort trainer
 *
 * This does not create or verify CE practitioner certification.
 * It only moves the student from In Training to ready for Pending Certification.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const actor = await base44.auth.me();

    if (!actor) {
      return Response.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));

    const action = String(body?.action || "").trim();

    if (action !== "mark_completed") {
      return Response.json(
        {
          ok: false,
          error: "Only the mark_completed action is supported.",
        },
        { status: 400 }
      );
    }

    const cohortId = getRequiredString(body?.cohort_id, "cohort_id");
    const membershipId = getRequiredString(
      body?.membership_id,
      "membership_id"
    );

    const [
      cohortRows,
      membershipRows,
      certificationRows,
    ] = await Promise.all([
      base44.asServiceRole.entities.CETrainingCohort.list(),
      base44.asServiceRole.entities.CETrainingCohortMember.list(),
      base44.asServiceRole.entities.CEPractitionerCertification.list(),
    ]);

    const cohorts = Array.isArray(cohortRows) ? cohortRows : [];
    const memberships = Array.isArray(membershipRows) ? membershipRows : [];
    const certifications = Array.isArray(certificationRows)
      ? certificationRows
      : [];

    const cohort = cohorts.find((row) => row?.id === cohortId);

    if (!cohort) {
      return Response.json(
        { ok: false, error: "CE training cohort not found." },
        { status: 404 }
      );
    }

    if (cohort.cohort_type !== "training") {
      return Response.json(
        {
          ok: false,
          error:
            "Individual training completion can only be recorded for a CE training cohort.",
        },
        { status: 409 }
      );
    }

    if (!ALLOWED_COHORT_STATUSES.has(cohort.status)) {
      return Response.json(
        {
          ok: false,
          error:
            "Training completion can only be recorded while the cohort is active or completed.",
        },
        { status: 409 }
      );
    }

    const isLegacyAdmin = actor.role === "admin";

    const actorHasCohortAuthority = memberships.some(
      (membership) =>
        membership?.cohort_id === cohortId &&
        membership?.user_id === actor.id &&
        membership?.is_active !== false &&
        (membership?.cohort_role === "manager" ||
          membership?.cohort_role === "trainer")
    );

    if (!isLegacyAdmin && !actorHasCohortAuthority) {
      return Response.json(
        {
          ok: false,
          error:
            "Only an active cohort manager or trainer may record student training completion.",
        },
        { status: 403 }
      );
    }

    const studentMembership = memberships.find(
      (membership) =>
        membership?.id === membershipId &&
        membership?.cohort_id === cohortId &&
        membership?.cohort_role === "member" &&
        membership?.is_active !== false
    );

    if (!studentMembership) {
      return Response.json(
        {
          ok: false,
          error:
            "An active CE student membership for this cohort was not found.",
        },
        { status: 404 }
      );
    }

    const existingCertificationRecords = certifications.filter(
      (record) => record?.user_id === studentMembership.user_id
    );

    if (existingCertificationRecords.length > 1) {
      return Response.json(
        {
          ok: false,
          error:
            "More than one CE practitioner certification record exists for this student. No training status change was made.",
        },
        { status: 409 }
      );
    }

    if (existingCertificationRecords.length === 1) {
      return Response.json(
        {
          ok: false,
          error:
            "This student already has a certification record. Training completion cannot be changed through this workflow after certification review has begun.",
        },
        { status: 409 }
      );
    }

    const paidBillingRows =
      await base44.asServiceRole.entities.OrganizationBillingEvent.filter({
        subject_user_id: studentMembership.user_id,
        cohort_id: cohortId,
      });

      const hasSettledRegistration = (Array.isArray(paidBillingRows)
      ? paidBillingRows
      : []
    ).some(
      (event) =>
        SETTLED_TRAINING_REGISTRATION_STATUSES.has(event?.event_status) &&
        event?.billing_subject_type === "student" &&
        PAID_TRAINING_FEE_KINDS.has(event?.fee_kind)
    );

    if (!hasSettledRegistration) {
      return Response.json(
        {
          ok: false,
          error:
            "A matching settled CE student registration or reactivation is required before training completion can be recorded.",
        },
        { status: 409 }
      );
    }

    const currentTrainingStatus = normalizeTrainingStatus(
      studentMembership.training_status
    );

    if (currentTrainingStatus === "withdrawn") {
      return Response.json(
        {
          ok: false,
          error:
            "This student is marked withdrawn. Reactivate the student through a future enrollment workflow before recording training completion.",
        },
        { status: 409 }
      );
    }

    if (currentTrainingStatus === "completed") {
      return Response.json({
        ok: true,
        action,
        already_completed: true,
        message: "This student's training completion is already recorded.",
        membership: {
          id: studentMembership.id,
          user_id: studentMembership.user_id,
          cohort_id: studentMembership.cohort_id,
          training_status: "completed",
          training_completed_at:
            studentMembership.training_completed_at || null,
          training_completed_by_user_id:
            studentMembership.training_completed_by_user_id || null,
        },
      });
    }

    const now = new Date().toISOString();

    await base44.asServiceRole.entities.CETrainingCohortMember.update(
      studentMembership.id,
      {
        training_status: "completed",
        training_completed_at: now,
        training_completed_by_user_id: actor.id,
      }
    );

    const studentUserRows = await base44.asServiceRole.entities.User.filter({
      id: studentMembership.user_id,
    });

    const studentUser = Array.isArray(studentUserRows)
      ? studentUserRows[0]
      : null;

    return Response.json({
      ok: true,
      action,
      already_completed: false,
      message: `${getDisplayName(
        studentUser
      )} is now ready for Pending Certification review.`,
      membership: {
        id: studentMembership.id,
        user_id: studentMembership.user_id,
        cohort_id: studentMembership.cohort_id,
        training_status: "completed",
        training_completed_at: now,
        training_completed_by_user_id: actor.id,
      },
    });
  } catch (error) {
    console.error(
      "markCEStudentTrainingComplete error:",
      error?.message || error
    );

    return Response.json(
      {
        ok: false,
        error:
          error?.message ||
          "Unable to record CE student training completion.",
      },
      { status: 500 }
    );
  }
});
