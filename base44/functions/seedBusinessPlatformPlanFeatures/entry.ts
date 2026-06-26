import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

type Mapping = {
  plan_key: string;
  feature_key: string;
  is_included: boolean;
  is_add_on_available: boolean;
  default_limit_value?: number;
  sort_order: number;
};

const BUSINESS_PLATFORM_PLAN_MAPPINGS: Mapping[] = [
  // ── Business Platform — Starter ──────────────────────────────────────────
  {
    plan_key: "business_platform_starter_monthly",
    feature_key: "core_platform",
    is_included: true,
    is_add_on_available: false,
    sort_order: 10,
  },
  {
    plan_key: "business_platform_starter_monthly",
    feature_key: "custom_roles",
    is_included: true,
    is_add_on_available: false,
    sort_order: 20,
  },
  {
    plan_key: "business_platform_starter_monthly",
    feature_key: "client_management",
    is_included: true,
    is_add_on_available: false,
    sort_order: 30,
  },
  {
    plan_key: "business_platform_starter_monthly",
    feature_key: "employee_seats",
    is_included: true,
    is_add_on_available: false,
    default_limit_value: 5,
    sort_order: 40,
  },
  {
    plan_key: "business_platform_starter_monthly",
    feature_key: "client_records",
    is_included: true,
    is_add_on_available: false,
    default_limit_value: 65,
    sort_order: 50,
  },
  {
    plan_key: "business_platform_starter_monthly",
    feature_key: "assessments",
    is_included: true,
    is_add_on_available: false,
    sort_order: 60,
  },
  {
    plan_key: "business_platform_starter_monthly",
    feature_key: "documents",
    is_included: true,
    is_add_on_available: false,
    sort_order: 70,
  },
  {
    plan_key: "business_platform_starter_monthly",
    feature_key: "time_tracking",
    is_included: true,
    is_add_on_available: false,
    sort_order: 80,
  },
  {
    plan_key: "business_platform_starter_monthly",
    feature_key: "client_portal",
    is_included: true,
    is_add_on_available: false,
    sort_order: 90,
  },
  {
    plan_key: "business_platform_starter_monthly",
    feature_key: "ai_tools",
    is_included: false,
    is_add_on_available: true,
    sort_order: 100,
  },
  {
    plan_key: "business_platform_starter_monthly",
    feature_key: "advanced_reporting",
    is_included: false,
    is_add_on_available: true,
    sort_order: 110,
  },
  {
    plan_key: "business_platform_starter_monthly",
    feature_key: "ce_practitioner_workspace",
    is_included: false,
    is_add_on_available: true,
    sort_order: 120,
  },

  // ── Business Platform — Growth ───────────────────────────────────────────
  {
    plan_key: "business_platform_growth_monthly",
    feature_key: "core_platform",
    is_included: true,
    is_add_on_available: false,
    sort_order: 10,
  },
  {
    plan_key: "business_platform_growth_monthly",
    feature_key: "custom_roles",
    is_included: true,
    is_add_on_available: false,
    sort_order: 20,
  },
  {
    plan_key: "business_platform_growth_monthly",
    feature_key: "client_management",
    is_included: true,
    is_add_on_available: false,
    sort_order: 30,
  },
  {
    plan_key: "business_platform_growth_monthly",
    feature_key: "employee_seats",
    is_included: true,
    is_add_on_available: false,
    default_limit_value: 10,
    sort_order: 40,
  },
  {
    plan_key: "business_platform_growth_monthly",
    feature_key: "client_records",
    is_included: true,
    is_add_on_available: false,
    default_limit_value: 150,
    sort_order: 50,
  },
  {
    plan_key: "business_platform_growth_monthly",
    feature_key: "assessments",
    is_included: true,
    is_add_on_available: false,
    sort_order: 60,
  },
  {
    plan_key: "business_platform_growth_monthly",
    feature_key: "documents",
    is_included: true,
    is_add_on_available: false,
    sort_order: 70,
  },
  {
    plan_key: "business_platform_growth_monthly",
    feature_key: "time_tracking",
    is_included: true,
    is_add_on_available: false,
    sort_order: 80,
  },
  {
    plan_key: "business_platform_growth_monthly",
    feature_key: "client_portal",
    is_included: true,
    is_add_on_available: false,
    sort_order: 90,
  },
  {
    plan_key: "business_platform_growth_monthly",
    feature_key: "ai_tools",
    is_included: false,
    is_add_on_available: true,
    sort_order: 100,
  },
  {
    plan_key: "business_platform_growth_monthly",
    feature_key: "advanced_reporting",
    is_included: false,
    is_add_on_available: true,
    sort_order: 110,
  },
  {
    plan_key: "business_platform_growth_monthly",
    feature_key: "ce_practitioner_workspace",
    is_included: false,
    is_add_on_available: true,
    sort_order: 120,
  },

  // ── Business Platform — Enterprise ───────────────────────────────────────
  {
    plan_key: "business_platform_enterprise_monthly",
    feature_key: "core_platform",
    is_included: true,
    is_add_on_available: false,
    sort_order: 10,
  },
  {
    plan_key: "business_platform_enterprise_monthly",
    feature_key: "custom_roles",
    is_included: true,
    is_add_on_available: false,
    sort_order: 20,
  },
  {
    plan_key: "business_platform_enterprise_monthly",
    feature_key: "client_management",
    is_included: true,
    is_add_on_available: false,
    sort_order: 30,
  },
  {
    plan_key: "business_platform_enterprise_monthly",
    feature_key: "employee_seats",
    is_included: true,
    is_add_on_available: false,
    default_limit_value: 25,
    sort_order: 40,
  },
  {
    plan_key: "business_platform_enterprise_monthly",
    feature_key: "client_records",
    is_included: true,
    is_add_on_available: false,
    default_limit_value: 375,
    sort_order: 50,
  },
  {
    plan_key: "business_platform_enterprise_monthly",
    feature_key: "assessments",
    is_included: true,
    is_add_on_available: false,
    sort_order: 60,
  },
  {
    plan_key: "business_platform_enterprise_monthly",
    feature_key: "documents",
    is_included: true,
    is_add_on_available: false,
    sort_order: 70,
  },
  {
    plan_key: "business_platform_enterprise_monthly",
    feature_key: "time_tracking",
    is_included: true,
    is_add_on_available: false,
    sort_order: 80,
  },
  {
    plan_key: "business_platform_enterprise_monthly",
    feature_key: "client_portal",
    is_included: true,
    is_add_on_available: false,
    sort_order: 90,
  },
  {
    plan_key: "business_platform_enterprise_monthly",
    feature_key: "ai_tools",
    is_included: false,
    is_add_on_available: true,
    sort_order: 100,
  },
  {
    plan_key: "business_platform_enterprise_monthly",
    feature_key: "advanced_reporting",
    is_included: false,
    is_add_on_available: true,
    sort_order: 110,
  },
  {
    plan_key: "business_platform_enterprise_monthly",
    feature_key: "ce_practitioner_workspace",
    is_included: false,
    is_add_on_available: true,
    sort_order: 120,
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
            "Only an active Platform Owner can seed Business Platform plan mappings.",
        },
        { status: 403 }
      );
    }

    const [plans, features, existingMappings] = await Promise.all([
      base44.asServiceRole.entities.PlatformPlan.list(),
      base44.asServiceRole.entities.PlatformFeature.list(),
      base44.asServiceRole.entities.PlatformPlanFeature.list(),
    ]);

    const planByKey = new Map(
      (Array.isArray(plans) ? plans : [])
        .filter((row) => row?.plan_key)
        .map((row) => [row.plan_key, row])
    );

    const featureByKey = new Map(
      (Array.isArray(features) ? features : [])
        .filter((row) => row?.feature_key)
        .map((row) => [row.feature_key, row])
    );

    const existingByMappingKey = new Map(
      (Array.isArray(existingMappings) ? existingMappings : [])
        .filter((row) => row?.plan_feature_key)
        .map((row) => [row.plan_feature_key, row])
    );

    const missingPlanKeys = Array.from(
      new Set(
        BUSINESS_PLATFORM_PLAN_MAPPINGS.map(
          (mapping) => mapping.plan_key
        ).filter((key) => !planByKey.has(key))
      )
    );

    const missingFeatureKeys = Array.from(
      new Set(
        BUSINESS_PLATFORM_PLAN_MAPPINGS.map(
          (mapping) => mapping.feature_key
        ).filter((key) => !featureByKey.has(key))
      )
    );

    if (missingPlanKeys.length > 0 || missingFeatureKeys.length > 0) {
      return Response.json(
        {
          ok: false,
          error:
            "Required plan or feature catalog records are missing. No Business Platform mappings were created.",
          missing_plan_keys: missingPlanKeys,
          missing_feature_keys: missingFeatureKeys,
        },
        { status: 409 }
      );
    }

    const createdKeys: string[] = [];
    const updatedKeys: string[] = [];
    const alreadyCorrectKeys: string[] = [];

    for (const mapping of BUSINESS_PLATFORM_PLAN_MAPPINGS) {
      const plan = planByKey.get(mapping.plan_key);
      const feature = featureByKey.get(mapping.feature_key);

      if (!plan || !feature) {
        continue;
      }

      const planFeatureKey = `${mapping.plan_key}:${mapping.feature_key}`;
      const existing = existingByMappingKey.get(planFeatureKey);

      const nextData = {
        platform_plan_id: plan.id,
        platform_feature_id: feature.id,
        plan_feature_key: planFeatureKey,
        feature_key: mapping.feature_key,
        is_included: mapping.is_included,
        is_add_on_available: mapping.is_add_on_available,
        default_limit_value: mapping.default_limit_value,
        is_active: true,
        sort_order: mapping.sort_order,
      };

      if (!existing) {
        await base44.asServiceRole.entities.PlatformPlanFeature.create(
          nextData
        );
        createdKeys.push(planFeatureKey);
        continue;
      }

      const isAlreadyCorrect =
        existing.platform_plan_id === nextData.platform_plan_id &&
        existing.platform_feature_id === nextData.platform_feature_id &&
        existing.feature_key === nextData.feature_key &&
        existing.is_included === nextData.is_included &&
        existing.is_add_on_available === nextData.is_add_on_available &&
        (existing.default_limit_value ?? null) ===
          (nextData.default_limit_value ?? null) &&
        existing.is_active === true &&
        existing.sort_order === nextData.sort_order;

      if (isAlreadyCorrect) {
        alreadyCorrectKeys.push(planFeatureKey);
        continue;
      }

      await base44.asServiceRole.entities.PlatformPlanFeature.update(
        existing.id,
        nextData
      );

      updatedKeys.push(planFeatureKey);
    }

    const now = new Date().toISOString();

    await base44.asServiceRole.entities.PlatformAuditLog.create({
      platform_admin_user_id: user.id,
      event_key: "business_platform_plan_features_seeded",
      event_summary:
        "Included modules, add-on availability, and default capacity limits were configured for the Business Platform plan templates.",
      actor_type: "platform_admin",
      target_entity: "PlatformPlanFeature",
      tenant_visible: false,
      occurred_at: now,
      details: {
        created_count: createdKeys.length,
        updated_count: updatedKeys.length,
        already_correct_count: alreadyCorrectKeys.length,
        included_modules: [
          "client_management",
          "assessments",
          "documents",
          "time_tracking",
          "client_portal",
        ],
        add_on_features: [
          "ai_tools",
          "advanced_reporting",
          "ce_practitioner_workspace",
        ],
        ce_practitioner_workspace_rule:
          "Organization-level add-on availability only. Employee workspace access requires verified CE certification and explicit practitioner role assignment in a future access workflow.",
      },
    });

    return Response.json({
      ok: true,
      created_count: createdKeys.length,
      updated_count: updatedKeys.length,
      already_correct_count: alreadyCorrectKeys.length,
      message:
        "Business Platform plan features and limits were configured. No customer organization access, pricing schedule assignment, billing, subscriptions, routes, employee roles, CE certifications, or client records changed.",
    });
  } catch (error) {
    console.error(
      "seedBusinessPlatformPlanFeatures error:",
      error?.message || error
    );

    return Response.json(
      {
        ok: false,
        error:
          error?.message ||
          "Unable to seed Business Platform plan features and limits.",
      },
      { status: 500 }
    );
  }
});
