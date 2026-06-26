import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

const PERMISSION_CATALOG = [
  {
    permission_key: "organization.manage_members",
    permission_name: "Manage Organization Members",
    description: "Invite, activate, suspend, and remove organization members.",
    permission_category: "membership_and_roles",
    requires_feature_key: "custom_roles",
    is_sensitive: true,
    is_platform_only: false,
    sort_order: 10,
  },
  {
    permission_key: "organization.manage_roles",
    permission_name: "Manage Organization Roles",
    description: "Create, update, retire, and assign organization-specific roles.",
    permission_category: "membership_and_roles",
    requires_feature_key: "custom_roles",
    is_sensitive: true,
    is_platform_only: false,
    sort_order: 20,
  },
  {
    permission_key: "organization.manage_settings",
    permission_name: "Manage Organization Settings",
    description: "Manage organization-level operational settings.",
    permission_category: "organization_administration",
    requires_feature_key: "",
    is_sensitive: true,
    is_platform_only: false,
    sort_order: 30,
  },
  {
    permission_key: "organization.view_billing",
    permission_name: "View Billing",
    description: "View organization subscription, billing status, and plan details.",
    permission_category: "billing",
    requires_feature_key: "",
    is_sensitive: true,
    is_platform_only: false,
    sort_order: 40,
  },
  {
    permission_key: "organization.manage_billing",
    permission_name: "Manage Billing",
    description: "Manage organization subscription, plan changes, and billing settings.",
    permission_category: "billing",
    requires_feature_key: "",
    is_sensitive: true,
    is_platform_only: false,
    sort_order: 50,
  },
  {
    permission_key: "organization.view_security_history",
    permission_name: "View Security History",
    description: "View organization-visible support and security audit history.",
    permission_category: "organization_administration",
    requires_feature_key: "",
    is_sensitive: true,
    is_platform_only: false,
    sort_order: 60,
  },
  {
    permission_key: "client_management.view_all_clients",
    permission_name: "View All Clients",
    description: "View all client records within the organization.",
    permission_category: "client_management",
    requires_feature_key: "client_management",
    is_sensitive: true,
    is_platform_only: false,
    sort_order: 100,
  },
  {
    permission_key: "client_management.manage_clients",
    permission_name: "Manage Clients",
    description: "Create and update client records within the organization.",
    permission_category: "client_management",
    requires_feature_key: "client_management",
    is_sensitive: true,
    is_platform_only: false,
    sort_order: 110,
  },
  {
    permission_key: "ce_training.manage_cohorts",
    permission_name: "Manage CE Training Cohorts",
    description: "Create and manage CE Training Portal cohorts.",
    permission_category: "ce_training",
    requires_feature_key: "ce_cohorts",
    is_sensitive: true,
    is_platform_only: false,
    sort_order: 200,
  },
  {
    permission_key: "ce_training.manage_trainers",
    permission_name: "Manage CE Trainers",
    description: "Assign and remove trainers from CE training cohorts.",
    permission_category: "ce_training",
    requires_feature_key: "ce_training_portal",
    is_sensitive: true,
    is_platform_only: false,
    sort_order: 210,
  },
  {
    permission_key: "ce_training.manage_students",
    permission_name: "Manage CE Students",
    description: "Invite, enroll, and manage CE training students.",
    permission_category: "ce_training",
    requires_feature_key: "ce_training_portal",
    is_sensitive: true,
    is_platform_only: false,
    sort_order: 220,
  },
  {
    permission_key: "ce_training.view_all_cohort_clients",
    permission_name: "View Cohort CE Clients",
    description: "View CE clients linked to training cohorts assigned to the organization.",
    permission_category: "ce_training",
    requires_feature_key: "ce_training_portal",
    is_sensitive: true,
    is_platform_only: false,
    sort_order: 230,
  },
  {
    permission_key: "ce_practice.manage_clients",
    permission_name: "Manage CE Practice Clients",
    description: "Create and manage CE clients in the practitioner workspace.",
    permission_category: "ce_practice",
    requires_feature_key: "ce_practitioner_workspace",
    is_sensitive: true,
    is_platform_only: false,
    sort_order: 300,
  },
  {
    permission_key: "ce_practice.view_assigned_clients",
    permission_name: "View Assigned CE Clients",
    description: "View CE clients assigned to the practitioner.",
    permission_category: "ce_practice",
    requires_feature_key: "ce_practitioner_workspace",
    is_sensitive: false,
    is_platform_only: false,
    sort_order: 310,
  },
  {
    permission_key: "time_tracking.view_own_entries",
    permission_name: "View Own Time Entries",
    description: "View the member's own time entries.",
    permission_category: "time_tracking",
    requires_feature_key: "time_tracking",
    is_sensitive: false,
    is_platform_only: false,
    sort_order: 400,
  },
  {
    permission_key: "time_tracking.view_all_entries",
    permission_name: "View All Time Entries",
    description: "View organization time entries.",
    permission_category: "time_tracking",
    requires_feature_key: "time_tracking",
    is_sensitive: true,
    is_platform_only: false,
    sort_order: 410,
  },
  {
    permission_key: "time_tracking.manage_entries",
    permission_name: "Manage Time Entries",
    description: "Create, edit, and correct organization time entries.",
    permission_category: "time_tracking",
    requires_feature_key: "time_tracking",
    is_sensitive: true,
    is_platform_only: false,
    sort_order: 420,
  },
  {
    permission_key: "time_tracking.approve_entries",
    permission_name: "Approve Time Entries",
    description: "Approve or reject submitted time entries.",
    permission_category: "time_tracking",
    requires_feature_key: "time_tracking",
    is_sensitive: true,
    is_platform_only: false,
    sort_order: 430,
  },
  {
    permission_key: "assessments.view_assigned",
    permission_name: "View Assigned Assessments",
    description: "View assessments for assigned clients.",
    permission_category: "assessments",
    requires_feature_key: "assessments",
    is_sensitive: false,
    is_platform_only: false,
    sort_order: 500,
  },
  {
    permission_key: "assessments.manage",
    permission_name: "Manage Assessments",
    description: "Create, edit, and complete assessments.",
    permission_category: "assessments",
    requires_feature_key: "assessments",
    is_sensitive: true,
    is_platform_only: false,
    sort_order: 510,
  },
  {
    permission_key: "documents.view_assigned",
    permission_name: "View Assigned Documents",
    description: "View documents for assigned clients.",
    permission_category: "documents",
    requires_feature_key: "documents",
    is_sensitive: false,
    is_platform_only: false,
    sort_order: 600,
  },
  {
    permission_key: "documents.manage",
    permission_name: "Manage Documents",
    description: "Upload, edit, and manage organization documents.",
    permission_category: "documents",
    requires_feature_key: "documents",
    is_sensitive: true,
    is_platform_only: false,
    sort_order: 610,
  },
  {
    permission_key: "ai_tools.use",
    permission_name: "Use AI Tools",
    description: "Use enabled AI-assisted platform tools.",
    permission_category: "ai_tools",
    requires_feature_key: "ai_tools",
    is_sensitive: false,
    is_platform_only: false,
    sort_order: 700,
  },
  {
    permission_key: "reporting.view",
    permission_name: "View Reports",
    description: "View organization reports and dashboards.",
    permission_category: "reporting",
    requires_feature_key: "advanced_reporting",
    is_sensitive: false,
    is_platform_only: false,
    sort_order: 800,
  },
  {
    permission_key: "reporting.manage",
    permission_name: "Manage Reports",
    description: "Create, configure, and export organization reports.",
    permission_category: "reporting",
    requires_feature_key: "advanced_reporting",
    is_sensitive: true,
    is_platform_only: false,
    sort_order: 810,
  },
  {
    permission_key: "platform_support.open_read_only_session",
    permission_name: "Open Read-Only Support Session",
    description: "Open an audited read-only platform support session.",
    permission_category: "platform_support",
    requires_feature_key: "",
    is_sensitive: true,
    is_platform_only: true,
    sort_order: 900,
  },
  {
    permission_key: "platform_support.open_elevated_session",
    permission_name: "Open Elevated Support Session",
    description: "Open an audited elevated platform support session.",
    permission_category: "platform_support",
    requires_feature_key: "",
    is_sensitive: true,
    is_platform_only: true,
    sort_order: 910,
  },
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const platformOwnerRows =
      await base44.asServiceRole.entities.PlatformAdmin.filter({
        user_id: user.id,
        platform_role: "platform_owner",
        is_active: true,
      });

    const isPlatformOwner = (Array.isArray(platformOwnerRows)
      ? platformOwnerRows
      : []
    ).some((row) => row?.is_active !== false);

    if (!isPlatformOwner) {
      return Response.json(
        {
          ok: false,
          error: "Only an active Platform Owner can seed platform permissions.",
        },
        { status: 403 }
      );
    }

    const existingRows =
      await base44.asServiceRole.entities.PlatformPermission.list();

    const existingByKey = new Map(
      (Array.isArray(existingRows) ? existingRows : [])
        .filter((row) => row?.permission_key)
        .map((row) => [row.permission_key, row])
    );

    const createdKeys = [];
    const existingKeys = [];

    for (const permission of PERMISSION_CATALOG) {
      if (existingByKey.has(permission.permission_key)) {
        existingKeys.push(permission.permission_key);
        continue;
      }

      await base44.asServiceRole.entities.PlatformPermission.create({
        ...permission,
        is_active: true,
      });

      createdKeys.push(permission.permission_key);
    }

    const now = new Date().toISOString();

    await base44.asServiceRole.entities.PlatformAuditLog.create({
      platform_admin_user_id: user.id,
      event_key: "platform_permission_catalog_seeded",
      event_summary:
        "The initial platform permission catalog was seeded without granting permissions to any organization member.",
      actor_type: "platform_admin",
      target_entity: "PlatformPermission",
      target_record_id: null,
      tenant_visible: false,
      occurred_at: now,
      details: {
        created_count: createdKeys.length,
        existing_count: existingKeys.length,
        catalog_count: PERMISSION_CATALOG.length,
      },
    });

    return Response.json({
      ok: true,
      created_count: createdKeys.length,
      existing_count: existingKeys.length,
      catalog_count: PERMISSION_CATALOG.length,
      message:
        "Platform permission catalog seeded. No user or organization permissions were changed.",
    });
  } catch (error) {
    console.error(
      "seedPlatformPermissionCatalog error:",
      error?.message || error
    );

    return Response.json(
      {
        ok: false,
        error:
          error?.message || "Unable to seed the platform permission catalog.",
      },
      { status: 500 }
    );
  }
});
