import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

const CANONICAL_STAFF_ACCESS: Record<string, string> = {
  admin: "admin",
  management: "staff",
  employee: "staff",
};

const ASSESSMENT_STATUSES = new Set(["in_progress", "completed"]);
const COHORT_INSTRUCTOR_ROLE = "ce_instructor";
const COHORT_INSTRUCTOR_ACCESS = "ce_training_portal";

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

function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.getPrototypeOf(value) === Object.prototype
  );
}

function isActive(record: any) {
  return record?.is_active !== false && record?.is_archived !== true;
}

function getCanonicalStaffRole(user: any) {
  const role = normalizeText(user?.role).toLowerCase();
  const accessLevel = normalizeText(user?.access_level).toLowerCase();
  return CANONICAL_STAFF_ACCESS[role] === accessLevel ? role : "";
}

function getCallerProfile(user: any) {
  const staffRole = getCanonicalStaffRole(user);
  if (staffRole) {
    return { type: "staff" as const, role: staffRole };
  }

  if (
    normalizeText(user?.role).toLowerCase() === COHORT_INSTRUCTOR_ROLE &&
    normalizeText(user?.access_level).toLowerCase() === COHORT_INSTRUCTOR_ACCESS
  ) {
    return { type: "ce_instructor" as const, role: COHORT_INSTRUCTOR_ROLE };
  }

  return null;
}

function validatePayloadSize(value: unknown, label: string, maximumLength: number) {
  let serialized = "";

  try {
    serialized = JSON.stringify(value ?? null);
  } catch {
    throw new RequestError(400, `${label} contains unsupported data.`);
  }

  if (serialized.length > maximumLength) {
    throw new RequestError(
      400,
      `${label} is too large to save. Remove unnecessary content and try again.`
    );
  }
}

function normalizeAssessmentPayload(body: any) {
  const assessmentId = normalizeText(body?.assessment_id);
  const clientId = normalizeText(body?.client_id);
  const assessmentType = normalizeText(body?.assessment_type);
  const status = normalizeText(body?.status).toLowerCase();
  const responses = body?.responses;
  const structuredEvidence = body?.structured_evidence;
  const sourceMetadata = body?.source_metadata;
  const staffReviewFlags = body?.staff_review_flags;

  if (!clientId || !assessmentType || !status) {
    throw new RequestError(
      400,
      "Choose a client, assessment type, and save status before saving."
    );
  }

  if (assessmentType.length > 160) {
    throw new RequestError(400, "Assessment type is invalid.");
  }

  if (!ASSESSMENT_STATUSES.has(status)) {
    throw new RequestError(400, "Choose a valid assessment save status.");
  }

  if (!isPlainObject(responses)) {
    throw new RequestError(400, "Assessment responses must be a structured response object.");
  }

  if (Object.keys(responses).length > 500) {
    throw new RequestError(400, "Assessment has too many response fields to save.");
  }

  if (structuredEvidence !== undefined && !Array.isArray(structuredEvidence)) {
    throw new RequestError(400, "Structured evidence must be a list.");
  }

  if (sourceMetadata !== undefined && !isPlainObject(sourceMetadata)) {
    throw new RequestError(400, "Assessment source metadata must be a structured object.");
  }

  if (staffReviewFlags !== undefined && !Array.isArray(staffReviewFlags)) {
    throw new RequestError(400, "Staff review flags must be a list.");
  }

  validatePayloadSize(responses, "Assessment responses", 250000);
  validatePayloadSize(structuredEvidence ?? [], "Structured evidence", 250000);
  validatePayloadSize(sourceMetadata ?? {}, "Assessment source metadata", 100000);
  validatePayloadSize(staffReviewFlags ?? [], "Staff review flags", 100000);

  return {
    assessmentId,
    clientId,
    assessmentType,
    status,
    responses,
    structuredEvidence: structuredEvidence ?? [],
    sourceMetadata: sourceMetadata ?? {},
    staffReviewFlags: staffReviewFlags ?? [],
  };
}

