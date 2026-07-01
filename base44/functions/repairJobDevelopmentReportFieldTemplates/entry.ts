import { createClientFromRequest } from "npm:@base44/sdk@0.8.23";

const COMOP_ORG_ID = "6a3df2c2de44fda1218fa2b4";
const TEMPORARY_REPAIR_OPERATOR_EMAIL = "jory.cross@comop.org";

const TARGET_ENTRY_TYPE_ID = "69d5bc80227279b112f75fe8";
const STALE_ENTRY_TYPE_ID = "69d5a1cd88acc70a3b34db40";
const ENTRY_TYPE_CODE = "job_development";

const JOB_DEVELOPMENT_FIELD_SPECS = [
  {
    field_key: "job_goal",
    label: "Job Goal",
    field_type: "textarea",
    section: "Job Goal",
    placeholder: "",
    help_text: "",
    required_on_entry: true,
  },
  {
    field_key: "month_year",
    label: "Reporting Month/Year",
    field_type: "text",
    section: "Reporting",
    placeholder: "e.g. January 2025 or 2025-01",
    help_text: "Reporting period (auto-populated from entry dates)",
    required_on_entry: false,
  },
  {
    field_key: "development_date",
    label: "Development Activity Date",
    field_type: "date",
    section: "Activity",
    placeholder: "",
    help_text: "",
    required_on_entry: true,
  },
  {
    field_key: "development_hours",
    label: "Hours Spent",
    field_type: "number",
    section: "Activity",
    placeholder: "",
    help_text: "",
    required_on_entry: true,
  },
  {
    field_key: "development_activity",
    label: "Activity Description",
    field_type: "textarea",
    section: "Activity",
    placeholder: "",
    help_text: "e.g., Job search, employer contact, interview prep",
    required_on_entry: true,
  },
  {
    field_key: "activity_outcome",
    label: "Outcome/Result",
    field_type: "textarea",
    section: "Outcome",
    placeholder: "",
    help_text: "",
    required_on_entry: false,
  },
  {
    field_key: "next_steps",
    label: "Next Steps",
    field_type: "textarea",
    section: "Next Steps",
    placeholder: "",
    help_text: "",
    required_on_entry: false,
  },
  {
    field_key: "summary_information",
    label: "Summary of Other Pertinent Information",
    field_type: "textarea",
    section: "Summary",
    placeholder: "",
    help_text: "",
    required_on_entry: false,
  },
  {
    field_key: "barriers_to_cie",
    label: "Barriers to Competitive Integrated Employment",
    field_type: "textarea",
    section: "Summary",
    placeholder: "",
    help_text: "",
    required_on_entry: false,
  },
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

function getExpectedFieldKeys() {
  return JOB_DEVELOPMENT_FIELD_SPECS.map(
    (field) => field.field_key
  );
}

async function getVerifiedTemporaryRepairOperator(
  base44: any,
  authenticatedUser: any,
  diagnosticOnly = false
) {
  const caller =
    await base44.asServiceRole.entities.User.get(
      authenticatedUser.id
    ).catch(() => null);

  if (!caller || !isActive(caller)) {
    throw httpError(
      403,
      "Authenticated repair operator record was not found or is inactive."
    );
  }

  const callerEmail = normalizeText(
    authenticatedUser?.email
  ).toLowerCase();

  const callerOrgId = normalizeText(caller.org_id);

  const emailMatchesAuthorizedOperator =
    callerEmail === TEMPORARY_REPAIR_OPERATOR_EMAIL;

  const organizationMatchesComop =
    callerOrgId === COMOP_ORG_ID;

  const diagnostic = {
    authenticated_user_id: normalizeText(authenticatedUser?.id) || null,
    authenticated_email: callerEmail || null,
    user_record_id: normalizeText(caller.id) || null,
    user_record_email:
      normalizeText(caller.email).toLowerCase() || null,
    user_record_role:
      normalizeText(caller.role).toLowerCase() || null,
    user_record_org_id: callerOrgId || null,
    email_matches_authorized_operator:
      emailMatchesAuthorizedOperator,
    organization_matches_comop: organizationMatchesComop,
  };

  if (diagnosticOnly) {
    return {
      caller,
      organizationId: callerOrgId,
      authorized:
        emailMatchesAuthorizedOperator &&
        organizationMatchesComop,
      diagnostic,
    };
  }

  if (
    !emailMatchesAuthorizedOperator ||
    !organizationMatchesComop
  ) {
    throw httpError(
      403,
      "Only the specifically authorized COMOP repair operator may run this one-time repair."
    );
  }

  const organization =
    await base44.asServiceRole.entities.Organization.get(
      COMOP_ORG_ID
    ).catch(() => null);

  if (!organization || !isActive(organization)) {
    throw httpError(
      403,
      "The COMOP organization is inactive or unavailable."
    );
  }

  return {
    caller,
    organizationId: callerOrgId,
    authorized: true,
    diagnostic,
  };
}
function getActiveJobDevelopmentTemplates(
  templates: any[],
  entryTypeId: string
) {
  return asArray(templates).filter(
    (template: any) =>
      isActive(template) &&
      normalizeText(template.entry_type_id) === entryTypeId &&
      normalizeText(template.entry_type_code) === ENTRY_TYPE_CODE
  );
}

function assertNoDuplicateExpectedFieldKeys(
  templates: any[]
) {
  const expectedFieldKeys = new Set(getExpectedFieldKeys());
  const counts = new Map<string, number>();

  for (const template of templates) {
    const fieldKey = normalizeText(template.field_key);

    if (!expectedFieldKeys.has(fieldKey)) {
      continue;
    }

    counts.set(fieldKey, (counts.get(fieldKey) || 0) + 1);
  }

  const duplicateFieldKeys = Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([fieldKey]) => fieldKey);

  if (duplicateFieldKeys.length > 0) {
    throw httpError(
      409,
      `The target Job Development EntryType has duplicate active templates for: ${duplicateFieldKeys.join(
        ", "
      )}. No changes were made.`
    );
  }
}

