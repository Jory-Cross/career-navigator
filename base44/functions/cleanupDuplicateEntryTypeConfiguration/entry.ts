import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

const COMOP_ORG_ID = "6a3df2c2de44fda1218fa2b4";
const AUTHORIZED_OPERATOR_USER_ID = "69975ef9c220200194235cf0";
const AUTHORIZED_OPERATOR_EMAIL = "arbranger@gmail.com";

const APPLY_CONFIRMATION =
  "CONSOLIDATE_DUPLICATE_ENTRY_TYPE_CONFIGURATION";

type RecordLike = Record<string, any>;

const CONFIGS = [
  {
    key: "admin_time",
    canonicalId: "69d5bc80227279b112f75feb",
    canonicalCode: "admin_time",
    acceptedCodes: ["admin_time"],
    approvedOrphanTemplateParentIds: [],
  },
  {
    key: "csb_hours",
    canonicalId: "69d5bc80227279b112f75fee",
    canonicalCode: "csb_hours",
    acceptedCodes: ["csb_hours"],
    approvedOrphanTemplateParentIds: [],
  },
  {
    key: "eom_reporting",
    canonicalId: "69d5bc80227279b112f75fef",
    canonicalCode: "eom_reporting",
    acceptedCodes: [
      "eom_reporting",
      "end_of_month_reporting",
    ],
    approvedOrphanTemplateParentIds: [],
  },
  {
    key: "job_coaching",
    canonicalId: "69d5bc80227279b112f75fe9",
    canonicalCode: "job_coaching",
    acceptedCodes: ["job_coaching"],
    approvedOrphanTemplateParentIds: [],
  },
  {
    key: "life_skills",
    canonicalId: "69d5bc80227279b112f75fea",
    canonicalCode: "life_skills",
    acceptedCodes: ["life_skills"],
    approvedOrphanTemplateParentIds: [],
  },
  {
    key: "miscellaneous",
    canonicalId: "69d5bc80227279b112f75ff0",
    canonicalCode: "miscellaneous",
    acceptedCodes: ["misc", "miscellaneous"],
    approvedOrphanTemplateParentIds: [],
  },
  {
    key: "pre_ets_training",
    canonicalId: "69d5bc80227279b112f75fec",
    canonicalCode: "pre_ets_training",
    acceptedCodes: ["pre_ets", "pre_ets_training"],
    approvedOrphanTemplateParentIds: [
      "69d57ebd852831529a9a584a",
    ],
  },
  {
    key: "wsa",
    canonicalId: "69d5bc80227279b112f75fed",
    canonicalCode: "wsa",
    acceptedCodes: ["wsa"],
    approvedOrphanTemplateParentIds: [
      "69d57ebd852831529a9a584b",
    ],
  },
];

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

function normalize(value: unknown) {
  return asString(value).toLowerCase();
}

function recordId(record: RecordLike) {
  return asString(record?.id);
}

function isInScope(record: RecordLike) {
  const orgId = asString(record?.org_id);

  return !orgId || orgId === COMOP_ORG_ID;
}

function isActiveEntryType(record: RecordLike) {
  return (
    Boolean(normalize(record?.code)) &&
    record?.is_active !== false &&
    record?.is_archived !== true
  );
}

function uniqueById(records: RecordLike[]) {
  const seen = new Map<string, RecordLike>();

  for (const record of records) {
    const id = recordId(record);

    if (id && !seen.has(id)) {
      seen.set(id, record);
    }
  }

  return Array.from(seen.values());
}

async function readAll(
  service: any,
  entityName: string
) {
  const entity = service?.entities?.[entityName];

  if (!entity || typeof entity.filter !== "function") {
    throw new RequestError(
      500,
      `Entity API unavailable for ${entityName}.`
    );
  }

  const results = await entity.filter({});

  return uniqueById(asArray<RecordLike>(results));
}

