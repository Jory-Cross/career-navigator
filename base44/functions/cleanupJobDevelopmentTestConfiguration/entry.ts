import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

const COMOP_ORG_ID = "6a3df2c2de44fda1218fa2b4";
const AUTHORIZED_ADMIN_EMAIL = "arbranger@gmail.com";

const JOB_DEVELOPMENT_CODE = "job_development";
const CANONICAL_ENTRY_TYPE_ID = "69d5bc80227279b112f75fe8";

const APPLY_CONFIRMATION =
  "DELETE_DUPLICATE_JOB_DEVELOPMENT_CONFIGURATION";

const EXPECTED_CANONICAL_FIELD_KEYS = [
  "job_goal",
  "month_year",
  "development_date",
  "development_hours",
  "development_activity",
  "activity_outcome",
  "next_steps",
  "summary_information",
  "barriers_to_cie",
];

type RecordLike = Record<string, unknown>;

class RequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeCode(value: unknown) {
  return asString(value).toLowerCase();
}

function belongsToCleanupScope(record: RecordLike) {
  const orgId = asString(record.org_id);

  // Legacy test records may have no org_id.
  // Never touch records explicitly assigned to another organization.
  return !orgId || orgId === COMOP_ORG_ID;
}

function uniqueById(records: RecordLike[]) {
  const byId = new Map<string, RecordLike>();

  for (const record of records) {
    const id = asString(record.id);

    if (id && !byId.has(id)) {
      byId.set(id, record);
    }
  }

  return Array.from(byId.values());
}

function summarizeEntryType(entryType: RecordLike) {
  return {
    id: asString(entryType.id),
    name: asString(entryType.name),
    code: asString(entryType.code),
    org_id: asString(entryType.org_id) || null,
    is_active: entryType.is_active ?? null,
    is_archived: entryType.is_archived ?? null,
  };
}

function summarizeTemplate(template: RecordLike) {
  return {
    id: asString(template.id),
    entry_type_id: asString(template.entry_type_id) || null,
    entry_type_code: asString(template.entry_type_code) || null,
    field_key: asString(template.field_key),
    label: asString(template.label),
    order: template.order ?? null,
    is_active: template.is_active ?? null,
    is_internal_only: template.is_internal_only ?? null,
  };
}

function hasExactCanonicalFieldSet(fieldKeys: string[]) {
  const normalizedKeys = fieldKeys
    .map((key) => normalizeCode(key))
    .filter(Boolean)
    .sort();

  const expectedKeys = [...EXPECTED_CANONICAL_FIELD_KEYS].sort();

  if (normalizedKeys.length !== expectedKeys.length) {
    return false;
  }

  if (new Set(normalizedKeys).size !== expectedKeys.length) {
    return false;
  }

  return expectedKeys.every(
    (expectedKey, index) => normalizedKeys[index] === expectedKey
  );
}

async function readRequestBody(request: Request) {
  if (request.method === "GET") {
    return {};
  }

  try {
    const body = await request.json();

    return body && typeof body === "object"
      ? (body as RecordLike)
      : {};
  } catch {
    return {};
  }
}

async function getAuthorizedOperator(base44: any, service: any) {
  const authenticatedUser = (await base44.auth.me()) as RecordLike | null;

  if (!authenticatedUser?.id) {
    throw new RequestError(401, "Authentication is required.");
  }

  const currentUserId = asString(authenticatedUser.id);

  const possibleUsers = await service.entities.User.filter({
    id: currentUserId,
  });

  const userRecord =
    asArray<RecordLike>(possibleUsers).find(
      (user) => asString(user.id) === currentUserId
    ) || authenticatedUser;

  const email = asString(
    userRecord.email || authenticatedUser.email
  ).toLowerCase();

  const role = asString(
    userRecord.role || authenticatedUser.role
  ).toLowerCase();

  const orgId = asString(
    userRecord.org_id || authenticatedUser.org_id
  );

  const authorized =
    email === AUTHORIZED_ADMIN_EMAIL &&
    role === "admin" &&
    orgId === COMOP_ORG_ID;

  if (!authorized) {
    throw new RequestError(
      403,
      "This cleanup function is restricted to the authorized COMOP administrator."
    );
  }

  return {
    id: currentUserId,
    email,
    role,
    org_id: orgId,
  };
}

