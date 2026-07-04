import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

const PLATFORM_OWNER_ROLE = "platform_owner";

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

const CONTROLLED_TEST_WAIVER_BILLING_EVENT_PREFIX =
  "test_waived_training_registration";

const CONTROLLED_TEST_WAIVER_AMOUNT_CENTS = 4900;

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

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeEmail(value: unknown) {
  return normalizeText(value).toLowerCase();
}

function normalizeIdentifier(value: unknown) {
  return normalizeText(value);
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isActiveRecord(record: any) {
  return (
    record &&
    record.is_active !== false &&
    record.is_archived !== true
  );
}

function getRequiredString(value: unknown, message: string) {
  const normalized = normalizeText(value);

  if (!normalized) {
    throw new RequestError(400, message);
  }

  return normalized;
}

function getOptionalString(value: unknown) {
  const normalized = normalizeText(value);
  return normalized || null;
}

async function resolveCanonicalPlatformOwner(
  base44: any,
  authenticatedUserId: string
) {
  const caller = await base44.asServiceRole.entities.User.get(
    authenticatedUserId
  ).catch(() => null);

  const callerId = normalizeIdentifier(caller?.id);
  const callerEmail = normalizeEmail(caller?.email);

  if (
    !caller ||
    !isActiveRecord(caller) ||
    !callerId ||
    !isValidEmail(callerEmail)
  ) {
    throw new RequestError(
      403,
      "Your platform account is unavailable or inactive."
    );
  }

  const platformRoleRows =
    await base44.asServiceRole.entities.PlatformAdmin.filter({
      user_id: callerId,
      platform_role: PLATFORM_OWNER_ROLE,
      is_active: true,
    });

  const isPlatformOwner = asArray(platformRoleRows).some(
    (record: any) =>
      normalizeIdentifier(record?.user_id) === callerId &&
      normalizeText(record?.platform_role) ===
        PLATFORM_OWNER_ROLE &&
      record?.is_active !== false
  );

  if (!isPlatformOwner) {
    throw new RequestError(
      403,
      "Only an active Platform Owner may manage CE practitioner certification records."
    );
  }

  return {
    caller,
    callerId,
  };
}

async function resolveCertificationSubject(
  base44: any,
  targetUserId: string,
  requireActive: boolean
) {
  const user = await base44.asServiceRole.entities.User.get(
    targetUserId
  ).catch(() => null);

  const userId = normalizeIdentifier(user?.id);
  const email = normalizeEmail(user?.email);

  if (!user || !userId || !isValidEmail(email)) {
    throw new RequestError(
      404,
      "The selected certification subject was not found or does not have a verified email address."
    );
  }

  if (requireActive && !isActiveRecord(user)) {
    throw new RequestError(
      409,
      "The selected certification subject is inactive and cannot enter or advance through the CE certification pipeline."
    );
  }

  return {
    user,
    userId,
    email,
  };
}

async function getSingleCertificationForUser(
  base44: any,
  userId: string
) {
  const rows =
    await base44.asServiceRole.entities.CEPractitionerCertification.filter(
      {
        user_id: userId,
      }
    );

  const certifications = asArray(rows).filter(
    (record: any) =>
      normalizeIdentifier(record?.user_id) === userId
  );

  if (certifications.length > 1) {
    throw new RequestError(
      409,
      "More than one CE practitioner certification record exists for this user. No change was made."
    );
  }

  return certifications[0] || null;
}

async function resolveCompletedTrainingEnrollment(
  base44: any,
  subject: {
    userId: string;
    email: string;
  },
  requestedSourceCohortId?: string | null
) {
  const enrollmentRows =
    await base44.asServiceRole.entities.CETrainingStudentEnrollment.filter(
      {
        user_id: subject.userId,
      }
    );

  const candidateEnrollments = asArray(enrollmentRows).filter(
    (enrollment: any) => {
      const enrollmentStatus = normalizeText(
        enrollment?.enrollment_status
      ).toLowerCase();

      return (
        normalizeIdentifier(enrollment?.user_id) === subject.userId &&
        enrollment?.is_active !== false &&
        enrollment?.is_archived !== true &&
        enrollmentStatus === "training_completed" &&
        (!requestedSourceCohortId ||
          normalizeIdentifier(enrollment?.cohort_id) ===
            requestedSourceCohortId)
      );
    }
  );

  const validCandidates = [];

  for (const enrollment of candidateEnrollments) {
    const organizationId = normalizeIdentifier(enrollment?.org_id);
    const cohortId = normalizeIdentifier(enrollment?.cohort_id);
    const membershipId = normalizeIdentifier(
      enrollment?.cohort_member_id
    );
    const billingEventId = normalizeIdentifier(
      enrollment?.organization_billing_event_id
    );

    const enrollmentHasRequiredLinks =
      !!organizationId &&
      !!cohortId &&
      !!membershipId &&
      !!billingEventId &&
      !!normalizeIdentifier(
        enrollment?.pending_role_assignment_id
      ) &&
      !!normalizeText(enrollment?.payment_settled_at) &&
      !!normalizeText(enrollment?.registered_at) &&
      !!normalizeText(enrollment?.training_completed_at) &&
      normalizeEmail(enrollment?.student_email) ===
        subject.email;

    if (!enrollmentHasRequiredLinks) {
      continue;
    }

    const [cohort, membership, billingEvent] = await Promise.all([
      base44.asServiceRole.entities.CETrainingCohort.get(
        cohortId
      ).catch(() => null),
      base44.asServiceRole.entities.CETrainingCohortMember.get(
        membershipId
      ).catch(() => null),
      base44.asServiceRole.entities.OrganizationBillingEvent.get(
        billingEventId
      ).catch(() => null),
    ]);

    const cohortMatches =
      cohort &&
      normalizeIdentifier(cohort?.org_id) === organizationId &&
      normalizeText(cohort?.cohort_type).toLowerCase() ===
        TRAINING_COHORT_TYPE &&
      ["active", "completed"].includes(
        normalizeText(cohort?.status).toLowerCase()
      ) &&
      cohort?.is_active !== false &&
      cohort?.is_archived !== true;

    const membershipMatches =
      membership &&
      normalizeIdentifier(membership?.id) === membershipId &&
      normalizeIdentifier(membership?.org_id) === organizationId &&
      normalizeIdentifier(membership?.cohort_id) === cohortId &&
      normalizeIdentifier(membership?.user_id) ===
        subject.userId &&
      normalizeText(membership?.cohort_role).toLowerCase() ===
        STUDENT_COHORT_ROLE &&
      membership?.is_active !== false &&
      membership?.is_archived !== true &&
      normalizeText(membership?.training_status).toLowerCase() ===
        "completed" &&
      !!normalizeText(membership?.training_completed_at);

    const billingMatches =
      billingEvent &&
      normalizeIdentifier(billingEvent?.organization_id) ===
        organizationId &&
      normalizeIdentifier(billingEvent?.cohort_id) === cohortId &&
      normalizeIdentifier(billingEvent?.subject_user_id) ===
        subject.userId &&
      normalizeEmail(billingEvent?.subject_verified_email) ===
        subject.email &&
      normalizeText(billingEvent?.billing_subject_type) ===
        "student" &&
      PAID_TRAINING_FEE_KINDS.has(
        normalizeText(billingEvent?.fee_kind)
      ) &&
      SETTLED_TRAINING_REGISTRATION_STATUSES.has(
        normalizeText(billingEvent?.event_status).toLowerCase()
      );

    if (!cohortMatches || !membershipMatches || !billingMatches) {
      continue;
    }

    validCandidates.push({
      enrollment,
      cohort,
      membership,
      billingEvent,
    });
  }

  if (requestedSourceCohortId) {
    if (validCandidates.length !== 1) {
      throw new RequestError(
        409,
        "The selected CE training cohort does not have one complete, settled, training-completed enrollment for this certification subject."
      );
    }

    return validCandidates[0];
  }

  if (validCandidates.length === 0) {
    throw new RequestError(
      409,
      "A complete settled CE training enrollment with recorded individual training completion is required before certification can proceed."
    );
  }

  if (validCandidates.length > 1) {
    throw new RequestError(
      409,
      "More than one completed CE training enrollment is eligible for this user. Select the specific source cohort before continuing."
    );
  }

  return validCandidates[0];
}

async function writeAuditLog(
  base44: any,
  actorUserId: string,
  eventKey: string,
  eventSummary: string,
  certificationRecordId: string,
  details: Record<string, unknown>
) {
  try {
    await base44.asServiceRole.entities.PlatformAuditLog.create({
      platform_admin_user_id: actorUserId,
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
      "[manageCEPractitionerCertification] Could not write audit log:",
      error instanceof Error ? error.message : error
    );
  }
}

function serializeCertification(record: any) {
  return {
    id: record?.id || null,
    user_id: record?.user_id || null,
    certification_status: record?.certification_status || null,
    completed_at: record?.completed_at || null,
    verified_at: record?.verified_at || null,
    verified_by_user_id: record?.verified_by_user_id || null,
    revoked_at: record?.revoked_at || null,
    revoked_by_user_id: record?.revoked_by_user_id || null,
    certification_source: record?.certification_source || null,
    source_cohort_id: record?.source_cohort_id || null,
    notes: record?.notes || "",
  };
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json(
        {
          ok: false,
          error:
            "This CE practitioner certification request must use POST.",
        },
        { status: 405 }
      );
    }

    const base44 = createClientFromRequest(req);
    const authenticatedUser = await base44.auth.me().catch(
      () => null
    );

    if (!authenticatedUser?.id) {
      return Response.json(
        {
          ok: false,
          error:
            "Please sign in before managing CE practitioner certification records.",
        },
        { status: 401 }
      );
    }

    const { callerId } = await resolveCanonicalPlatformOwner(
      base44,
      authenticatedUser.id
    );

    const body = await req.json().catch(() => ({}));
    const action = normalizeText(body?.action);

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
          error:
            "A valid certification-management action is required.",
        },
        { status: 400 }
      );
    }

    if (action === "list_all") {
      const rows =
        await base44.asServiceRole.entities.CEPractitionerCertification.list();

      const certifications = asArray(rows)
        .map(serializeCertification)
        .sort((left, right) =>
          String(left.user_id).localeCompare(
            String(right.user_id)
          )
        );

      return Response.json({
        ok: true,
        action,
        certifications,
      });
    }

    const targetUserId = getRequiredString(
      body?.user_id,
      "A certification subject must be selected."
    );

    if (action === "read_user") {
      await resolveCertificationSubject(
        base44,
        targetUserId,
        false
      );

      const certification = await getSingleCertificationForUser(
        base44,
        targetUserId
      );

      return Response.json({
        ok: true,
        action,
        certification: certification
          ? serializeCertification(certification)
          : null,
      });
    }

    const existingCertification =
      await getSingleCertificationForUser(
        base44,
        targetUserId
      );

    if (action === "create_pending") {
      if (existingCertification) {
        throw new RequestError(
          409,
          "A CE practitioner certification record already exists for this user. No duplicate record was created."
        );
      }

      const subject = await resolveCertificationSubject(
        base44,
        targetUserId,
        true
      );

      const requestedSourceCohortId =
        getOptionalString(body?.source_cohort_id);

      const completedTraining =
        await resolveCompletedTrainingEnrollment(
          base44,
          subject,
          requestedSourceCohortId
        );

      const createdCertification =
        await base44.asServiceRole.entities.CEPractitionerCertification.create(
          {
            user_id: subject.userId,
            certification_status: "pending_verification",
            completed_at:
              completedTraining.enrollment.training_completed_at,
            certification_source: "trainer_business",
            source_cohort_id: completedTraining.cohort.id,
            notes: getOptionalString(body?.notes) || undefined,
          }
        );

      await writeAuditLog(
        base44,
        callerId,
        "ce_practitioner_certification_pending_created",
        "A settled CE Training student entered Pending Certification.",
        createdCertification.id,
        {
          user_id: subject.userId,
          cohort_id: completedTraining.cohort.id,
          enrollment_id: completedTraining.enrollment.id,
          cohort_member_id: completedTraining.membership.id,
          billing_event_id: completedTraining.billingEvent.id,
          training_completed_at:
            completedTraining.enrollment.training_completed_at,
        }
      );

      return Response.json({
        ok: true,
        action,
        certification: serializeCertification(
          createdCertification
        ),
      });
    }

    if (action === "verify") {
      if (!existingCertification) {
        throw new RequestError(
          409,
          "A CE student must first be placed in Pending Certification before certification can be verified."
        );
      }

      if (
        normalizeText(
          existingCertification?.certification_status
        ) !== "pending_verification"
      ) {
        throw new RequestError(
          409,
          "Only a Pending Certification record may be verified."
        );
      }

      const subject = await resolveCertificationSubject(
        base44,
        targetUserId,
        true
      );

      const completedTraining =
        await resolveCompletedTrainingEnrollment(
          base44,
          subject,
          normalizeIdentifier(
            existingCertification?.source_cohort_id
          ) || null
        );

      const now = new Date().toISOString();
      const newNotes = getOptionalString(body?.notes);

      await base44.asServiceRole.entities.CEPractitionerCertification.update(
        existingCertification.id,
        {
          certification_status: "verified",
          completed_at:
            existingCertification.completed_at ||
            completedTraining.enrollment.training_completed_at,
          verified_at: now,
          verified_by_user_id: callerId,
          certification_source: "trainer_business",
          source_cohort_id: completedTraining.cohort.id,
          ...(newNotes ? { notes: newNotes } : {}),
        }
      );

      await writeAuditLog(
        base44,
        callerId,
        "ce_practitioner_certification_verified",
        "A Pending Certification record was verified.",
        existingCertification.id,
        {
          user_id: subject.userId,
          cohort_id: completedTraining.cohort.id,
          enrollment_id: completedTraining.enrollment.id,
          cohort_member_id: completedTraining.membership.id,
          billing_event_id: completedTraining.billingEvent.id,
          training_completed_at:
            completedTraining.enrollment.training_completed_at,
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
        throw new RequestError(
          404,
          "No CE practitioner certification record exists for this user."
        );
      }

      if (
        normalizeText(
          existingCertification?.certification_status
        ) !== "verified"
      ) {
        throw new RequestError(
          409,
          "Only a Certified CE practitioner record may be revoked."
        );
      }

      const subject = await resolveCertificationSubject(
        base44,
        targetUserId,
        false
      );

      const revocationNotes = getRequiredString(
        body?.notes,
        "A revocation explanation is required."
      );

      const now = new Date().toISOString();

      await base44.asServiceRole.entities.CEPractitionerCertification.update(
        existingCertification.id,
        {
          certification_status: "revoked",
          revoked_at: now,
          revoked_by_user_id: callerId,
          notes: revocationNotes,
        }
      );

      await writeAuditLog(
        base44,
        callerId,
        "ce_practitioner_certification_revoked",
        "A Certified CE practitioner record was revoked.",
        existingCertification.id,
        {
          user_id: subject.userId,
          source_cohort_id:
            existingCertification.source_cohort_id || null,
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
      {
        ok: false,
        error: "Unsupported certification-management action.",
      },
      { status: 400 }
    );
  } catch (error: unknown) {
    const status =
      error instanceof RequestError ? error.status : 500;

    if (!(error instanceof RequestError)) {
      console.error(
        "[manageCEPractitionerCertification] Unexpected error:",
        error instanceof Error ? error.message : error
      );
    }

    return Response.json(
      {
        ok: false,
        error:
          error instanceof RequestError
            ? error.message
            : "CE practitioner certification could not be managed. Please try again or contact a Platform Owner.",
      },
      { status }
    );
  }
});
