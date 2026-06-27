import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

const PLATFORM_OWNER_ROLE = "platform_owner";

const PAID_OR_WAIVED_EVENT_STATUSES = new Set(["paid", "waived"]);

const TRAINING_REGISTRATION_FEE_KINDS = new Set([
  "training_registration",
  "training_reactivation",
]);

const TEST_WAIVER_AMOUNT_CENTS = 4900;

function getRequiredString(value: unknown, fieldName: string) {
  const normalized = String(value || "").trim();

  if (!normalized) {
    throw new Error(`${fieldName} is required.`);
  }

  return normalized;
}

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function getStudentDisplayName(student: any) {
  return (
    String(student?.full_name || "").trim() ||
    String(student?.email || "").trim() ||
    "CE student"
  );
}

async function writeAuditLog(
  base44: any,
  actorUserId: string,
  billingEventId: string,
  details: Record<string, unknown>
) {
  try {
    await base44.asServiceRole.entities.PlatformAuditLog.create({
      platform_admin_user_id: actorUserId,
      event_key: "ce_student_test_registration_waived",
      event_summary:
        "A CE student test registration waiver was recorded for end-to-end platform testing.",
      actor_type: "platform_admin",
      target_entity: "OrganizationBillingEvent",
      target_record_id: billingEventId,
      tenant_visible: false,
      occurred_at: new Date().toISOString(),
      details,
    });
  } catch (error) {
    console.error(
      "recordCEStudentTestRegistrationWaiver audit error:",
      error?.message || error
    );
  }
}

