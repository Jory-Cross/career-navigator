import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

const COMOP_ORG_ID = "6a3df2c2de44fda1218fa2b4";
const AUTHORIZED_OPERATOR_USER_ID = "69975ef9c220200194235cf0";
const AUTHORIZED_OPERATOR_EMAIL = "arbranger@gmail.com";

const MAX_REFERENCE_SAMPLES = 25;

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

function isRecord(value: unknown): value is RecordLike {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }

  if (isRecord(value) && Array.isArray(value.items)) {
    return value.items as T[];
  }

  if (isRecord(value) && Array.isArray(value.data)) {
    return value.data as T[];
  }

  return [];
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeCode(value: unknown) {
  return asString(value).toLowerCase();
}

function normalizeEmail(value: unknown) {
  return asString(value).toLowerCase();
}

function recordId(record: RecordLike) {
  return asString(record.id);
}

function isInAuditScope(record: RecordLike) {
  const orgId = asString(record.org_id);

  // Global/platform records are allowed. Explicitly foreign-org records are not.
  return !orgId || orgId === COMOP_ORG_ID;
}

function isActiveEntryType(record: RecordLike) {
  return (
    Boolean(normalizeCode(record.code)) &&
    record.is_active !== false &&
    record.is_archived !== true
  );
}

function isActiveTemplate(record: RecordLike) {
  return (
    record.is_active !== false &&
    record.is_internal_only !== true &&
    record.is_archived !== true
  );
}

function uniqueById(records: RecordLike[]) {
  const byId = new Map<string, RecordLike>();

  for (const record of records) {
    const id = recordId(record);

    if (id && !byId.has(id)) {
      byId.set(id, record);
    }
  }

  return Array.from(byId.values());
}

async function getEntityRecords(
  service: any,
  entityName: string,
  filter: RecordLike = {}
) {
  const entity = service?.entities?.[entityName];

  if (!entity || typeof entity.filter !== "function") {
    throw new RequestError(
      500,
      `Entity API is unavailable for ${entityName}.`
    );
  }

  const results = await entity.filter(filter);

  return uniqueById(asArray<RecordLike>(results));
}

async function getAuthorizedOperator(base44: any, service: any) {
  const authenticatedUser = await base44.auth.me();

  if (!isRecord(authenticatedUser) || !recordId(authenticatedUser)) {
    throw new RequestError(401, "Authentication is required.");
  }

  const userId = recordId(authenticatedUser);

  const possibleUsers = await getEntityRecords(service, "User", {
    id: userId,
  });

  const userRecord =
    possibleUsers.find((user) => recordId(user) === userId) ||
    authenticatedUser;

  const email = normalizeEmail(
    userRecord.email || authenticatedUser.email
  );

  const role = normalizeCode(
    userRecord.role || authenticatedUser.role
  );

  const orgId = asString(
    userRecord.org_id || authenticatedUser.org_id
  );

  const isAuthorized =
    userId === AUTHORIZED_OPERATOR_USER_ID &&
    email === AUTHORIZED_OPERATOR_EMAIL &&
    role === "admin" &&
    orgId === COMOP_ORG_ID;

  if (!isAuthorized) {
    throw new RequestError(
      403,
      "This audit is restricted to the authorized COMOP administrator."
    );
  }

  return {
    id: userId,
    email,
    role,
    org_id: orgId,
  };
}

function summarizeEntryType(entryType: RecordLike) {
  return {
    id: recordId(entryType),
    org_id: asString(entryType.org_id) || null,
    name: asString(entryType.name) || null,
    code: normalizeCode(entryType.code),
    program_type: asString(entryType.program_type) || null,
    report_mode: asString(entryType.report_mode) || null,
    requires_client: entryType.requires_client ?? null,
    requires_authorization: entryType.requires_authorization ?? null,
    requires_employer: entryType.requires_employer ?? null,
    is_active: entryType.is_active ?? null,
    is_archived: entryType.is_archived ?? null,
  };
}

function summarizeTemplate(template: RecordLike) {
  return {
    id: recordId(template),
    org_id: asString(template.org_id) || null,
    entry_type_id: asString(template.entry_type_id) || null,
    entry_type_code: normalizeCode(template.entry_type_code) || null,
    field_key: asString(template.field_key) || null,
    label: asString(template.label) || null,
    order: template.order ?? null,
    is_active: template.is_active ?? null,
    is_internal_only: template.is_internal_only ?? null,
  };
}

function summarizeTimeEntry(entry: RecordLike) {
  return {
    id: recordId(entry),
    org_id: asString(entry.org_id) || null,
    client_id: asString(entry.client_id) || null,
    employee_id: asString(entry.employee_id) || null,
    entry_type_id: asString(entry.entry_type_id) || null,
    entry_type_code: normalizeCode(entry.entry_type_code) || null,
    date: asString(entry.date) || null,
    status: asString(entry.status) || null,
  };
}

function sample<T>(records: T[]) {
  return records.slice(0, MAX_REFERENCE_SAMPLES);
}

