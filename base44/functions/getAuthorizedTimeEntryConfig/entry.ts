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
    entry_type_id: normalizeText(template?.entry_type_id),
    entry_type_code: normalizeText(template?.entry_type_code),
    field_key: normalizeText(template?.field_key),
    label: normalizeText(template?.label),
    field_type: normalizeText(template?.field_type) || "text",
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

    if (action !== "list_entry_types" && action !== "get_entry_type_configuration") {
      return Response.json(
        { ok: false, error: "Choose a valid TimeEntry configuration action." },
        { status: 400 }
      );
    }

    if (action === "get_entry_type_configuration" && !requestedEntryTypeId) {
      return Response.json(
        { ok: false, error: "Choose an EntryType before loading its configuration." },
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
        { ok: false, error: "Your account is not authorized to load TimeEntry configuration." },
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
      .filter((entryType: any) => {
        const entryTypeOrgId = normalizeText(entryType?.org_id);
        return (
          entryType?.is_active !== false &&
          (!entryTypeOrgId || entryTypeOrgId === organizationId)
        );
      })
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

    const entryType = activeEntryTypes.find(
      (candidate: any) => normalizeText(candidate?.id) === requestedEntryTypeId
    );

    if (!entryType) {
      return Response.json(
        { ok: false, error: "The requested EntryType is unavailable to your organization." },
        { status: 404 }
      );
    }

    const templates = asArray(
      await base44.asServiceRole.entities.ReportFieldTemplate.filter({
        entry_type_id: entryType.id,
        is_active: true,
      })
    )
      .filter((template: any) => {
        const templateOrgId = normalizeText(template?.org_id);
        return (
          template?.is_active !== false &&
          normalizeText(template?.entry_type_id) === normalizeText(entryType?.id) &&
          normalizeText(template?.entry_type_code) === normalizeText(entryType?.code) &&
          (!templateOrgId || templateOrgId === organizationId)
        );
      })
      .sort((left: any, right: any) => Number(left?.order || 0) - Number(right?.order || 0));

    return Response.json({
      ok: true,
      organization_id: organizationId,
      entry_type: projectEntryType(entryType),
      templates: templates.map(projectTemplate),
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
