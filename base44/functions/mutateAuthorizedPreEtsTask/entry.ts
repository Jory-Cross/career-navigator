import { createClientFromRequest } from "npm:@base44/sdk@0.8.23";

const SUPPORTED_ACTIONS = new Set([
  "complete_student_task",
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

function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function isActive(record: any) {
  return record?.is_active !== false && record?.is_archived !== true;
}

function isPreEtsClientInOrganization(
  client: any,
  organizationId: string
) {
  return (
    isActive(client) &&
    normalizeText(client?.org_id) === organizationId &&
    normalizeText(client?.client_type).toLowerCase() === "pre_ets"
  );
}

function projectTask(task: any) {
  return {
    id: normalizeText(task?.id),
    title: normalizeText(task?.title),
    description: normalizeText(task?.description),
    status: normalizeText(task?.status) || "pending",
    priority: normalizeText(task?.priority) || "medium",
    due_date: normalizeText(task?.due_date),
    category: normalizeText(task?.category),
    checklist: asArray(task?.checklist).map((item: any) => ({
      text: normalizeText(item?.text),
      completed: item?.completed === true,
    })),
    client_completed_at: normalizeText(task?.client_completed_at),
    created_date: normalizeText(task?.created_date),
  };
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json(
        { error: "Method not allowed." },
        { status: 405 }
      );
    }

    const base44 = createClientFromRequest(req);
    const authenticatedUser = await base44.auth.me();

    if (!authenticatedUser?.id) {
      return Response.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    const requestBody = await req.json().catch(() => ({}));
    const action = normalizeText(requestBody?.action);

    if (!SUPPORTED_ACTIONS.has(action)) {
      return Response.json(
        { error: "Unsupported action." },
        { status: 400 }
      );
    }

    const caller = await base44.asServiceRole.entities.User.get(
      authenticatedUser.id
    ).catch(() => null);

    if (!caller || !isActive(caller)) {
      throw new RequestError(
        403,
        "Authenticated user record was not found or is inactive."
      );
    }

    const callerRole = normalizeText(caller?.role).toLowerCase();
    const callerAccessLevel = normalizeText(
      caller?.access_level
    ).toLowerCase();
    const organizationId = normalizeText(caller?.org_id);
    const linkedClientId = normalizeText(caller?.linked_client_id);

    if (
      callerRole !== "pre_ets" ||
      callerAccessLevel !== "client_portal"
    ) {
      throw new RequestError(
        403,
        "You are not authorized to complete Pre-ETS student tasks."
      );
    }

    if (!organizationId || !linkedClientId) {
      throw new RequestError(
        403,
        "Your account is not linked to an active Pre-ETS student record."
      );
    }

    const organization = await base44.asServiceRole.entities.Organization.get(
      organizationId
    ).catch(() => null);

    if (!organization || !isActive(organization)) {
      throw new RequestError(
        403,
        "Your organization assignment is invalid or inactive."
      );
    }

    const client = await base44.asServiceRole.entities.Client.get(
      linkedClientId
    ).catch(() => null);

    if (!isPreEtsClientInOrganization(client, organizationId)) {
      throw new RequestError(
        403,
        "Your Pre-ETS student record is unavailable or no longer active."
      );
    }

    const taskId = normalizeText(requestBody?.task_id);

    if (!taskId) {
      throw new RequestError(400, "task_id is required.");
    }

    const task = await base44.asServiceRole.entities.Task.get(
      taskId
    ).catch(() => null);

        const assignedClientIds = asArray<string>(task?.client_ids)
      .map((clientId) => normalizeText(clientId))
      .filter(Boolean);

    if (
      !task ||
      !isActive(task) ||
      normalizeText(task?.org_id) !== organizationId ||
      task?.assigned_to_client !== true ||
      !assignedClientIds.includes(linkedClientId)
    ) {
      throw new RequestError(404, "Assigned student task not found.");
    }

    if (assignedClientIds.length !== 1) {
      throw new RequestError(
        409,
        "This task is assigned to multiple students and cannot be completed from the student portal until separate per-student completion is supported."
      );
    }

    const currentStatus =
      normalizeText(task?.status).toLowerCase() || "pending";

    if (currentStatus === "cancelled") {
      throw new RequestError(
        409,
        "Cancelled tasks cannot be completed."
      );
    }

    if (currentStatus === "completed") {
      return Response.json({
        ok: true,
        action,
        already_completed: true,
        task: projectTask(task),
      });
    }

    const updated = await base44.asServiceRole.entities.Task.update(
      taskId,
      {
        status: "completed",
        client_completed_at: new Date().toISOString(),
      }
    );

    return Response.json({
      ok: true,
      action,
      already_completed: false,
      task: projectTask(updated),
    });
  } catch (error: any) {
    const status =
      error instanceof RequestError ? error.status : 500;

    const message =
      error instanceof RequestError
        ? error.message
        : error?.message ||
          "Unable to complete the Pre-ETS student task.";

    if (!(error instanceof RequestError)) {
      console.error(
        "mutateAuthorizedPreEtsTask error:",
        error?.message || error
      );
    }

    return Response.json(
      { error: message },
      { status }
    );
  }
});
