import { createClientFromRequest } from "npm:@base44/sdk@0.8.23";

const PLATFORM_OWNER_ROLE = "platform_owner";
const CANONICAL_STAFF_ACCESS: Record<string, string> = {
  admin: "admin",
  management: "staff",
  employee: "staff",
};

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isActive(record: any) {
  return record?.is_active !== false && record?.is_archived !== true;
}

function getCanonicalStaffRole(user: any) {
  const role = normalizeText(user?.role).toLowerCase();
  const accessLevel = normalizeText(user?.access_level).toLowerCase();
  return CANONICAL_STAFF_ACCESS[role] === accessLevel ? role : "";
}

function classifyOrganizationScope(
  record: any,
  organizationsById: Map<string, any>
) {
  const orgId = normalizeText(record?.org_id);

  if (!orgId) {
    return {
      org_id: null,
      scope: "unscoped",
    };
  }

  const organization = organizationsById.get(orgId);

  if (!organization || !isActive(organization)) {
    return {
      org_id: orgId,
      scope: "invalid_or_inactive_org",
    };
  }

  return {
    org_id: orgId,
    scope: "organization_scoped",
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

    await req.json().catch(() => ({}));

    const base44 = createClientFromRequest(req);
    const authenticatedUser = await base44.auth.me().catch(() => null);

    if (!authenticatedUser?.id) {
      return Response.json(
        { ok: false, error: "You must be signed in to audit TimeEntry configuration scope." },
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

    if (getCanonicalStaffRole(caller) !== "admin") {
      return Response.json(
        {
          ok: false,
          error:
            "Canonical administrator access is required to audit TimeEntry configuration scope.",
        },
        { status: 403 }
      );
    }

    const platformAdminRecords =
      await base44.asServiceRole.entities.PlatformAdmin.filter({
        user_id: caller.id,
      });
    const platformOwnerRecord = platformAdminRecords.find(
      (record: any) =>
        normalizeText(record?.platform_role).toLowerCase() ===
          PLATFORM_OWNER_ROLE && isActive(record)
    );

    if (!platformOwnerRecord) {
      return Response.json(
        {
          ok: false,
          error:
            "Only an active Platform Owner may audit TimeEntry configuration scope.",
        },
        { status: 403 }
      );
    }

    const [allOrganizations, allEntryTypes, allReportFieldTemplates] =
      await Promise.all([
        base44.asServiceRole.entities.Organization.list(),
        base44.asServiceRole.entities.EntryType.list(),
        base44.asServiceRole.entities.ReportFieldTemplate.list(),
      ]);

    const organizations = Array.isArray(allOrganizations)
      ? allOrganizations
      : [];
    const entryTypes = Array.isArray(allEntryTypes) ? allEntryTypes : [];
    const reportFieldTemplates = Array.isArray(allReportFieldTemplates)
      ? allReportFieldTemplates
      : [];

    const organizationsById = new Map(
      organizations
        .map((organization: any) => [
          normalizeText(organization?.id),
          organization,
        ])
        .filter(([organizationId]) => Boolean(organizationId))
    );

    const entryTypeRows = entryTypes.map((entryType: any) => {
      const scope = classifyOrganizationScope(
        entryType,
        organizationsById
      );

      return {
        entry_type_id: normalizeText(entryType?.id) || null,
        name: normalizeText(entryType?.name) || null,
        code: normalizeText(entryType?.code) || null,
        is_active: entryType?.is_active !== false,
        org_id: scope.org_id,
        scope: scope.scope,
      };
    });

    const entryTypesById = new Map(
      entryTypes
        .map((entryType: any) => [
          normalizeText(entryType?.id),
          entryType,
        ])
        .filter(([entryTypeId]) => Boolean(entryTypeId))
    );

    const templateRows = reportFieldTemplates.map((template: any) => {
      const templateScope = classifyOrganizationScope(
        template,
        organizationsById
      );

      const entryTypeId = normalizeText(template?.entry_type_id);
      const entryType = entryTypesById.get(entryTypeId) || null;
      const entryTypeScope = entryType
        ? classifyOrganizationScope(entryType, organizationsById)
        : null;

      const entryTypeCodeMatches =
        Boolean(entryType) &&
        normalizeText(entryType?.code) ===
          normalizeText(template?.entry_type_code);

      let scopeRelationship = "entry_type_missing";

      if (entryType && entryTypeScope) {
        if (
          templateScope.scope === "unscoped" &&
          entryTypeScope.scope === "unscoped"
        ) {
          scopeRelationship = "both_unscoped";
        } else if (
          templateScope.scope === "organization_scoped" &&
          entryTypeScope.scope === "organization_scoped" &&
          templateScope.org_id === entryTypeScope.org_id
        ) {
          scopeRelationship = "same_organization";
        } else if (
          templateScope.scope === "unscoped" &&
          entryTypeScope.scope === "organization_scoped"
        ) {
          scopeRelationship = "template_unscoped_entry_type_scoped";
        } else if (
          templateScope.scope === "organization_scoped" &&
          entryTypeScope.scope === "unscoped"
        ) {
          scopeRelationship = "template_scoped_entry_type_unscoped";
        } else if (
          templateScope.scope === "organization_scoped" &&
          entryTypeScope.scope === "organization_scoped" &&
          templateScope.org_id !== entryTypeScope.org_id
        ) {
          scopeRelationship = "different_organizations";
        } else {
          scopeRelationship = "invalid_or_inactive_scope";
        }
      }

      return {
        template_id: normalizeText(template?.id) || null,
        entry_type_id: entryTypeId || null,
        entry_type_code: normalizeText(template?.entry_type_code) || null,
        field_key: normalizeText(template?.field_key) || null,
        is_active: template?.is_active !== false,
        org_id: templateScope.org_id,
        scope: templateScope.scope,
        entry_type_exists: Boolean(entryType),
        entry_type_code_matches: entryTypeCodeMatches,
        entry_type_org_id: entryTypeScope?.org_id || null,
        entry_type_scope: entryTypeScope?.scope || null,
        scope_relationship: scopeRelationship,
      };
    });

    const activeEntryTypeRows = entryTypeRows.filter(
      (row: any) => row.is_active
    );

    const activeTemplateRows = templateRows.filter(
      (row: any) => row.is_active
    );

    const templateFindings = activeTemplateRows.filter(
      (row: any) =>
        !row.entry_type_exists ||
        !row.entry_type_code_matches ||
        row.scope === "invalid_or_inactive_org" ||
        row.entry_type_scope === "invalid_or_inactive_org" ||
        row.scope_relationship === "different_organizations" ||
        row.scope_relationship === "invalid_or_inactive_scope"
    );

    return Response.json({
      ok: true,
      read_only: true,
      audit_scope: "EntryType and ReportFieldTemplate",
      summary: {
        total_entry_types: entryTypeRows.length,
        active_entry_types: activeEntryTypeRows.length,
        active_entry_types_unscoped: activeEntryTypeRows.filter(
          (row: any) => row.scope === "unscoped"
        ).length,
        active_entry_types_organization_scoped:
          activeEntryTypeRows.filter(
            (row: any) => row.scope === "organization_scoped"
          ).length,
        active_entry_types_invalid_org_scope:
          activeEntryTypeRows.filter(
            (row: any) =>
              row.scope === "invalid_or_inactive_org"
          ).length,
        total_templates: templateRows.length,
        active_templates: activeTemplateRows.length,
        active_templates_unscoped: activeTemplateRows.filter(
          (row: any) => row.scope === "unscoped"
        ).length,
        active_templates_organization_scoped:
          activeTemplateRows.filter(
            (row: any) => row.scope === "organization_scoped"
          ).length,
        active_template_findings: templateFindings.length,
      },
      entry_types: entryTypeRows,
      template_findings: templateFindings,
      templates: templateRows,
    });
  } catch (error: any) {
    console.error(
      "auditTimeEntryConfigurationScope error:",
      error?.message || error
    );

    return Response.json(
      {
        ok: false,
        error: "Unable to audit TimeEntry configuration scope.",
      },
      { status: 500 }
    );
  }
});