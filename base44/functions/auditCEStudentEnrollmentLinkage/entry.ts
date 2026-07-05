import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

const PLATFORM_OWNER_ROLE = "platform_owner";
const SAMPLE_LIMIT = 50;
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

function maskEmail(value: unknown) {
  const email = normalizeEmail(value);
  const [localPart, domain] = email.split("@");

  if (!localPart || !domain) return "";

  const localHint = localPart.length <= 2
    ? localPart.slice(0, 1)
    : localPart.slice(0, 2);
  const [domainName, ...domainSuffix] = domain.split(".");
  const suffix = domainSuffix.length ? `.${domainSuffix.join(".")}` : "";

  return `${localHint}•••@${domainName.slice(0, 2)}•••${suffix}`;
}

function pushSample(samples: any[], sample: any) {
  if (samples.length < SAMPLE_LIMIT) samples.push(sample);
}

async function requireCanonicalPlatformOwner(
  base44: any,
  authenticatedUserId: string
) {
  const caller = await base44.asServiceRole.entities.User.get(
    authenticatedUserId
  ).catch(() => null);

  if (
    !caller ||
    !isActive(caller) ||
    normalizeText(caller?.role).toLowerCase() !== "admin" ||
    normalizeText(caller?.access_level).toLowerCase() !== "admin"
  ) {
    throw new RequestError(
      403,
      "Canonical Platform Owner access is required to review CE enrollment linkage."
    );
  }

  const platformAdminRows = await base44.asServiceRole.entities.PlatformAdmin.filter({
    user_id: caller.id,
  });

  const isPlatformOwner = asArray(platformAdminRows).some(
    (record: any) =>
      isActive(record) &&
      normalizeText(record?.user_id) === normalizeText(caller?.id) &&
      normalizeText(record?.platform_role).toLowerCase() === PLATFORM_OWNER_ROLE
  );

  if (!isPlatformOwner) {
    throw new RequestError(
      403,
      "Canonical Platform Owner access is required to review CE enrollment linkage."
    );
  }
}

