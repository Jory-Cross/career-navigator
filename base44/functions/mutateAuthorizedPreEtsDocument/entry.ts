import { createClientFromRequest } from "npm:@base44/sdk@0.8.23";

const SUPPORTED_ACTIONS = new Set([
  "create_student_document",
]);

const ALLOWED_STUDENT_CATEGORIES = new Set([
  "resume",
  "cover_letter",
  "certification",
  "portfolio",
  "other",
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

function limitText(value: unknown, maximumLength: number) {
  return normalizeText(value).slice(0, maximumLength);
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

function projectDocument(document: any) {
  return {
    id: normalizeText(document?.id),
    client_id: normalizeText(document?.client_id),
    title: normalizeText(document?.title),
    file_url: normalizeText(document?.file_url),
    file_name: normalizeText(document?.file_name),
    file_size: Number(document?.file_size) || 0,
    file_type: normalizeText(document?.file_type),
    category: normalizeText(document?.category) || "other",
    document_subtype: normalizeText(document?.document_subtype),
    visibility: normalizeText(document?.visibility),
    created_date: normalizeText(document?.created_date),
  };
}

function buildStudentDocumentPayload(
  rawDocument: any,
  clientId: string,
  organizationId: string
) {
  const fileUrl = limitText(rawDocument?.file_url, 5000);
  const fileName = limitText(rawDocument?.file_name, 500);
  const title =
    limitText(rawDocument?.title, 500) || fileName;
  const fileType = limitText(rawDocument?.file_type, 255);
  const requestedCategory = normalizeText(
    rawDocument?.category
  ).toLowerCase();

  const category =
    requestedCategory && ALLOWED_STUDENT_CATEGORIES.has(requestedCategory)
      ? requestedCategory
      : "other";

  const rawFileSize = Number(rawDocument?.file_size);

  if (!fileUrl) {
    throw new RequestError(400, "file_url is required.");
  }

  if (!title) {
    throw new RequestError(
      400,
      "A document title or file name is required."
    );
  }

  if (
    rawDocument?.file_size !== undefined &&
    rawDocument?.file_size !== null &&
    (!Number.isFinite(rawFileSize) || rawFileSize < 0)
  ) {
    throw new RequestError(
      400,
      "file_size must be a non-negative number."
    );
  }

  return {
    org_id: organizationId,
    client_id: clientId,
    title,
    file_url: fileUrl,
    file_name: fileName || title,
    file_size: Number.isFinite(rawFileSize) ? rawFileSize : 0,
    file_type: fileType,
    category,
    document_subtype: "student_upload",
    source_type: "PreEtsStudentPortal",
    is_generated: false,
    is_archived: false,
    visibility: "both",
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
        "You are not authorized to upload Pre-ETS student documents."
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

    const payload = buildStudentDocumentPayload(
      requestBody?.document,
      linkedClientId,
      organizationId
    );

    const document = await base44.asServiceRole.entities.Document.create(
      payload
    );

    await base44.asServiceRole.entities.Activity.create({
      org_id: organizationId,
      client_id: linkedClientId,
      activity_type: "document_uploaded",
      title: "Pre-ETS student document uploaded",
      description: `${payload.title} was uploaded through the Pre-ETS student portal.`,
      metadata: {
        related_entity_id: normalizeText(document?.id),
        related_entity_type: "Document",
      },
    });

    return Response.json({
      ok: true,
      action,
      document: projectDocument(document),
    });
  } catch (error: any) {
    const status =
      error instanceof RequestError ? error.status : 500;

    const message =
      error instanceof RequestError
        ? error.message
        : error?.message ||
          "Unable to upload the Pre-ETS student document.";

    if (!(error instanceof RequestError)) {
      console.error(
        "mutateAuthorizedPreEtsDocument error:",
        error?.message || error
      );
    }

    return Response.json(
      { error: message },
      { status }
    );
  }
});