async function getAuthorizedOperator(
  base44: any,
  service: any
) {
  const authenticatedUser = await base44.auth.me();

  if (!authenticatedUser?.id) {
    throw new RequestError(401, "Authentication is required.");
  }

  const userId = asString(authenticatedUser.id);

  const userResults = await service.entities.User.filter({
    id: userId,
  });

  const userRecord =
    asArray<RecordLike>(userResults).find(
      (user) => recordId(user) === userId
    ) || authenticatedUser;

  const email = normalize(
    userRecord.email || authenticatedUser.email
  );

  const role = normalize(
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
      "This cleanup is restricted to the authorized COMOP administrator."
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
    name: asString(entryType.name) || null,
    code: normalize(entryType.code),
    org_id: asString(entryType.org_id) || null,
    program_type: asString(entryType.program_type) || null,
    report_mode: asString(entryType.report_mode) || null,
    is_active: entryType.is_active ?? null,
    is_archived: entryType.is_archived ?? null,
  };
}

function summarizeTemplate(template: RecordLike) {
  return {
    id: recordId(template),
    entry_type_id: asString(template.entry_type_id) || null,
    entry_type_code: normalize(template.entry_type_code) || null,
    field_key: asString(template.field_key) || null,
    label: asString(template.label) || null,
    order: template.order ?? null,
  };
}

function summarizeTimeEntry(entry: RecordLike) {
  return {
    id: recordId(entry),
    entry_type_id: asString(entry.entry_type_id) || null,
    entry_type_code: normalize(entry.entry_type_code) || null,
    client_id: asString(entry.client_id) || null,
    employee_id: asString(entry.employee_id) || null,
    date: asString(entry.date) || null,
    status: asString(entry.status) || null,
  };
}

function buildPlan(
  allEntryTypes: RecordLike[],
  allTemplates: RecordLike[],
  allTimeEntries: RecordLike[]
) {
   const scopedEntryTypes = allEntryTypes.filter(isInScope);
  const scopedTemplates = allTemplates.filter(isInScope);
  const scopedTimeEntries = allTimeEntries.filter(isInScope);

  const scopedEntryTypeById = new Map<string, RecordLike>();

  for (const entryType of scopedEntryTypes) {
    const id = recordId(entryType);

    if (id) {
      scopedEntryTypeById.set(id, entryType);
    }
  }

  const groups = CONFIGS.map((config) => {
    const acceptedCodeSet = new Set(config.acceptedCodes);

    const canonicalEntryType = scopedEntryTypes.find(
      (entryType) =>
        recordId(entryType) === config.canonicalId
    );

    if (!canonicalEntryType) {
      throw new RequestError(
        409,
        `Canonical EntryType ${config.canonicalId} is missing for ${config.key}.`
      );
    }

    if (!isActiveEntryType(canonicalEntryType)) {
      throw new RequestError(
        409,
        `Canonical EntryType ${config.canonicalId} is inactive or archived for ${config.key}.`
      );
    }

    const matchingEntryTypes = scopedEntryTypes.filter(
      (entryType) =>
        isActiveEntryType(entryType) &&
        (
          recordId(entryType) === config.canonicalId ||
          acceptedCodeSet.has(normalize(entryType.code))
        )
    );

    const staleEntryTypes = matchingEntryTypes.filter(
      (entryType) =>
        recordId(entryType) !== config.canonicalId
    );

    const matchingEntryTypeIds = new Set(
      matchingEntryTypes
        .map(recordId)
        .filter(Boolean)
    );

    const staleEntryTypeIds = new Set(
      staleEntryTypes
        .map(recordId)
        .filter(Boolean)
    );

    const templatesForMatchingTypes = scopedTemplates.filter(
      (template) =>
        matchingEntryTypeIds.has(
          asString(template.entry_type_id)
        )
    );

        const directStaleTemplates = templatesForMatchingTypes.filter(
      (template) =>
        staleEntryTypeIds.has(
          asString(template.entry_type_id)
        )
    );

    const codeOnlyTemplates = scopedTemplates.filter(
      (template) => {
        const templateCode = normalize(
          template.entry_type_code
        );

        if (!acceptedCodeSet.has(templateCode)) {
          return false;
        }

        const templateEntryTypeId = asString(
          template.entry_type_id
        );

        return (
          templateEntryTypeId &&
          !matchingEntryTypeIds.has(templateEntryTypeId)
        );
      }
    );

    const approvedOrphanTemplateParentIdSet = new Set(
      config.approvedOrphanTemplateParentIds
    );

    const approvedOrphanTemplates = codeOnlyTemplates.filter(
      (template) =>
        approvedOrphanTemplateParentIdSet.has(
          asString(template.entry_type_id)
        )
    );

    const unsafeTemplates = codeOnlyTemplates.filter(
      (template) =>
        !approvedOrphanTemplateParentIdSet.has(
          asString(template.entry_type_id)
        )
    );

    const staleTemplates = uniqueById([
      ...directStaleTemplates,
      ...approvedOrphanTemplates,
    ]);

    const unsafeTemplateParentEntryTypeIds = [
      ...new Set(
        unsafeTemplates
          .map((template) => asString(template.entry_type_id))
          .filter(Boolean)
      ),
    ];

          const unsafeTemplates = codeOnlyTemplates;

    const unsafeTemplateParentEntryTypeIds = [
      ...new Set(
        unsafeTemplates
          .map((template) => asString(template.entry_type_id))
          .filter(Boolean)
      ),
    ];

    const unsafeTemplateParentEntryTypes =
      unsafeTemplateParentEntryTypeIds
        .map((entryTypeId) =>
          scopedEntryTypeById.get(entryTypeId)
        )
        .filter(
          (entryType): entryType is RecordLike =>
            Boolean(entryType)
        );

    const missingUnsafeTemplateParentEntryTypeIds =
      unsafeTemplateParentEntryTypeIds.filter(
        (entryTypeId) =>
          !scopedEntryTypeById.has(entryTypeId)
      );

    const timeEntriesToNormalize = scopedTimeEntries.filter(
      (entry) => {
        const entryTypeId = asString(entry.entry_type_id);
        const entryTypeCode = normalize(
          entry.entry_type_code
        );

        return (
          matchingEntryTypeIds.has(entryTypeId) ||
          acceptedCodeSet.has(entryTypeCode)
        );
      }
    );

    const timeEntriesNeedingUpdate =
      timeEntriesToNormalize.filter(
        (entry) =>
          asString(entry.entry_type_id) !==
            config.canonicalId ||
          normalize(entry.entry_type_code) !==
            config.canonicalCode
      );

       return {
      config,
      canonicalEntryType,
          staleEntryTypes,
      staleTemplates,
      approvedOrphanTemplates,
      unsafeTemplates,
      unsafeTemplateParentEntryTypes,
      missingUnsafeTemplateParentEntryTypeIds,
      timeEntriesNeedingUpdate,
      canonicalCodeNeedsUpdate:
        normalize(canonicalEntryType.code) !==
        config.canonicalCode,
    };
  });

  return {
    groups,
    totalStaleEntryTypes: groups.reduce(
      (sum, group) =>
        sum + group.staleEntryTypes.length,
      0
    ),
    totalStaleTemplates: groups.reduce(
      (sum, group) =>
        sum + group.staleTemplates.length,
      0
    ),
    totalTimeEntriesToUpdate: groups.reduce(
      (sum, group) =>
        sum + group.timeEntriesNeedingUpdate.length,
      0
    ),
    totalCanonicalCodeUpdates: groups.filter(
      (group) => group.canonicalCodeNeedsUpdate
    ).length,
  };
}