/**
 * recordCEStudentTestRegistrationWaiver
 *
 * Creates one auditable waived CE student registration event for internal
 * end-to-end testing. This is intentionally not a false paid event.
 *
 * Required request body:
 * {
 *   action: "record_test_waiver",
 *   cohort_id: "...",
 *   user_id: "...",
 *   waiver_reason: "..."
 * }
 *
 * Authority:
 * - Active Platform Owner only.
 *
 * Validation:
 * - Target is an active CE student.
 * - Target has an active member enrollment in the specified training cohort.
 * - Target and cohort belong to the same organization.
 * - No settled registration/re-activation event already exists for that
 *   student and cohort.
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

    const platformAdminRows =
      await base44.asServiceRole.entities.PlatformAdmin.filter({
        user_id: actor.id,
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

    if (!platformRoles.includes(PLATFORM_OWNER_ROLE)) {
      return Response.json(
        {
          ok: false,
          error:
            "Only an active Platform Owner may record a CE student test registration waiver.",
        },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));

    const action = String(body?.action || "").trim();

    if (action !== "record_test_waiver") {
      return Response.json(
        {
          ok: false,
          error: "Only the record_test_waiver action is supported.",
        },
        { status: 400 }
      );
    }

    const cohortId = getRequiredString(body?.cohort_id, "cohort_id");
    const studentUserId = getRequiredString(body?.user_id, "user_id");
    const waiverReason = getRequiredString(
      body?.waiver_reason,
      "waiver_reason"
    );

    const [
      cohortRows,
      studentRows,
      membershipRows,
      organizationRows,
      existingBillingRows,
    ] = await Promise.all([
      base44.asServiceRole.entities.CETrainingCohort.filter({
        id: cohortId,
      }),
      base44.asServiceRole.entities.User.filter({
        id: studentUserId,
      }),
      base44.asServiceRole.entities.CETrainingCohortMember.filter({
        cohort_id: cohortId,
        user_id: studentUserId,
        cohort_role: "member",
        is_active: true,
      }),
      base44.asServiceRole.entities.Organization.list(),
      base44.asServiceRole.entities.OrganizationBillingEvent.filter({
        subject_user_id: studentUserId,
        cohort_id: cohortId,
      }),
    ]);

    const cohort = Array.isArray(cohortRows) ? cohortRows[0] : null;
    const student = Array.isArray(studentRows) ? studentRows[0] : null;
    const membership = Array.isArray(membershipRows)
      ? membershipRows[0]
      : null;

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
            "A test registration waiver may only be recorded for a Training cohort.",
        },
        { status: 409 }
      );
    }

    if (!student) {
      return Response.json(
        { ok: false, error: "CE student account not found." },
        { status: 404 }
      );
    }

    if (student.is_active === false || student.role !== "ce_student") {
      return Response.json(
        {
          ok: false,
          error:
            "A test registration waiver may only be recorded for an active CE student account.",
        },
        { status: 409 }
      );
    }

    if (student.org_id && cohort.org_id && student.org_id !== cohort.org_id) {
      return Response.json(
        {
          ok: false,
          error:
            "The CE student account belongs to a different organization than this cohort.",
        },
        { status: 409 }
      );
    }

    if (!membership) {
      return Response.json(
        {
          ok: false,
          error:
            "The CE student must first be an active member of this training cohort.",
        },
        { status: 409 }
      );
    }

    const organizations = Array.isArray(organizationRows)
      ? organizationRows
      : [];

    const organization =
      organizations.find((row) => row?.id === cohort.org_id) ||
      organizations.find((row) => row?.tenant_key === cohort.org_id) ||
      null;

    if (!organization?.id) {
      return Response.json(
        {
          ok: false,
          error:
            "The canonical Organization record for this cohort could not be resolved.",
        },
        { status: 409 }
      );
    }

    const existingEvents = Array.isArray(existingBillingRows)
      ? existingBillingRows
      : [];

    const existingSettledEvent = existingEvents.find(
      (event) =>
        event?.billing_subject_type === "student" &&
        TRAINING_REGISTRATION_FEE_KINDS.has(event?.fee_kind) &&
        PAID_OR_WAIVED_EVENT_STATUSES.has(event?.event_status)
    );

    if (existingSettledEvent) {
      return Response.json({
        ok: true,
        action,
        already_settled: true,
        message:
          "This CE student already has a settled registration or reactivation event for this cohort.",
        billing_event: {
          id: existingSettledEvent.id,
          event_status: existingSettledEvent.event_status,
          fee_kind: existingSettledEvent.fee_kind,
          cohort_id: existingSettledEvent.cohort_id,
          subject_user_id: existingSettledEvent.subject_user_id,
        },
      });
    }

    const existingUnsettledEvent = existingEvents.find(
      (event) =>
        event?.billing_subject_type === "student" &&
        TRAINING_REGISTRATION_FEE_KINDS.has(event?.fee_kind)
    );

    if (existingUnsettledEvent) {
      return Response.json(
        {
          ok: false,
          error:
            "A non-settled student registration event already exists for this cohort. Resolve that billing event instead of creating a test waiver.",
          existing_event_status: existingUnsettledEvent.event_status,
        },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();

    const billingEventKey = [
      "test_waived_training_registration",
      cohortId,
      studentUserId,
    ].join(":");

    const createdBillingEvent =
      await base44.asServiceRole.entities.OrganizationBillingEvent.create({
        organization_id: organization.id,
        billing_event_key: billingEventKey,
        fee_kind: "training_registration",
        event_status: "waived",
        billing_subject_type: "student",
        subject_user_id: studentUserId,
        subject_verified_email: normalizeEmail(student.email),
        cohort_id: cohortId,
        feature_key: "ce_student_seats",
        quantity: 1,
        unit_amount_cents: TEST_WAIVER_AMOUNT_CENTS,
        amount_cents: TEST_WAIVER_AMOUNT_CENTS,
        currency: "USD",
        triggered_at: now,
        waived_at: now,
        waived_by_user_id: actor.id,
        waiver_reason: waiverReason,
        notes:
          "Internal CE end-to-end test registration waiver. No payment was collected.",
      });

    await writeAuditLog(base44, actor.id, createdBillingEvent.id, {
      cohort_id: cohortId,
      cohort_name: cohort.name || null,
      student_user_id: studentUserId,
      student_name: getStudentDisplayName(student),
      student_email: normalizeEmail(student.email),
      organization_id: organization.id,
      organization_tenant_key: organization.tenant_key || null,
      billing_event_key: billingEventKey,
      waiver_reason: waiverReason,
      amount_cents: TEST_WAIVER_AMOUNT_CENTS,
    });

    return Response.json({
      ok: true,
      action,
      already_settled: false,
      message: `${getStudentDisplayName(
        student
      )} now has an authorized test registration waiver for this training cohort.`,
      billing_event: {
        id: createdBillingEvent.id,
        billing_event_key: billingEventKey,
        event_status: "waived",
        fee_kind: "training_registration",
        billing_subject_type: "student",
        subject_user_id: studentUserId,
        cohort_id: cohortId,
        amount_cents: TEST_WAIVER_AMOUNT_CENTS,
        currency: "USD",
        waived_at: now,
      },
    });
  } catch (error) {
    console.error(
      "recordCEStudentTestRegistrationWaiver error:",
      error?.message || error
    );

    return Response.json(
      {
        ok: false,
        error:
          error?.message ||
          "Unable to record the CE student test registration waiver.",
      },
      { status: 500 }
    );
  }
});
