import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

const CANONICAL_STAFF_ACCESS: Record<string, string> = {
  admin: "admin",
  management: "staff",
  employee: "staff",
};

const VALID_STATUSES = new Set([
  "untested",
  "emerging",
  "supported",
  "needs_validation",
  "refuted",
  "archived",
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

function isActive(record: any) {
  return record?.is_active !== false && record?.is_archived !== true;
}

function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function getCanonicalStaffRole(user: any) {
  const role = normalizeText(user?.role).toLowerCase();
  const accessLevel = normalizeText(user?.access_level).toLowerCase();
  return CANONICAL_STAFF_ACCESS[role] === accessLevel ? role : "";
}

async function resolveCallerContext(base44: any, authenticatedUserId: string) {
  const caller = await base44.asServiceRole.entities.User.get(
    authenticatedUserId
  ).catch(() => null);

  if (!caller || !isActive(caller)) {
    throw new RequestError(403, "Your account is inactive or unavailable.");
  }

  const callerId = normalizeText(caller?.id);
  const role = getCanonicalStaffRole(caller);
  const organizationId = normalizeText(caller?.org_id);

  if (!callerId || !role || !organizationId) {
    throw new RequestError(
      403,
      "You are not authorized to update vocational theme candidate status."
    );
  }

  const organization = await base44.asServiceRole.entities.Organization.get(
    organizationId
  ).catch(() => null);

  if (!organization || !isActive(organization)) {
    throw new RequestError(403, "Your organization is inactive or unavailable.");
  }

  return {
    caller,
    callerId,
    role,
    organizationId,
  };
}

async function assertCallerMayAccessClient(
  base44: any,
  context: any,
  client: any
) {
  if (!isActive(client) || normalizeText(client?.org_id) !== context.organizationId) {
    throw new RequestError(
      404,
      "The selected client was not found in your organization."
    );
  }

  if (context.role === "admin") return;

  const assignedStaffId = normalizeText(client?.assigned_employee_id);
  if (!assignedStaffId) {
    throw new RequestError(
      403,
      "This client must be assigned to staff before vocational theme status can be updated."
    );
  }

  const assignedStaff = await base44.asServiceRole.entities.User.get(
    assignedStaffId
  ).catch(() => null);

  if (
    !assignedStaff ||
    !isActive(assignedStaff) ||
    normalizeText(assignedStaff?.org_id) !== context.organizationId ||
    !getCanonicalStaffRole(assignedStaff)
  ) {
    throw new RequestError(
      403,
      "The client is assigned to a staff member who is unavailable in your organization."
    );
  }

  if (assignedStaffId === context.callerId) return;

  if (context.role !== "management") {
    throw new RequestError(
      403,
      "You may update vocational theme status only for clients assigned to you."
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
      "You may update vocational theme status only for clients assigned to an active direct-report staff member."
    );
  }
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json(
        { ok: false, error: "This route accepts POST requests only." },
        { status: 405 }
      );
    }

    const payload = await req.json().catch(() => ({}));
    const clientId = normalizeText(payload?.client_id);
    const candidateThemeName = normalizeText(payload?.candidate_theme_name);
    const categoryLabel = normalizeText(payload?.category_label);
    const status = normalizeText(payload?.status).toLowerCase();
    const statusNotes = normalizeText(payload?.status_notes).slice(0, 5000);

    if (!clientId || !candidateThemeName || !categoryLabel || !status) {
      throw new RequestError(
        400,
        "Choose a client, candidate theme, category, and status before saving."
      );
    }

    if (!VALID_STATUSES.has(status)) {
      throw new RequestError(
        400,
        "Choose a valid vocational theme candidate status."
      );
    }

    const base44 = createClientFromRequest(req);
    const authenticatedUser = await base44.auth.me().catch(() => null);

    if (!authenticatedUser?.id) {
      throw new RequestError(
        401,
        "Please sign in before updating vocational theme status."
      );
    }

    const context = await resolveCallerContext(base44, authenticatedUser.id);
    const client = await base44.asServiceRole.entities.Client.get(clientId)
      .catch(() => null);

    await assertCallerMayAccessClient(base44, context, client);

    const statusData = {
      org_id: context.organizationId,
      client_id: clientId,
      candidate_theme_name: candidateThemeName,
      category_label: categoryLabel,
      status,
      status_date: new Date().toISOString().slice(0, 10),
      status_notes: statusNotes,
      reviewer_user_id: context.callerId,
      reviewer_role: context.role,
      is_active: true,
    };

    const matchingRecords = asArray(
      await base44.asServiceRole.entities.VocationalThemeCandidateStatus.filter({
        org_id: context.organizationId,
        client_id: clientId,
        candidate_theme_name: candidateThemeName,
        category_label: categoryLabel,
        is_active: true,
      })
    ).filter(
      (record: any) =>
        normalizeText(record?.org_id) === context.organizationId &&
        normalizeText(record?.client_id) === clientId &&
        normalizeText(record?.candidate_theme_name) === candidateThemeName &&
        normalizeText(record?.category_label) === categoryLabel &&
        record?.is_active !== false &&
        record?.is_archived !== true
    );

    if (matchingRecords.length > 1) {
      throw new RequestError(
        409,
        "More than one active candidate-status record exists. Administrator review is required before updating this theme."
      );
    }

    const existingRecord = matchingRecords[0] || null;
    const statusRecord = existingRecord
      ? await base44.asServiceRole.entities.VocationalThemeCandidateStatus.update(
          existingRecord.id,
          statusData
        )
      : await base44.asServiceRole.entities.VocationalThemeCandidateStatus.create(
          statusData
        );

    return Response.json({
      ok: true,
      status_id: statusRecord.id,
      status: statusRecord.status,
      message: "Vocational theme candidate status was saved.",
    });
  } catch (error: any) {
    if (!(error instanceof RequestError)) {
      console.error(
        "saveVocationalThemeCandidateStatus error:",
        error?.message || error
      );
    }

    return Response.json(
      {
        ok: false,
        error:
          error instanceof RequestError
            ? error.message
            : "Vocational theme candidate status could not be saved.",
      },
      {
        status: error instanceof RequestError ? error.status : 500,
      }
    );
  }
});