function buildTemplatePayload(
  organizationId: string,
  field: any,
  order: number
) {
  return {
    org_id: organizationId,
    entry_type_id: TARGET_ENTRY_TYPE_ID,
    entry_type_code: ENTRY_TYPE_CODE,
    field_key: field.field_key,
    label: field.label,
    field_type: field.field_type,
    section: field.section,
    order,
    options: [],
    placeholder: field.placeholder,
    help_text: field.help_text,
    is_required: field.required_on_entry === true,
    is_reportable: true,
    is_internal_only: false,
    required_on_entry: field.required_on_entry === true,
    required_for_report: false,
    schema_version: 1,
    is_active: true,
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

    const {
      caller,
      organizationId: callerOrganizationId,
    } = await getVerifiedTemporaryRepairOperator(
      base44,
      authenticatedUser
    );

    const targetEntryType =
      await base44.asServiceRole.entities.EntryType.get(
        TARGET_ENTRY_TYPE_ID
      ).catch(() => null);

    if (
      !targetEntryType ||
      !isActive(targetEntryType) ||
      normalizeText(targetEntryType.code) !== ENTRY_TYPE_CODE
    ) {
      throw httpError(
        409,
        "The target Job Development EntryType is missing, inactive, or has an unexpected code."
      );
    }

    const targetEntryTypeOrganizationId = normalizeText(
      targetEntryType.org_id
    );

    if (
      targetEntryTypeOrganizationId &&
      targetEntryTypeOrganizationId !== callerOrganizationId
    ) {
      throw httpError(
        403,
        "The target Job Development EntryType belongs to a different organization."
      );
    }

    const templateOrganizationId =
      targetEntryTypeOrganizationId || callerOrganizationId;

    const targetRecords =
      await base44.asServiceRole.entities.ReportFieldTemplate.filter({
        entry_type_id: TARGET_ENTRY_TYPE_ID,
      });

    const staleRecords =
      await base44.asServiceRole.entities.ReportFieldTemplate.filter({
        entry_type_id: STALE_ENTRY_TYPE_ID,
      });

    const targetTemplates = getActiveJobDevelopmentTemplates(
      targetRecords,
      TARGET_ENTRY_TYPE_ID
    );

    const staleTemplates = getActiveJobDevelopmentTemplates(
      staleRecords,
      STALE_ENTRY_TYPE_ID
    );

    assertNoDuplicateExpectedFieldKeys(targetTemplates);

      const foreignScopedTargetTemplates = targetTemplates.filter(
      (template: any) => {
        const templateRecordOrganizationId = normalizeText(
          template.org_id
        );

        return (
          templateRecordOrganizationId &&
          templateRecordOrganizationId !== templateOrganizationId
        );
      }
    );
    if (foreignScopedTargetTemplates.length > 0) {
      throw httpError(
        409,
        "The target Job Development EntryType has active templates scoped to a different organization. No changes were made."
      );
    }

    const existingByFieldKey = new Map(
      targetTemplates.map((template: any) => [
        normalizeText(template.field_key),
        template,
      ])
    );

    const missingFields = JOB_DEVELOPMENT_FIELD_SPECS.filter(
      (field) => !existingByFieldKey.has(field.field_key)
    );

    const preview = {
      ok: true,
      action: apply ? "apply" : "preview",
      apply_requested: apply,
      target_entry_type_id: TARGET_ENTRY_TYPE_ID,
      target_entry_type_code: ENTRY_TYPE_CODE,
      template_org_id: templateOrganizationId,
      existing_field_keys: JOB_DEVELOPMENT_FIELD_SPECS
        .filter((field) => existingByFieldKey.has(field.field_key))
        .map((field) => field.field_key),
      missing_field_keys: missingFields.map(
        (field) => field.field_key
      ),
      stale_unmoved_template_count: staleTemplates.length,
      stale_templates_were_not_modified: true,
    };

    if (!apply) {
      return Response.json(preview);
    }

    if (missingFields.length === 0) {
      return Response.json({
        ...preview,
        success: true,
        already_configured: true,
        created_field_keys: [],
      });
    }

    const createdTemplates: any[] = [];

    try {
      for (const field of missingFields) {
        const template =
          await base44.asServiceRole.entities.ReportFieldTemplate.create(
            buildTemplatePayload(
              templateOrganizationId,
              field,
              JOB_DEVELOPMENT_FIELD_SPECS.findIndex(
                (candidate) =>
                  candidate.field_key === field.field_key
              ) + 1
            )
          );

        createdTemplates.push(template);
      }
    } catch (error: any) {
      const rollbackFailures: string[] = [];

      for (const template of [...createdTemplates].reverse()) {
        try {
          await base44.asServiceRole.entities.ReportFieldTemplate.delete(
            template.id
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
        "Job Development template repair failed. All created templates were removed."
      );
    }

    console.log(
      "Job Development template repair completed.",
      {
        actor_user_id: caller.id,
        target_entry_type_id: TARGET_ENTRY_TYPE_ID,
        created_field_keys: createdTemplates.map(
          (template: any) => template.field_key
        ),
      }
    );

    return Response.json({
      ...preview,
      success: true,
      created_template_ids: createdTemplates.map(
        (template: any) => template.id
      ),
      created_field_keys: createdTemplates.map(
        (template: any) => template.field_key
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