function buildDuplicateCodeReport(
  code: string,
  entryTypes: RecordLike[],
  templates: RecordLike[],
  timeEntries: RecordLike[]
) {
  const entryTypeIds = new Set(
    entryTypes.map(recordId).filter(Boolean)
  );

  const scopedTemplates = templates.filter((template) => {
    const templateEntryTypeId = asString(template.entry_type_id);
    const templateCode = normalizeCode(template.entry_type_code);

    return (
      entryTypeIds.has(templateEntryTypeId) ||
      templateCode === code
    );
  });

  const scopedTimeEntries = timeEntries.filter((entry) => {
    const entryTypeId = asString(entry.entry_type_id);
    const entryTypeCode = normalizeCode(entry.entry_type_code);

    return (
      entryTypeIds.has(entryTypeId) ||
      entryTypeCode === code
    );
  });

  const codeOnlyTemplates = scopedTemplates.filter((template) => {
    const templateEntryTypeId = asString(template.entry_type_id);

    return !templateEntryTypeId || !entryTypeIds.has(templateEntryTypeId);
  });

  const codeOnlyTimeEntries = scopedTimeEntries.filter((entry) => {
    const entryTypeId = asString(entry.entry_type_id);

    return !entryTypeId || !entryTypeIds.has(entryTypeId);
  });

  const records = entryTypes
    .slice()
    .sort((a, b) => recordId(a).localeCompare(recordId(b)))
    .map((entryType) => {
      const entryTypeId = recordId(entryType);

      const linkedTemplates = scopedTemplates
        .filter(
          (template) =>
            asString(template.entry_type_id) === entryTypeId
        )
        .sort(
          (a, b) =>
            Number(a.order || 0) - Number(b.order || 0)
        );

      const linkedTimeEntries = scopedTimeEntries.filter(
        (entry) =>
          asString(entry.entry_type_id) === entryTypeId
      );

      return {
        entry_type: summarizeEntryType(entryType),
        report_field_templates: {
          total: linkedTemplates.length,
          active: linkedTemplates.filter(isActiveTemplate).length,
          field_keys: linkedTemplates.map((template) =>
            asString(template.field_key)
          ),
          records: linkedTemplates.map(summarizeTemplate),
        },
        time_entry_references: {
          total: linkedTimeEntries.length,
          samples: sample(
            linkedTimeEntries.map(summarizeTimeEntry)
          ),
          more_than_sample_limit:
            linkedTimeEntries.length > MAX_REFERENCE_SAMPLES,
        },
      };
    });

  const recordsWithActiveTemplates = records.filter(
    (record) => record.report_field_templates.active > 0
  );

  const recordsWithTimeEntryReferences = records.filter(
    (record) => record.time_entry_references.total > 0
  );

  return {
    code,
    active_entry_type_count: entryTypes.length,
    records,
    orphaned_or_code_only_templates: {
      total: codeOnlyTemplates.length,
      active: codeOnlyTemplates.filter(isActiveTemplate).length,
      records: codeOnlyTemplates.map(summarizeTemplate),
    },
    code_only_time_entry_references: {
      total: codeOnlyTimeEntries.length,
      samples: sample(
        codeOnlyTimeEntries.map(summarizeTimeEntry)
      ),
      more_than_sample_limit:
        codeOnlyTimeEntries.length > MAX_REFERENCE_SAMPLES,
    },
    review_flags: {
      has_more_than_one_template_bearing_record:
        recordsWithActiveTemplates.length > 1,
      has_multiple_records_with_time_entry_references:
        recordsWithTimeEntryReferences.length > 1,
      has_code_only_time_entry_references:
        codeOnlyTimeEntries.length > 0,
      requires_manual_canonical_selection: true,
    },
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

    const [
      allEntryTypes,
      allTemplates,
      allTimeEntries,
    ] = await Promise.all([
      getEntityRecords(service, "EntryType"),
      getEntityRecords(service, "ReportFieldTemplate"),
      getEntityRecords(service, "TimeEntry"),
    ]);

    const scopedEntryTypes = allEntryTypes.filter(
      isInAuditScope
    );

    const scopedTemplates = allTemplates.filter(
      isInAuditScope
    );

    const scopedTimeEntries = allTimeEntries.filter(
      isInAuditScope
    );

    const groups = new Map<string, RecordLike[]>();

    for (const entryType of scopedEntryTypes) {
      if (!isActiveEntryType(entryType)) {
        continue;
      }

      const code = normalizeCode(entryType.code);

      if (!groups.has(code)) {
        groups.set(code, []);
      }

      groups.get(code)?.push(entryType);
    }

    const duplicateGroups = Array.from(groups.entries())
      .filter(([, entryTypes]) => entryTypes.length > 1)
      .sort(([codeA], [codeB]) =>
        codeA.localeCompare(codeB)
      )
      .map(([code, entryTypes]) =>
        buildDuplicateCodeReport(
          code,
          entryTypes,
          scopedTemplates,
          scopedTimeEntries
        )
      );

    return jsonResponse({
      ok: true,
      mode: "preview_only",
      message:
        "No records were changed. This report identifies duplicate active EntryType codes in the COMOP/global configuration scope.",
      audit_scope: {
        organization_id: COMOP_ORG_ID,
        includes_global_records_with_blank_org_id: true,
        excludes_explicitly_foreign_organization_records: true,
      },
      operator,
      totals: {
        entry_types_loaded: allEntryTypes.length,
        entry_types_in_scope: scopedEntryTypes.length,
        entry_types_excluded_as_foreign:
          allEntryTypes.length - scopedEntryTypes.length,
        report_field_templates_loaded: allTemplates.length,
        report_field_templates_in_scope:
          scopedTemplates.length,
        time_entries_loaded: allTimeEntries.length,
        time_entries_in_scope: scopedTimeEntries.length,
        duplicate_active_entry_type_codes:
          duplicateGroups.length,
      },
      duplicate_active_entry_type_codes: duplicateGroups,
    });
  } catch (error) {
    console.error("[auditDuplicateEntryTypes] Failed:", error);

    const status =
      error instanceof RequestError
        ? error.status
        : 500;

    const message =
      error instanceof Error
        ? error.message
        : "Unexpected audit failure.";

    return jsonResponse(
      {
        ok: false,
        error: message,
      },
      status
    );
  }
});