function summarizePlan(plan: ReturnType<typeof buildPlan>) {
  return {
    totals: {
      duplicate_entry_types_to_delete:
        plan.totalStaleEntryTypes,
      stale_templates_to_delete:
        plan.totalStaleTemplates,
      time_entries_to_reassign_or_normalize:
        plan.totalTimeEntriesToUpdate,
      canonical_entry_type_codes_to_update:
        plan.totalCanonicalCodeUpdates,
    },
    groups: plan.groups.map((group) => ({
      key: group.config.key,
      canonical_entry_type: {
        ...summarizeEntryType(group.canonicalEntryType),
        canonical_code_after_cleanup:
          group.config.canonicalCode,
      },
      canonical_code_needs_update:
        group.canonicalCodeNeedsUpdate,
      duplicate_entry_types_to_delete:
        group.staleEntryTypes.map(summarizeEntryType),
      stale_templates_to_delete:
        group.staleTemplates.map(summarizeTemplate),
         time_entries_to_reassign_or_normalize:
        group.timeEntriesNeedingUpdate.map(
          summarizeTimeEntry
        ),
           unsafe_template_references:
        group.unsafeTemplates.map(summarizeTemplate),
      unsafe_template_parent_entry_types:
        group.unsafeTemplateParentEntryTypes.map(
          summarizeEntryType
        ),
      unsafe_template_parent_entry_type_ids_without_record:
        group.missingUnsafeTemplateParentEntryTypeIds,
    })),
  };
}