function isOpenCEStudentInvitation(invite: any) {
  return (
    invite?.is_archived !== true &&
    normalizeText(invite?.role).toLowerCase() === "ce_student" &&
    normalizeText(invite?.access_level).toLowerCase() === "ce_training_portal" &&
    Boolean(normalizeText(invite?.org_id)) &&
    Boolean(normalizeText(invite?.cohort_id)) &&
    Boolean(normalizeEmail(invite?.email)) &&
    !normalizeText(invite?.client_id)
  );
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json(
        { ok: false, error: "This route accepts POST requests only." },
        { status: 405 }
      );
    }

    await req.json().catch(() => ({}));

    const base44 = createClientFromRequest(req);
    const authenticatedUser = await base44.auth.me().catch(() => null);

    if (!authenticatedUser?.id) {
      return Response.json(
        { ok: false, error: "Please sign in before reviewing CE enrollment linkage." },
        { status: 401 }
      );
    }

    await requireCanonicalPlatformOwner(base44, authenticatedUser.id);

    const [invites, enrollmentRows, billingRows] = await Promise.all([
      base44.asServiceRole.entities.PendingRoleAssignment.list("-created_date"),
      base44.asServiceRole.entities.CETrainingStudentEnrollment.list("-created_date"),
      base44.asServiceRole.entities.OrganizationBillingEvent.list("-created_date"),
    ]);

    const enrollmentsByInvitationId = new Map<string, any[]>();
    for (const enrollment of asArray(enrollmentRows)) {
      const invitationId = normalizeText(enrollment?.pending_role_assignment_id);
      if (!invitationId) continue;

      const rows = enrollmentsByInvitationId.get(invitationId) || [];
      rows.push(enrollment);
      enrollmentsByInvitationId.set(invitationId, rows);
    }

    const billingById = new Map<string, any>();
    for (const billingEvent of asArray(billingRows)) {
      const billingId = normalizeText(billingEvent?.id);
      if (billingId) billingById.set(billingId, billingEvent);
    }

    const summary = {
      ce_student_invitations_reviewed: 0,
      fully_linked: 0,
      missing_or_duplicate_enrollment: 0,
      enrollment_scope_mismatch: 0,
      missing_or_invalid_billing_link: 0,
    };
    const samples = {
      missing_or_duplicate_enrollment: [] as any[],
      enrollment_scope_mismatch: [] as any[],
      missing_or_invalid_billing_link: [] as any[],
    };

    for (const invite of asArray(invites)) {
      if (!isOpenCEStudentInvitation(invite)) continue;

      summary.ce_student_invitations_reviewed += 1;

      const invitationId = normalizeText(invite?.id);
      const organizationId = normalizeText(invite?.org_id);
      const cohortId = normalizeText(invite?.cohort_id);
      const email = normalizeEmail(invite?.email);
      const matchingEnrollments = enrollmentsByInvitationId.get(invitationId) || [];
      const baseSample = {
        pending_role_assignment_id: invitationId || null,
        org_id: organizationId || null,
        cohort_id: cohortId || null,
        student_email_hint: maskEmail(email),
      };

      if (matchingEnrollments.length !== 1) {
        summary.missing_or_duplicate_enrollment += 1;
        pushSample(samples.missing_or_duplicate_enrollment, {
          ...baseSample,
          enrollment_count: matchingEnrollments.length,
        });
        continue;
      }

      const enrollment = matchingEnrollments[0];
      const enrollmentMatches =
        normalizeText(enrollment?.org_id) === organizationId &&
        normalizeText(enrollment?.cohort_id) === cohortId &&
        normalizeEmail(enrollment?.student_email) === email &&
        normalizeText(enrollment?.pending_role_assignment_id) === invitationId;

      if (!enrollmentMatches) {
        summary.enrollment_scope_mismatch += 1;
        pushSample(samples.enrollment_scope_mismatch, {
          ...baseSample,
          enrollment_id: normalizeText(enrollment?.id) || null,
          enrollment_org_id: normalizeText(enrollment?.org_id) || null,
          enrollment_cohort_id: normalizeText(enrollment?.cohort_id) || null,
          enrollment_email_hint: maskEmail(enrollment?.student_email),
        });
        continue;
      }

      const billingEventId = normalizeText(enrollment?.organization_billing_event_id);
      const billingEvent = billingEventId ? billingById.get(billingEventId) || null : null;
      const billingMatches =
        billingEvent &&
        normalizeText(billingEvent?.organization_id) === organizationId &&
        normalizeText(billingEvent?.cohort_id) === cohortId &&
        normalizeEmail(billingEvent?.subject_verified_email) === email &&
        normalizeText(billingEvent?.billing_subject_type).toLowerCase() === "student" &&
        CE_REGISTRATION_FEE_KINDS.has(
          normalizeText(billingEvent?.fee_kind).toLowerCase()
        );

      if (!billingMatches) {
        summary.missing_or_invalid_billing_link += 1;
        pushSample(samples.missing_or_invalid_billing_link, {
          ...baseSample,
          enrollment_id: normalizeText(enrollment?.id) || null,
          billing_event_id: billingEventId || null,
          billing_event_org_id: normalizeText(billingEvent?.organization_id) || null,
          billing_event_cohort_id: normalizeText(billingEvent?.cohort_id) || null,
          billing_event_email_hint: maskEmail(billingEvent?.subject_verified_email),
          billing_event_fee_kind: normalizeText(billingEvent?.fee_kind) || null,
        });
        continue;
      }

      summary.fully_linked += 1;
    }

    return Response.json({
      ok: true,
      preview_only: true,
      generated_at: new Date().toISOString(),
      summary,
      samples,
      instructions:
        "This audit does not change invitations, enrollments, billing events, cohort memberships, roles, or payment state. Only separately reviewed remediation may act on any reported record.",
    });
  } catch (error: any) {
    if (!(error instanceof RequestError)) {
      console.error(
        "auditCEStudentEnrollmentLinkage error:",
        error?.message || error
      );
    }

    return Response.json(
      {
        ok: false,
        error:
          error instanceof RequestError
            ? error.message
            : "Unable to review CE enrollment linkage.",
      },
      { status: error instanceof RequestError ? error.status : 500 }
    );
  }
});
