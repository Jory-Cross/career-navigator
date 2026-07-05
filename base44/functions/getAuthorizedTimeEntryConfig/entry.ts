import { createClientFromRequest } from "npm:@base44/sdk@0.8.23";

const CANONICAL_STAFF_ACCESS: Record<string, string> = {
  admin: "admin",
  management: "staff",
  employee: "staff",
};

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function isActive(record: any) {
  return record?.is_active !== false && record?.is_archived !== true;
}

function getCanonicalStaffRole(user: any) {
  const role = normalizeText(user?.role).toLowerCase();
  const accessLevel = normalizeText(user?.access_level).toLowerCase();

  return CANONICAL_STAFF_ACCESS[role] === accessLevel ? role : "";
}

function isScopedConfigurationRecord(record: any, organizationId: string) {
  const recordOrganizationId = normalizeText(record?.org_id);
  return !recordOrganizationId || recordOrganizationId === organizationId;
}

function compareServiceCodes(left: any, right: any) {
  const leftNumber = Number((normalizeText(left?.code).match(/\d+/) || ["0"])[0]);
  const rightNumber = Number((normalizeText(right?.code).match(/\d+/) || ["0"])[0]);

  if (leftNumber !== rightNumber) return leftNumber - rightNumber;
  return normalizeText(left?.code).localeCompare(normalizeText(right?.code));
}

function projectEntryType(entryType: any) {
  return {
    id: normalizeText(entryType?.id),
    org_id: normalizeText(entryType?.org_id) || null,
    code: normalizeText(entryType?.code),
    name: normalizeText(entryType?.name),
    description: normalizeText(entryType?.description),
    program_type: normalizeText(entryType?.program_type) || "other",
    color: normalizeText(entryType?.color) || null,
    report_mode: normalizeText(entryType?.report_mode) || "none",
    is_billable: entryType?.is_billable === true,
    is_payroll_eligible: entryType?.is_payroll_eligible !== false,
    requires_client: entryType?.requires_client !== false,
    requires_authorization: entryType?.requires_authorization === true,
    requires_employer: entryType?.requires_employer === true,
    requires_field_answers: entryType?.requires_field_answers === true,
  };
}

function projectTemplate(template: any) {
  return {
    id: normalizeText(template?.id),
    org_id: normalizeText(template?.org_id) || null,
    entry_type_id: normalizeText(template?.entry_type_id),
    entry_type_code: normalizeText(template?.entry_type_code),
    field_key: normalizeText(template?.field_key),
    label: normalizeText(template?.label),
    field_type: normalizeText(template?.field_type) || "text",
    placeholder: normalizeText(template?.placeholder) || "",
    required_on_entry: template?.required_on_entry === true,
    required_for_report: template?.required_for_report === true,
    is_required: template?.is_required === true,
    is_reportable: template?.is_reportable !== false,
    is_internal_only: template?.is_internal_only === true,
    order: Number(template?.order) || 0,
    section: normalizeText(template?.section) || null,
    field_group: normalizeText(template?.field_group) || null,
    options: Array.isArray(template?.options) ? template.options : [],
    help_text: normalizeText(template?.help_text) || null,
    schema_version: Number(template?.schema_version) || 1,
  };
}

function projectServiceCode(serviceCode: any) {
  return {
    id: normalizeText(serviceCode?.id),
    org_id: normalizeText(serviceCode?.org_id) || null,
    code: normalizeText(serviceCode?.code),
    program_type: normalizeText(serviceCode?.program_type),
    service_type: normalizeText(serviceCode?.service_type),
    short_description: normalizeText(serviceCode?.short_description),
    full_description: normalizeText(serviceCode?.full_description),
    display_label:
      normalizeText(serviceCode?.display_label) || normalizeText(serviceCode?.code),
    category: normalizeText(serviceCode?.category),
    is_primary: serviceCode?.is_primary !== false,
    is_secondary: serviceCode?.is_secondary !== false,
  };
}