async function readRequestBody(request: Request) {
  if (request.method === "GET") {
    return {};
  }

  try {
    const body = await request.json();

    return body && typeof body === "object"
      ? body
      : {};
  } catch {
    return {};
  }
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
    const apply = body?.apply === true;
    const confirmation = asString(body?.confirmation);

    const [
      allEntryTypes,
      allTemplates,
      allTimeEntries,
    ] = await Promise.all([
      readAll(service, "EntryType"),
      readAll(service, "ReportFieldTemplate"),
      readAll(service, "TimeEntry"),
    ]);

    const plan = buildPlan(
      allEntryTypes,
      allTemplates,
      allTimeEntries
    );

    if (!apply) {
      return jsonResponse({
        ok: true,
        mode: "preview",
        message:
          "No records were changed. Review the cleanup plan before applying.",
        operator,
        plan: summarizePlan(plan),
      });
    }

        if (confirmation !== APPLY_CONFIRMATION) {
      throw new RequestError(
        400,
        `Apply requires confirmation exactly equal to "${APPLY_CONFIRMATION}".`
      );
    }

    const unsafeGroups = plan.groups.filter(
      (group) => group.unsafeTemplates.length > 0
    );

    if (unsafeGroups.length > 0) {
      throw new RequestError(
        409,
        `Cleanup cannot be applied while unsafe template references remain for: ${unsafeGroups
          .map((group) => group.config.key)
          .join(", ")}. Run preview and review unsafe_template_references first.`
      );
    }

    for (const group of plan.groups) {
      if (!group.canonicalCodeNeedsUpdate) {
        continue;
      }

      await service.entities.EntryType.update(
        group.config.canonicalId,
        {
          code: group.config.canonicalCode,
        }
      );
    }

    for (const group of plan.groups) {
      for (const entry of group.timeEntriesNeedingUpdate) {
        await service.entities.TimeEntry.update(
          recordId(entry),
          {
            entry_type_id: group.config.canonicalId,
            entry_type_code: group.config.canonicalCode,
          }
        );
      }
    }

    for (const group of plan.groups) {
      for (const template of group.staleTemplates) {
        await service.entities.ReportFieldTemplate.delete(
          recordId(template)
        );
      }
    }

    for (const group of plan.groups) {
      for (const entryType of group.staleEntryTypes) {
        await service.entities.EntryType.delete(
          recordId(entryType)
        );
      }
    }

    const [
      finalEntryTypes,
      finalTemplates,
      finalTimeEntries,
    ] = await Promise.all([
      readAll(service, "EntryType"),
      readAll(service, "ReportFieldTemplate"),
      readAll(service, "TimeEntry"),
    ]);

    const finalPlan = buildPlan(
      finalEntryTypes,
      finalTemplates,
      finalTimeEntries
    );

    const isVerified =
      finalPlan.totalStaleEntryTypes === 0 &&
      finalPlan.totalStaleTemplates === 0 &&
      finalPlan.totalTimeEntriesToUpdate === 0 &&
      finalPlan.totalCanonicalCodeUpdates === 0;

    if (!isVerified) {
      throw new RequestError(
        500,
        "Cleanup completed but final verification did not reach the expected canonical state."
      );
    }

    return jsonResponse({
      ok: true,
      mode: "apply",
      message:
        "Duplicate EntryType configuration was consolidated successfully.",
      operator,
      applied: {
        deleted_duplicate_entry_types:
          plan.totalStaleEntryTypes,
        deleted_stale_templates:
          plan.totalStaleTemplates,
        reassigned_or_normalized_time_entries:
          plan.totalTimeEntriesToUpdate,
        updated_canonical_entry_type_codes:
          plan.totalCanonicalCodeUpdates,
      },
      final_state: {
        duplicate_entry_types_remaining:
          finalPlan.totalStaleEntryTypes,
        stale_templates_remaining:
          finalPlan.totalStaleTemplates,
        time_entries_needing_normalization:
          finalPlan.totalTimeEntriesToUpdate,
        canonical_codes_needing_update:
          finalPlan.totalCanonicalCodeUpdates,
      },
    });
  } catch (error) {
    console.error(
      "[cleanupDuplicateEntryTypeConfiguration] Failed:",
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