async function resolveCallerContext(base44: any, authenticatedUserId: string) {
  const caller = await base44.asServiceRole.entities.User.get(
    authenticatedUserId
  ).catch(() => null);

  if (!caller || !isActive(caller)) {
    throw new RequestError(403, "Your account is inactive or unavailable.");
  }

  const callerId = normalizeText(caller?.id);
  const organizationId = normalizeText(caller?.org_id);
  const profile = getCallerProfile(caller);

  if (!callerId || !organizationId || !profile) {
    throw new RequestError(
      403,
      "You are not authorized to access client assessments."
    );
  }

  const organization = await base44.asServiceRole.entities.Organization.get(
    organizationId
  ).catch(() => null);

  if (!organization || !isActive(organization)) {
    throw new RequestError(403, "Your organization is inactive or unavailable.");
  }

  return { caller, callerId, organizationId, profile };
}

async function assertCallerMayAccessClient(
  base44: any,
  context: any,
  clientId: string
) {
  const client = await base44.asServiceRole.entities.Client.get(clientId)
    .catch(() => null);

  if (
    !client ||
    !isActive(client) ||
    normalizeText(client?.org_id) !== context.organizationId
  ) {
    throw new RequestError(
      404,
      "The selected client was not found in your organization."
    );
  }

  if (context.profile.type === "staff") {
    if (context.profile.role === "admin") return client;

    const assignedStaffId = normalizeText(client?.assigned_employee_id);
    if (!assignedStaffId) {
      throw new RequestError(
        403,
        "This client must be assigned to a staff member before assessments can be accessed."
      );
    }

    const assignedStaff = await base44.asServiceRole.entities.User.get(
      assignedStaffId
    ).catch(() => null);

    if (
      !assignedStaff ||
      !isActive(assignedStaff) ||
      normalizeText(assignedStaff?.id) !== assignedStaffId ||
      normalizeText(assignedStaff?.org_id) !== context.organizationId ||
      !getCanonicalStaffRole(assignedStaff)
    ) {
      throw new RequestError(
        403,
        "The client is assigned to a staff member who is unavailable in your organization."
      );
    }

    if (assignedStaffId === context.callerId) return client;

    if (context.profile.role !== "management") {
      throw new RequestError(
        403,
        "You may access assessments only for clients assigned to you."
      );
    }

    const assignments =
      await base44.asServiceRole.entities.ManagerEmployeeAssignment.filter({
        org_id: context.organizationId,
        manager_user_id: context.callerId,
        employee_user_id: assignedStaffId,
      });

    const managesAssignedStaff = asArray(assignments).some(
      (assignment: any) =>
        assignment?.is_active === true &&
        assignment?.is_archived !== true &&
        normalizeText(assignment?.org_id) === context.organizationId &&
        normalizeText(assignment?.manager_user_id) === context.callerId &&
        normalizeText(assignment?.employee_user_id) === assignedStaffId
    );

    if (!managesAssignedStaff) {
      throw new RequestError(
        403,
        "You may access assessments only for clients assigned to an active direct-report staff member."
      );
    }

    return client;
  }

  const cohortId = normalizeText(client?.cohort_id);
  const assignedInstructorId = normalizeText(client?.assigned_instructor_id);

  if (!cohortId) {
    throw new RequestError(
      403,
      "This CE training client is not connected to an active cohort."
    );
  }

  if (assignedInstructorId === context.callerId) return client;

  const memberships =
    await base44.asServiceRole.entities.CETrainingCohortMember.filter({
      org_id: context.organizationId,
      cohort_id: cohortId,
      user_id: context.callerId,
      is_active: true,
    });

  const hasCohortAuthority = asArray(memberships).some(
    (membership: any) =>
      membership?.is_active !== false &&
      membership?.is_archived !== true &&
      normalizeText(membership?.org_id) === context.organizationId &&
      normalizeText(membership?.cohort_id) === cohortId &&
      normalizeText(membership?.user_id) === context.callerId &&
      ["manager", "trainer"].includes(
        normalizeText(membership?.cohort_role).toLowerCase()
      )
  );

  if (!hasCohortAuthority) {
    throw new RequestError(
      403,
      "You are not authorized to access assessments for this CE training client."
    );
  }

  return client;
}