async function loadCleanupState(service: any) {
  const entryTypeResults = await service.entities.EntryType.filter({
    code: JOB_DEVELOPMENT_CODE,
  });

  const allReturnedEntryTypes = uniqueById(
    asArray<RecordLike>(entryTypeResults)
  );

  const exactCodeEntryTypes = allReturnedEntryTypes.filter(
    (entryType) =>
      normalizeCode(entryType.code) === JOB_DEVELOPMENT_CODE
  );

  const inScopeEntryTypes = exactCodeEntryTypes.filter(
    belongsToCleanupScope
  );

  const foreignSameCodeEntryTypes = exactCodeEntryTypes.filter(
    (entryType) => !belongsToCleanupScope(entryType)
  );

  const canonicalEntryType = inScopeEntryTypes.find(
    (entryType) =>
      asString(entryType.id) === CANONICAL_ENTRY_TYPE_ID
  );

  if (!canonicalEntryType) {
    throw new RequestError(
      409,
      `Canonical Job Development EntryType ${CANONICAL_ENTRY_TYPE_ID} was not found in the COMOP cleanup scope.`
    );
  }

  if (
    canonicalEntryType.is_active === false ||
    canonicalEntryType.is_archived === true
  ) {
    throw new RequestError(
      409,
      "The canonical Job Development EntryType is inactive or archived. Cleanup stopped."
    );
  }

  const duplicateEntryTypes = inScopeEntryTypes.filter(
    (entryType) =>
      asString(entryType.id) !== CANONICAL_ENTRY_TYPE_ID
  );

  const relevantEntryTypeIds = new Set(
    inScopeEntryTypes
      .map((entryType) => asString(entryType.id))
      .filter(Boolean)
  );

  const templateQueryResults = await Promise.all([
    service.entities.ReportFieldTemplate.filter({
      entry_type_code: JOB_DEVELOPMENT_CODE,
    }),
    ...Array.from(relevantEntryTypeIds).map((entryTypeId) =>
      service.entities.ReportFieldTemplate.filter({
        entry_type_id: entryTypeId,
      })
    ),
  ]);

  const templateCandidates = uniqueById(
    templateQueryResults.flatMap((result) =>
      asArray<RecordLike>(result)
    )
  );

  const jobDevelopmentTemplates = templateCandidates.filter(
    (template) => {
      if (!belongsToCleanupScope(template)) {
        return false;
      }

      const templateCode = normalizeCode(
        template.entry_type_code
      );

      const templateEntryTypeId = asString(
        template.entry_type_id
      );

      return (
        templateCode === JOB_DEVELOPMENT_CODE ||
        relevantEntryTypeIds.has(templateEntryTypeId)
      );
    }
  );

  const canonicalTemplates = jobDevelopmentTemplates.filter(
    (template) =>
      asString(template.entry_type_id) ===
      CANONICAL_ENTRY_TYPE_ID
  );

  const activeCanonicalTemplates = canonicalTemplates.filter(
    (template) =>
      template.is_active !== false &&
      template.is_internal_only !== true
  );

  const canonicalFieldKeys = activeCanonicalTemplates.map(
    (template) => asString(template.field_key)
  );

  const canonicalTemplateSetIsValid =
    activeCanonicalTemplates.length ===
      EXPECTED_CANONICAL_FIELD_KEYS.length &&
    hasExactCanonicalFieldSet(canonicalFieldKeys);

  const staleTemplates = jobDevelopmentTemplates.filter(
    (template) =>
      asString(template.entry_type_id) !==
      CANONICAL_ENTRY_TYPE_ID
  );

  return {
    canonicalEntryType,
    duplicateEntryTypes,
    foreignSameCodeEntryTypes,
    canonicalTemplates,
    activeCanonicalTemplates,
    canonicalFieldKeys,
    canonicalTemplateSetIsValid,
    staleTemplates,
  };
}

