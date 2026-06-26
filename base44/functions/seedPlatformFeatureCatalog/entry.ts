import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

const FEATURE_CATALOG = [
  {
    feature_key: "core_platform",
    feature_name: "Core Platform Access",
    description:
      "Basic authenticated access to the Career Navigator platform.",
    feature_category: "core_platform",
    supports_limit: false,
    limit_label: "",
    is_billable_add_on: false,
    sort_order: 10,
  },
  {
    feature_key: "custom_roles",
    feature_name: "Custom Organization Roles",
    description:
      "Allows an organization to create its own internal role titles and permission assignments.",
    feature_category: "administration",
    supports_limit: false,
    limit_label: "",
    is_billable_add_on: true,
    sort_order: 20,
  },
  {
    feature_key: "employee_seats",
    feature_name: "Employee Seats",
    description:
      "Sets the number of active employee, staff, trainer, or practitioner memberships allowed for an organization.",
    feature_category: "administration",
    supports_limit: true,
    limit_label: "Employee Seats",
    is_billable_add_on: true,
    sort_order: 30,
  },
  {
    feature_key: "client_records",
    feature_name: "Client Records",
    description:
      "Sets the number of active client records an organization may manage.",
    feature_category: "client_management",
    supports_limit: true,
    limit_label: "Client Records",
    is_billable_add_on: true,
    sort_order: 40,
  },
  {
    feature_key: "client_management",
    feature_name: "Client Management",
    description:
      "Allows organizations to create, view, and manage client records.",
    feature_category: "client_management",
    supports_limit: false,
    limit_label: "",
    is_billable_add_on: false,
    sort_order: 50,
  },
  {
    feature_key: "ce_training_portal",
    feature_name: "CE Training Portal",
    description:
      "Allows a Trainer Business Account to enroll students and use CE Training Portal workflows.",
    feature_category: "ce_training",
    supports_limit: false,
    limit_label: "",
    is_billable_add_on: true,
    sort_order: 100,
  },
  {
    feature_key: "ce_cohorts",
    feature_name: "CE Training Cohorts",
    description:
      "Allows creation and management of CE training cohorts.",
    feature_category: "ce_training",
    supports_limit: true,
    limit_label: "Active CE Cohorts",
    is_billable_add_on: true,
    sort_order: 110,
  },
  {
    feature_key: "ce_trainer_seats",
    feature_name: "CE Trainer Seats",
    description:
      "Sets the number of active CE trainer assignments available to a Trainer Business Account.",
    feature_category: "ce_training",
    supports_limit: true,
    limit_label: "CE Trainer Seats",
    is_billable_add_on: true,
    sort_order: 120,
  },
  {
    feature_key: "ce_student_seats",
    feature_name: "CE Student Seats",
    description:
      "Sets the number of active CE student enrollments available to a Trainer Business Account.",
    feature_category: "ce_training",
    supports_limit: true,
    limit_label: "CE Student Seats",
    is_billable_add_on: true,
    sort_order: 130,
  },
   {
    feature_key: "ce_training_client_workspace",
    feature_name: "CE Training Client Workspace",
    description:
      "Allows actively enrolled CE students and their assigned trainers to create, enter, review, and manage CE client work within an active training cohort. This feature is cohort-scoped and does not provide post-graduation independent practitioner access.",
    feature_category: "ce_training",
    supports_limit: false,
    limit_label: "",
    is_billable_add_on: true,
    sort_order: 140,
  },
  {
    feature_key: "ce_practitioner_workspace",
    feature_name: "CE Practitioner Workspace",
    description:
      "Allows CE practitioners to manage Discovery, CE client work, and ongoing Customized Employment services after they are connected to a Business CE Account or Individual CE Account.",
    feature_category: "ce_practice",
    supports_limit: false,
    limit_label: "",
    is_billable_add_on: true,
    sort_order: 200,
  },
  {
    feature_key: "ce_practitioner_seats",
    feature_name: "CE Practitioner Seats",
    description:
      "Sets the number of active CE practitioner memberships allowed for a business account.",
    feature_category: "ce_practice",
    supports_limit: true,
    limit_label: "CE Practitioner Seats",
    is_billable_add_on: true,
    sort_order: 210,
  },
  {
    feature_key: "time_tracking",
    feature_name: "Time Tracking",
    description:
      "Allows organizations to use employee time tracking and approval workflows.",
    feature_category: "workforce_management",
    supports_limit: false,
    limit_label: "",
    is_billable_add_on: true,
    sort_order: 300,
  },
  {
    feature_key: "client_portal",
    feature_name: "Client Portal",
    description:
      "Allows client-facing portal accounts and client-visible content.",
    feature_category: "client_management",
    supports_limit: false,
    limit_label: "",
    is_billable_add_on: true,
    sort_order: 310,
  },
  {
    feature_key: "assessments",
    feature_name: "Assessments",
    description:
      "Allows assessment workflows including WSA, employment barriers, transportation, and CE Discovery assessments.",
    feature_category: "assessments",
    supports_limit: false,
    limit_label: "",
    is_billable_add_on: true,
    sort_order: 400,
  },
  {
    feature_key: "documents",
    feature_name: "Document Management",
    description:
      "Allows document uploads, storage, review, and document-based workflows.",
    feature_category: "client_management",
    supports_limit: true,
    limit_label: "Document Storage",
    is_billable_add_on: true,
    sort_order: 500,
  },
  {
    feature_key: "ai_tools",
    feature_name: "AI Tools",
    description:
      "Allows enabled AI-assisted tools and workflows.",
    feature_category: "ai_tools",
    supports_limit: true,
    limit_label: "AI Usage Allowance",
    is_billable_add_on: true,
    sort_order: 600,
  },
  {
    feature_key: "advanced_reporting",
    feature_name: "Advanced Reporting",
    description:
      "Allows advanced dashboards, reporting, exports, and organization analytics.",
    feature_category: "reporting",
    supports_limit: false,
    limit_label: "",
    is_billable_add_on: true,
    sort_order: 700,
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
          error:
            "Only an active Platform Owner can seed platform features.",
        },
        { status: 403 }
      );
    }

    const existingRows =
      await base44.asServiceRole.entities.PlatformFeature.list();

    const existingByKey = new Map(
      (Array.isArray(existingRows) ? existingRows : [])
        .filter((row) => row?.feature_key)
        .map((row) => [row.feature_key, row])
    );

    const createdKeys = [];
    const existingKeys = [];

    for (const feature of FEATURE_CATALOG) {
      if (existingByKey.has(feature.feature_key)) {
        existingKeys.push(feature.feature_key);
        continue;
      }

      await base44.asServiceRole.entities.PlatformFeature.create({
        ...feature,
        is_active: true,
      });

      createdKeys.push(feature.feature_key);
    }

    const now = new Date().toISOString();

    await base44.asServiceRole.entities.PlatformAuditLog.create({
      platform_admin_user_id: user.id,
      event_key: "platform_feature_catalog_seeded",
      event_summary:
        "The initial platform feature catalog was seeded without enabling features for any organization.",
      actor_type: "platform_admin",
      target_entity: "PlatformFeature",
      target_record_id: null,
      tenant_visible: false,
      occurred_at: now,
      details: {
        created_count: createdKeys.length,
        existing_count: existingKeys.length,
        catalog_count: FEATURE_CATALOG.length,
      },
    });

    return Response.json({
      ok: true,
      created_count: createdKeys.length,
      existing_count: existingKeys.length,
      catalog_count: FEATURE_CATALOG.length,
      message:
        "Platform feature catalog seeded. No organization features or limits were changed.",
    });
  } catch (error) {
    console.error(
      "seedPlatformFeatureCatalog error:",
      error?.message || error
    );

    return Response.json(
      {
        ok: false,
        error:
          error?.message ||
          "Unable to seed the platform feature catalog.",
      },
      { status: 500 }
    );
  }
});