function projectAssessment(record: any) {
  return {
    id: normalizeText(record?.id),
    org_id: normalizeText(record?.org_id),
    client_id: normalizeText(record?.client_id),
    assessment_type: normalizeText(record?.assessment_type),
    status: normalizeText(record?.status) || "in_progress",
    responses: isPlainObject(record?.responses) ? record.responses : {},
    structured_evidence: asArray(record?.structured_evidence),
    source_metadata: isPlainObject(record?.source_metadata)
      ? record.source_metadata
      : {},
    staff_review_flags: asArray(record?.staff_review_flags),
    completed_by: normalizeText(record?.completed_by),
    completed_at: normalizeText(record?.completed_at),
    pdf_url: normalizeText(record?.pdf_url),
    notes: normalizeText(record?.notes),
    created_date: normalizeText(record?.created_date),
    updated_date: normalizeText(record?.updated_date),
  };
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json(
        { ok: false, error: "This route accepts POST requests only." },
        { status: 405 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const action = normalizeText(body?.action).toLowerCase();

    if (!["list", "upsert"].includes(action)) {
      throw new RequestError(400, "Choose a valid assessment action.");
    }

    const base44 = createClientFromRequest(req);
    const authenticatedUser = await base44.auth.me().catch(() => null);

    if (!authenticatedUser?.id) {
      throw new RequestError(401, "Please sign in before accessing client assessments.");
    }

    const context = await resolveCallerContext(base44, authenticatedUser.id);
    const clientId = normalizeText(body?.client_id);

    if (!clientId) {
      throw new RequestError(400, "Choose a client before accessing assessments.");
    }

    await assertCallerMayAccessClient(base44, context, clientId);

    if (action === "list") {
      const records = asArray(
        await base44.asServiceRole.entities.Assessment.filter(
          { client_id: clientId },
          "-updated_date"
        )
      )
        .filter(
          (record: any) =>
            isActive(record) &&
            normalizeText(record?.org_id) === context.organizationId &&
            normalizeText(record?.client_id) === clientId
        )
        .map(projectAssessment);

      return Response.json({ ok: true, assessments: records });
    }

    const payload = normalizeAssessmentPayload(body);

    if (payload.clientId !== clientId) {
      throw new RequestError(400, "Assessment client information did not match the request.");
    }

    let existingRecord: any = null;

    if (payload.assessmentId) {
      existingRecord = await base44.asServiceRole.entities.Assessment.get(
        payload.assessmentId
      ).catch(() => null);

      if (
        !existingRecord ||
        !isActive(existingRecord) ||
        normalizeText(existingRecord?.org_id) !== context.organizationId ||
        normalizeText(existingRecord?.client_id) !== clientId
      ) {
        throw new RequestError(
          404,
          "The assessment you are trying to update was not found for this client."
        );
      }
    }

    const savedAt = new Date().toISOString();
    const recordPayload: Record<string, unknown> = {
      org_id: context.organizationId,
      client_id: clientId,
      assessment_type: payload.assessmentType,
      status: payload.status,
      responses: payload.responses,
      structured_evidence: payload.structuredEvidence,
      source_metadata: payload.sourceMetadata,
      staff_review_flags: payload.staffReviewFlags,
      completed_by: normalizeText(context.caller?.email) || context.callerId,
    };

    if (payload.status === "completed") {
      recordPayload.completed_at = savedAt;
    }

    const savedRecord = existingRecord
      ? await base44.asServiceRole.entities.Assessment.update(
          existingRecord.id,
          recordPayload
        )
      : await base44.asServiceRole.entities.Assessment.create(recordPayload);

    return Response.json({
      ok: true,
      assessment: projectAssessment(savedRecord),
    });
  } catch (error: any) {
    if (!(error instanceof RequestError)) {
      console.error(
        "manageAuthorizedAssessment error:",
        error?.message || error
      );
    }

    return Response.json(
      {
        ok: false,
        error:
          error instanceof RequestError
            ? error.message
            : "Client assessments could not be saved. Please try again or contact your organization administrator.",
      },
      { status: error instanceof RequestError ? error.status : 500 }
    );
  }
});