import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

const LEGACY_TENANT_KEY = "COMOP";

const MIGRATION_TARGETS = [
  {
    entity_name: "User",
    organization_field: "org_id",
  },
  {
    entity_name: "PendingRoleAssignment",
    organization_field: "org_id",
  },
  {
    entity_name: "CETrainingCohort",
    organization_field: "org_id",
  },
  {
    entity_name: "ManagerEmployeeAssignment",
    organization_field: "org_id",
  },
  {
    entity_name: "OrganizationPlanSubscription",
    organization_field: "organization_id",
  },
  {
    entity_name: "OrganizationBillingEvent",
    organization_field: "organization_id",
  },
];

function createHttpError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

function normalizeText(value: unknown) {
  return String(value || "").trim();
}

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function getServiceEntities(base44: any) {
  return base44.asServiceRole.entities as Record<string, any>;
}

async function requirePlatformOwner(base44: any, userId: string) {
  const rows = await base44.asServiceRole.entities.PlatformAdmin.filter({
    user_id: userId,
    platform_role: "platform_owner",
    is_active: true,
  });

  const isPlatformOwner = (Array.isArray(rows) ? rows : []).some(
    (row) => row?.is_active !== false
  );

  if (!isPlatformOwner) {
    throw createHttpError(
      403,
      "Only an active Platform Owner can migrate a legacy tenant key."
    );
  }
}

async function loadLegacyRecordInventory(base44: any) {
  const entities = getServiceEntities(base44);
  const inventory: Array<{
    entity_name: string;
    organization_field: string;
    records: any[];
  }> = [];

  for (const target of MIGRATION_TARGETS) {
    const entityApi = entities[target.entity_name];

    if (!entityApi?.filter) {
      throw createHttpError(
        409,
        `The ${target.entity_name} entity could not be resolved. No migration changes were made.`
      );
    }

    const rows = await entityApi.filter({
      [target.organization_field]: LEGACY_TENANT_KEY,
    });

    inventory.push({
      entity_name: target.entity_name,
      organization_field: target.organization_field,
      records: Array.isArray(rows) ? rows : [],
    });
  }

  return inventory;
}

async function resolveCanonicalOrganization(
  base44: any,
  callerEmail: string,
  mode: string,
  organizationName: string
) {
  const organizations =
    await base44.asServiceRole.entities.Organization.list();

  const matchingOrganizations = (
    Array.isArray(organizations) ? organizations : []
  ).filter(
    (organization) =>
      normalizeText(organization?.tenant_key) === LEGACY_TENANT_KEY
  );

  if (matchingOrganizations.length > 1) {
    throw createHttpError(
      409,
      "Multiple Organization records use tenant_key COMOP. Resolve those duplicates before migration."
    );
  }

  if (matchingOrganizations.length === 1) {
    return {
      organization: matchingOrganizations[0],
      created: false,
    };
  }

  if (mode !== "apply") {
    return {
      organization: null,
      created: false,
    };
  }

  if (!organizationName) {
    throw createHttpError(
      400,
      "organization_name is required when creating the canonical Organization record."
    );
  }

  const organization =
    await base44.asServiceRole.entities.Organization.create({
      name: organizationName,
      tenant_key: LEGACY_TENANT_KEY,
      owner_email: callerEmail,
      is_active: true,
    });

  return {
    organization,
    created: true,
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me();

    if (!caller) {
      return Response.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    await requirePlatformOwner(base44, caller.id);

    const body = await req.json().catch(() => ({}));
    const mode = normalizeText(body?.mode || "preview").toLowerCase();
    const organizationName = normalizeText(body?.organization_name);

    if (!["preview", "apply"].includes(mode)) {
      throw createHttpError(
        400,
        'mode must be either "preview" or "apply".'
      );
    }

    if (
      mode === "apply" &&
      normalizeText(body?.confirm_tenant_key) !== LEGACY_TENANT_KEY
    ) {
      throw createHttpError(
        400,
        'Apply mode requires confirm_tenant_key: "COMOP".'
      );
    }

    const inventory = await loadLegacyRecordInventory(base44);

    const organizationResult = await resolveCanonicalOrganization(
      base44,
      normalizeEmail(caller.email),
      mode,
      organizationName
    );

    const inventorySummary = inventory.map((target) => ({
      entity_name: target.entity_name,
      organization_field: target.organization_field,
      legacy_record_count: target.records.length,
      record_ids: target.records
        .map((record) => record?.id)
        .filter(Boolean),
    }));

    if (mode === "preview") {
      return Response.json({
        ok: true,
        mode: "preview",
        legacy_tenant_key: LEGACY_TENANT_KEY,
        canonical_organization_exists: !!organizationResult.organization,
        canonical_organization_id:
          organizationResult.organization?.id || null,
        canonical_organization_name:
          organizationResult.organization?.name || null,
        organization_will_be_created: !organizationResult.organization,
        migration_scope: inventorySummary,
        message:
          "Preview complete. No records were created or updated.",
      });
    }

    const organization = organizationResult.organization;
    const canonicalOrganizationId = normalizeText(organization?.id);

    if (!canonicalOrganizationId) {
      throw createHttpError(
        409,
        "The canonical Organization record is missing its Base44 record ID."
      );
    }

    const entities = getServiceEntities(base44);
    const updateResults: Array<{
      entity_name: string;
      updated_count: number;
      updated_record_ids: string[];
    }> = [];

    for (const target of inventory) {
      const entityApi = entities[target.entity_name];
      const updatedRecordIds: string[] = [];

      for (const record of target.records) {
        if (!record?.id) {
          continue;
        }

        await entityApi.update(record.id, {
          [target.organization_field]: canonicalOrganizationId,
        });

        updatedRecordIds.push(record.id);
      }

      updateResults.push({
        entity_name: target.entity_name,
        updated_count: updatedRecordIds.length,
        updated_record_ids: updatedRecordIds,
      });
    }

    const now = new Date().toISOString();

    try {
      await base44.asServiceRole.entities.PlatformAuditLog.create({
        platform_admin_user_id: caller.id,
        event_key: "legacy_comop_tenant_migrated",
        event_summary:
          "Legacy COMOP organization references were migrated to one canonical Organization record ID.",
        actor_type: "platform_admin",
        target_entity: "Organization",
        target_record_id: canonicalOrganizationId,
        tenant_visible: false,
        occurred_at: now,
        details: {
          legacy_tenant_key: LEGACY_TENANT_KEY,
          canonical_organization_id: canonicalOrganizationId,
          canonical_organization_name: organization.name || null,
          organization_created: organizationResult.created,
          migration_results: updateResults,
        },
      });
    } catch (auditError) {
      console.error(
        "Legacy tenant migration audit logging failed:",
        auditError?.message || auditError
      );
    }

    return Response.json({
      ok: true,
      mode: "apply",
      legacy_tenant_key: LEGACY_TENANT_KEY,
      canonical_organization_id: canonicalOrganizationId,
      canonical_organization_name: organization.name || null,
      canonical_organization_created: organizationResult.created,
      migration_results: updateResults,
      message:
        "COMOP has been retained only as Organization.tenant_key. The migrated CE and billing records now use the canonical Organization record ID.",
    });
  } catch (error) {
    console.error(
      "migrateLegacyComopTenantToCanonicalOrganization error:",
      error?.message || error
    );

    return Response.json(
      {
        ok: false,
        error:
          error?.message ||
          "Unable to migrate the legacy COMOP tenant.",
      },
      {
        status: Number(
          (error as Error & { status?: number })?.status
        ) || 500,
      }
    );
  }
});
