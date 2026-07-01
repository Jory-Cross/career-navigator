import { createClientFromRequest } from "npm:@base44/sdk@0.8.23";

const PLATFORM_OWNER_ORG_ID = "6a442cb23f501f1a9cccc0c0";

const SOURCE_ENTRY_TYPE_ID = "69d5a1cd88acc70a3b34db40";
const TARGET_ENTRY_TYPE_ID = "69d5bc80227279b112f75fe8";
const ENTRY_TYPE_CODE = "job_development";

const EXPECTED_ACTIVE_FIELD_KEYS = [
  "client_name",
  "authorization_number",
  "vr_counselor_name",
  "job_goal",
  "crp_company_name",
  "crp_contact_phone",
  "month_year",
  "development_date",
  "development_hours",
  "development_activity",
  "activity_outcome",
  "next_steps",
  "summary_information",
  "barriers_to_cie",
];

function httpError(status: number, message: string) {
  const error: any = new Error(message);
  error.status = status;
  return error;
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function isActive(record: any) {
  return record?.is_active !== false && record?.is_archived !== true;
}

function getTemplateKeys(templates: any[]) {
  return templates
    .map((template: any) => normalizeText(template?.field_key))
    .filter(Boolean);
}

function assertExactExpectedTemplateSet(
  templates: any[],
  label: string
) {
  const keys = getTemplateKeys(templates);
  const actualKeys = new Set(keys);
  const expectedKeys = new Set(EXPECTED_ACTIVE_FIELD_KEYS);

  const missingKeys = EXPECTED_ACTIVE_FIELD_KEYS.filter(
    (fieldKey) => !actualKeys.has(fieldKey)
  );

  const unexpectedKeys = keys.filter(
    (fieldKey) => !expectedKeys.has(fieldKey)
  );

  const hasDuplicates = actualKeys.size !== keys.length;

  if (
    templates.length !== EXPECTED_ACTIVE_FIELD_KEYS.length ||
    missingKeys.length > 0 ||
    unexpectedKeys.length > 0 ||
    hasDuplicates
  ) {
    throw httpError(
      409,
      `${label} Job Development templates do not match the expected repair set. ` +
        `Expected ${EXPECTED_ACTIVE_FIELD_KEYS.length} unique active templates. ` +
        `Missing: ${missingKeys.join(", ") || "none"}. ` +
        `Unexpected: ${unexpectedKeys.join(", ") || "none"}. ` +
        `Duplicate field keys: ${hasDuplicates ? "yes" : "no"}.`
    );
  }
}

async function getVerifiedPlatformOwner(
  base44: any,
  authenticatedUser: any
) {
  const caller =
    await base44.asServiceRole.entities.User.get(
      authenticatedUser.id
    ).catch(() => null);

  if (!caller || !isActive(caller)) {
    throw httpError(
      403,
      "Authenticated Platform Owner record was not found or is inactive."
    );
  }

  const callerRole = normalizeText(caller.role).toLowerCase();
  const callerOrgId = normalizeText(caller.org_id);

  // Current secure transitional Platform Owner bridge:
  // active admin account inside Ability4Hire internal organization only.
  if (
    callerRole !== "admin" ||
    callerOrgId !== PLATFORM_OWNER_ORG_ID
  ) {
    throw httpError(
      403,
      "Only an active Ability4Hire Platform Owner may run this repair."
    );
  }

  const organization =
    await base44.asServiceRole.entities.Organization.get(
      PLATFORM_OWNER_ORG_ID
    ).catch(() => null);

  if (!organization || !isActive(organization)) {
    throw httpError(
      403,
      "The Ability4Hire Platform Owner organization is inactive or unavailable."
    );
  }

  return caller;
}

function getActiveJobDevelopmentTemplates(
  templates: any[],
  entryTypeId: string
) {
  return asArray(templates).filter(
    (template: any) =>
      template?.is_active === true &&
      normalizeText(template?.entry_type_id) === entryTypeId &&
      normalizeText(template?.entry_type_code) === ENTRY_TYPE_CODE
  );
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

    if (!authenticatedUser) {
      return Response.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    const body: any = await req.json().catch(() => ({}));

    if (
      body?.apply !== undefined &&
      typeof body.apply !== "boolean"
    ) {
      throw httpError(
        400,
        "apply must be a boolean when provided."
      );
    }

    const apply = body?.apply === true;

    const caller = await getVerifiedPlatformOwner(
      base44,
      authenticatedUser
    );

    const targetEntryType =
      await base44.asServiceRole.entities.EntryType.get(
        TARGET_ENTRY_TYPE_ID
      ).catch(() => null);

    if (
      !targetEntryType ||
      targetEntryType.is_active === false ||
      normalizeText(targetEntryType.code) !== ENTRY_TYPE_CODE
    ) {
      throw httpError(
        409,
        "The target Job Development EntryType is missing, inactive, or has an unexpected code."
      );
    }

    const targetOrgId = normalizeText(targetEntryType.org_id);

    const sourceRecords =
      await base44.asServiceRole.entities.ReportFieldTemplate.filter({
        entry_type_id: SOURCE_ENTRY_TYPE_ID,
      });

    const targetRecords =
      await base44.asServiceRole.entities.ReportFieldTemplate.filter({
        entry_type_id: TARGET_ENTRY_TYPE_ID,
      });

    const sourceTemplates = getActiveJobDevelopmentTemplates(
      sourceRecords,
      SOURCE_ENTRY_TYPE_ID
    );

    const targetTemplates = getActiveJobDevelopmentTemplates(
      targetRecords,
      TARGET_ENTRY_TYPE_ID
    );

    if (targetTemplates.length > 0) {
      assertExactExpectedTemplateSet(
        targetTemplates,
        "Target"
      );

      if (sourceTemplates.length === 0) {
        return Response.json({
          ok: true,
          action: apply ? "already_repaired" : "preview",
          already_repaired: true,
          apply_requested: apply,
          source_entry_type_id: SOURCE_ENTRY_TYPE_ID,
          target_entry_type_id: TARGET_ENTRY_TYPE_ID,
          entry_type_code: ENTRY_TYPE_CODE,
          template_count: targetTemplates.length,
          field_keys: getTemplateKeys(targetTemplates),
        });
      }

      throw httpError(
        409,
        "Active Job Development templates exist under both the source and target EntryTypes. No changes were made."
      );
    }

    assertExactExpectedTemplateSet(
      sourceTemplates,
      "Source"
    );

    const wrongScopedTemplates = sourceTemplates.filter(
      (template: any) =>
        normalizeText(template.org_id) !== targetOrgId
    );

    if (wrongScopedTemplates.length > 0) {
      throw httpError(
        409,
        "Source Job Development templates do not have the same organization scope as the target EntryType. No changes were made."
      );
    }

    const preview = {
      ok: true,
      action: apply ? "apply" : "preview",
      apply_requested: apply,
      source_entry_type_id: SOURCE_ENTRY_TYPE_ID,
      target_entry_type_id: TARGET_ENTRY_TYPE_ID,
      entry_type_code: ENTRY_TYPE_CODE,
      template_count: sourceTemplates.length,
      templates: sourceTemplates.map((template: any) => ({
        id: template.id,
        field_key: template.field_key,
        label: template.label || "",
        current_entry_type_id: template.entry_type_id,
        target_entry_type_id: TARGET_ENTRY_TYPE_ID,
      })),
    };

    if (!apply) {
      return Response.json(preview);
    }

    const movedTemplates: any[] = [];

    try {
      for (const template of sourceTemplates) {
        await base44.asServiceRole.entities.ReportFieldTemplate.update(
          template.id,
          {
            entry_type_id: TARGET_ENTRY_TYPE_ID,
          }
        );

        movedTemplates.push(template);
      }
    } catch (error: any) {
      const rollbackFailures: string[] = [];

      for (const template of [...movedTemplates].reverse()) {
        try {
          await base44.asServiceRole.entities.ReportFieldTemplate.update(
            template.id,
            {
              entry_type_id: SOURCE_ENTRY_TYPE_ID,
            }
          );
        } catch (rollbackError) {
          console.error(
            "Job Development template rollback failed:",
            template.id,
            rollbackError
          );

          rollbackFailures.push(template.id);
        }
      }

      if (rollbackFailures.length > 0) {
        throw httpError(
          500,
          `Job Development template repair failed and rollback was incomplete for template IDs: ${rollbackFailures.join(
            ", "
          )}.`
        );
      }

      throw httpError(
        500,
        "Job Development template repair failed. All moved templates were restored."
      );
    }

    console.log(
      "Job Development template repair completed.",
      {
        actor_user_id: caller.id,
        source_entry_type_id: SOURCE_ENTRY_TYPE_ID,
        target_entry_type_id: TARGET_ENTRY_TYPE_ID,
        template_count: movedTemplates.length,
      }
    );

    return Response.json({
      ...preview,
      success: true,
      moved_template_ids: movedTemplates.map(
        (template: any) => template.id
      ),
    });
  } catch (error: any) {
    console.error(
      "repairJobDevelopmentReportFieldTemplates error:",
      error?.message || error
    );

    return Response.json(
      {
        error:
          error?.message ||
          "Unable to repair Job Development templates.",
      },
      {
        status:
          typeof error?.status === "number"
            ? error.status
            : 500,
      }
    );
  }
});