Deno.serve(async (request) => {
  try {
    const base44 = createClientFromRequest(request);
    const service = base44.asServiceRole;

    const operator = await getAuthorizedOperator(
      base44,
      service
    );

    const body = await readRequestBody(request);
    const apply = body.apply === true;
    const confirmation = asString(body.confirmation);

    const state = await loadCleanupState(service);

    const preview = {
      operator,
      canonical_entry_type: summarizeEntryType(
        state.canonicalEntryType
      ),
      canonical_active_template_field_keys:
        state.canonicalFieldKeys.sort(),
      canonical_template_set_is_valid:
        state.canonicalTemplateSetIsValid,
      duplicate_entry_types_to_delete:
        state.duplicateEntryTypes.map(
          summarizeEntryType
        ),
      stale_report_field_templates_to_delete:
        state.staleTemplates
          .sort(
            (a, b) =>
              Number(a.order || 0) -
              Number(b.order || 0)
          )
          .map(summarizeTemplate),
      foreign_same_code_entry_types_not_touched:
        state.foreignSameCodeEntryTypes.map(
          summarizeEntryType
        ),
      can_apply:
        state.canonicalTemplateSetIsValid &&
        state.foreignSameCodeEntryTypes.length === 0,
    };

    if (!apply) {
      return jsonResponse({
        ok: true,
        mode: "preview",
        message:
          "No records were changed. Review this preview before applying cleanup.",
        preview,
      });
    }

    if (
      confirmation !== APPLY_CONFIRMATION
    ) {
      throw new RequestError(
        400,
        `Apply requires confirmation exactly equal to "${APPLY_CONFIRMATION}".`
      );
    }

    if (!state.canonicalTemplateSetIsValid) {
      throw new RequestError(
        409,
        "The canonical nine-field Job Development template set is not intact. Cleanup stopped without deleting anything."
      );
    }

    if (state.foreignSameCodeEntryTypes.length > 0) {
      throw new RequestError(
        409,
        "Same-code EntryType records exist outside the COMOP cleanup scope. Cleanup stopped to preserve tenant isolation."
      );
    }

    const deletedTemplateIds: string[] = [];
    const deletedEntryTypeIds: string[] = [];

    for (const template of state.staleTemplates) {
      const templateId = asString(template.id);

      if (!templateId) {
        continue;
      }

      await service.entities.ReportFieldTemplate.delete(
        templateId
      );

      deletedTemplateIds.push(templateId);
    }

    for (const entryType of state.duplicateEntryTypes) {
      const entryTypeId = asString(entryType.id);

      if (!entryTypeId) {
        continue;
      }

      await service.entities.EntryType.delete(
        entryTypeId
      );

      deletedEntryTypeIds.push(entryTypeId);
    }

    const after = await loadCleanupState(service);

    const verified =
      after.duplicateEntryTypes.length === 0 &&
      after.staleTemplates.length === 0 &&
      after.canonicalTemplateSetIsValid;

    if (!verified) {
      throw new RequestError(
        500,
        "Cleanup ran but final verification did not reach the expected one-EntryType, nine-template state."
      );
    }

    return jsonResponse({
      ok: true,
      mode: "apply",
      message:
        "Duplicate Job Development configuration was removed successfully.",
      deleted_report_field_template_ids:
        deletedTemplateIds,
      deleted_entry_type_ids: deletedEntryTypeIds,
      final_state: {
        canonical_entry_type: summarizeEntryType(
          after.canonicalEntryType
        ),
        canonical_active_template_field_keys:
          after.canonicalFieldKeys.sort(),
        remaining_duplicate_entry_types:
          after.duplicateEntryTypes.length,
        remaining_stale_templates:
          after.staleTemplates.length,
      },
    });
  } catch (error) {
    console.error(
      "[cleanupJobDevelopmentTestConfiguration] Failed:",
      error
    );

    const status =
      error instanceof RequestError
        ? error.status
        : 500;

    const message =
      error instanceof Error
        ? error.message
        : "Unexpected cleanup failure.";

    return jsonResponse(
      {
        ok: false,
        error: message,
      },
      status
    );
  }
});