async function resolveEntryType(
  base44: any,
  activeEntryTypes: any[],
  organizationId: string,
  requestedEntryTypeId: string,
  requestedEntryTypeCode: string
) {
  if (requestedEntryTypeId) {
    const entryType = activeEntryTypes.find(
      (candidate: any) => normalizeText(candidate?.id) === requestedEntryTypeId
    );

    if (!entryType) {
      throw new Error("The requested EntryType is unavailable to your organization.");
    }

    return entryType;
  }

  if (!requestedEntryTypeCode) {
    throw new Error("Choose an EntryType before loading its configuration.");
  }

  const normalizedCode = requestedEntryTypeCode.toLowerCase();
  const matches = activeEntryTypes.filter(
    (candidate: any) =>
      normalizeText(candidate?.code).toLowerCase() === normalizedCode
  );
  const ownOrganizationMatch = matches.find(
    (candidate: any) => normalizeText(candidate?.org_id) === organizationId
  );

  if (ownOrganizationMatch) return ownOrganizationMatch;
  if (matches.length === 1) return matches[0];

  throw new Error(
    matches.length === 0
      ? "The requested EntryType is unavailable to your organization."
      : "The requested EntryType is ambiguous. Choose the service type again."
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

    const body: any = await req.json().catch(() => ({}));
    const action = normalizeText(body?.action).toLowerCase() || "list_entry_types";
    const requestedEntryTypeId = normalizeText(body?.entry_type_id);
    const requestedEntryTypeCode = normalizeText(body?.entry_type_code);

    if (
      action !== "list_entry_types" &&
      action !== "get_entry_type_configuration"
    ) {
      return Response.json(
        { ok: false, error: "Choose a valid TimeEntry configuration action." },
        { status: 400 }
      );
    }

    if (
      action === "get_entry_type_configuration" &&
      !requestedEntryTypeId &&
      !requestedEntryTypeCode
    ) {
      return Response.json(
        {
          ok: false,
          error: "Choose an EntryType before loading its configuration.",
        },
        { status: 400 }
      );
    }

    const base44 = createClientFromRequest(req);
    const authenticatedUser = await base44.auth.me();

    if (!authenticatedUser?.id) {
      return Response.json(
        { ok: false, error: "You must be signed in to load TimeEntry configuration." },
        { status: 401 }
      );
    }

    const caller = await base44.asServiceRole.entities.User.get(
      authenticatedUser.id
    ).catch(() => null);

    if (!caller || !isActive(caller)) {
      return Response.json(
        { ok: false, error: "Your account is inactive or unavailable." },
        { status: 403 }
      );
    }

    const callerRole = getCanonicalStaffRole(caller);
    const organizationId = normalizeText(caller.org_id);

    if (!callerRole || !organizationId) {
      return Response.json(
        {
          ok: false,
          error: "Your account is not authorized to load TimeEntry configuration.",
        },
        { status: 403 }
      );
    }

    const organization = await base44.asServiceRole.entities.Organization.get(
      organizationId
    ).catch(() => null);

    if (!organization || !isActive(organization)) {
      return Response.json(
        { ok: false, error: "Your organization is inactive or unavailable." },
        { status: 403 }
      );
    }

    const activeEntryTypes = asArray(
      await base44.asServiceRole.entities.EntryType.filter({ is_active: true })
    )
      .filter(
        (entryType: any) =>
          entryType?.is_active !== false &&
          isScopedConfigurationRecord(entryType, organizationId)
      )
      .sort((left: any, right: any) => {
        const leftName = normalizeText(left?.name);
        const rightName = normalizeText(right?.name);
        return leftName.localeCompare(rightName);
      });

    if (action === "list_entry_types") {
      return Response.json({
        ok: true,
        organization_id: organizationId,
        entry_types: activeEntryTypes.map(projectEntryType),
      });
    }

    let entryType: any;

    try {
      entryType = await resolveEntryType(
        base44,
        activeEntryTypes,
        organizationId,
        requestedEntryTypeId,
        requestedEntryTypeCode
      );
    } catch (resolutionError: any) {
      return Response.json(
        { ok: false, error: resolutionError?.message || "EntryType unavailable." },
        { status: 404 }
      );
    }

    const [rawTemplates, rawServiceCodes] = await Promise.all([
      base44.asServiceRole.entities.ReportFieldTemplate.filter({
        entry_type_id: entryType.id,
        is_active: true,
      }),
      base44.asServiceRole.entities.ServiceCode.filter({ is_active: true }),
    ]);

    const templates = asArray(rawTemplates)
      .filter(
        (template: any) =>
          template?.is_active !== false &&
          normalizeText(template?.entry_type_id) === normalizeText(entryType?.id) &&
          normalizeText(template?.entry_type_code) === normalizeText(entryType?.code) &&
          isScopedConfigurationRecord(template, organizationId)
      )
      .sort((left: any, right: any) => Number(left?.order || 0) - Number(right?.order || 0));

    const entryTypeCode = normalizeText(entryType?.code).toLowerCase();
    const serviceCodes = asArray(rawServiceCodes)
      .filter(
        (serviceCode: any) =>
          serviceCode?.is_active !== false &&
          isScopedConfigurationRecord(serviceCode, organizationId)
      )
      .filter((serviceCode: any) => {
        if (entryTypeCode === "job_coaching") {
          return normalizeText(serviceCode?.service_type) === "job_coaching";
        }

        return normalizeText(serviceCode?.program_type) === "vr";
      })
      .sort(compareServiceCodes);

    return Response.json({
      ok: true,
      organization_id: organizationId,
      entry_type: projectEntryType(entryType),
      templates: templates.map(projectTemplate),
      service_codes: serviceCodes.map(projectServiceCode),
    });
  } catch (error: any) {
    console.error(
      "getAuthorizedTimeEntryConfig error:",
      error?.message || error
    );

    return Response.json(
      { ok: false, error: "Unable to load TimeEntry configuration." },
      { status: 500 }
    );
  }
});
