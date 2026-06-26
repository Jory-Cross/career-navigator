import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

const PLAN_FEATURE_MAPPINGS = [
  // ── Trainer Business Account ─────────────────────────────────────────────
  {
    plan_key: "trainer_business_core_monthly",
    feature_key: "core_platform",
    is_included: true,
    is_add_on_available: false,
    sort_order: 10,
  },
  {
    plan_key: "trainer_business_core_monthly",
    feature_key: "custom_roles",
    is_included: true,
    is_add_on_available: false,
    sort_order: 20,
  },
  {
    plan_key: "trainer_business_core_monthly",
    feature_key: "client_management",
    is_included: true,
    is_add_on_available: false,
    sort_order: 30,
  },
  {
    plan_key: "trainer_business_core_monthly",
    feature_key: "ce_training_portal",
    is_included: true,
    is_add_on_available: false,
    sort_order: 40,
  },
  {
    plan_key: "trainer_business_core_monthly",
    feature_key: "ce_cohorts",
    is_included: true,
    is_add_on_available: false,
    sort_order: 50,
  },
  {
    plan_key: "trainer_business_core_monthly",
    feature_key: "ce_training_client_workspace",
    is_included: true,
    is_add_on_available: false,
    sort_order: 60,
  },
  {
    plan_key: "trainer_business_core_monthly",
    feature_key: "assessments",
    is_included: true,
    is_add_on_available: false,
    sort_order: 70,
  },
  {
    plan_key: "trainer_business_core_monthly",
    feature_key: "documents",
    is_included: true,
    is_add_on_available: false,
    sort_order: 80,
  },
  {
    plan_key: "trainer_business_core_monthly",
    feature_key: "employee_seats",
    is_included: false,
    is_add_on_available: true,
    sort_order: 100,
  },
  {
    plan_key: "trainer_business_core_monthly",
    feature_key: "client_records",
    is_included: false,
    is_add_on_available: true,
    sort_order: 110,
  },
  {
    plan_key: "trainer_business_core_monthly",
    feature_key: "ce_trainer_seats",
    is_included: false,
    is_add_on_available: true,
    sort_order: 120,
  },
  {
    plan_key: "trainer_business_core_monthly",
    feature_key: "ce_student_seats",
    is_included: false,
    is_add_on_available: true,
    sort_order: 130,
  },
  {
    plan_key: "trainer_business_core_monthly",
    feature_key: "ai_tools",
    is_included: false,
    is_add_on_available: true,
    sort_order: 140,
  },
  {
    plan_key: "trainer_business_core_monthly",
    feature_key: "advanced_reporting",
    is_included: false,
    is_add_on_available: true,
    sort_order: 150,
  },

  // ── Business CE Account ──────────────────────────────────────────────────
  {
    plan_key: "business_ce_core_monthly",
    feature_key: "core_platform",
    is_included: true,
    is_add_on_available: false,
    sort_order: 10,
  },
  {
    plan_key: "business_ce_core_monthly",
    feature_key: "custom_roles",
    is_included: true,
    is_add_on_available: false,
    sort_order: 20,
  },
  {
    plan_key: "business_ce_core_monthly",
    feature_key: "client_management",
    is_included: true,
    is_add_on_available: false,
    sort_order: 30,
  },
  {
    plan_key: "business_ce_core_monthly",
    feature_key: "ce_practitioner_workspace",
    is_included: true,
    is_add_on_available: false,
    sort_order: 40,
  },
  {
    plan_key: "business_ce_core_monthly",
    feature_key: "assessments",
    is_included: true,
    is_add_on_available: false,
    sort_order: 50,
  },
  {
    plan_key: "business_ce_core_monthly",
    feature_key: "documents",
    is_included: true,
    is_add_on_available: false,
    sort_order: 60,
  },
  {
    plan_key: "business_ce_core_monthly",
    feature_key: "employee_seats",
    is_included: false,
    is_add_on_available: true,
    sort_order: 100,
  },
  {
    plan_key: "business_ce_core_monthly",
    feature_key: "client_records",
    is_included: false,
    is_add_on_available: true,
    sort_order: 110,
  },
  {
    plan_key: "business_ce_core_monthly",
    feature_key: "ce_practitioner_seats",
    is_included: false,
    is_add_on_available: true,
    sort_order: 120,
  },
  {
    plan_key: "business_ce_core_monthly",
    feature_key: "ce_training_portal",
    is_included: false,
    is_add_on_available: true,
    sort_order: 130,
  },
  {
    plan_key: "business_ce_core_monthly",
    feature_key: "ce_cohorts",
    is_included: false,
    is_add_on_available: true,
    sort_order: 140,
  },
  {
    plan_key: "business_ce_core_monthly",
    feature_key: "ce_training_client_workspace",
    is_included: false,
    is_add_on_available: true,
    sort_order: 150,
  },
  {
    plan_key: "business_ce_core_monthly",
    feature_key: "ce_trainer_seats",
    is_included: false,
    is_add_on_available: true,
    sort_order: 160,
  },
  {
    plan_key: "business_ce_core_monthly",
    feature_key: "ce_student_seats",
    is_included: false,
    is_add_on_available: true,
    sort_order: 170,
  },
  {
    plan_key: "business_ce_core_monthly",
    feature_key: "time_tracking",
    is_included: false,
    is_add_on_available: true,
    sort_order: 180,
  },
  {
    plan_key: "business_ce_core_monthly",
    feature_key: "client_portal",
    is_included: false,
    is_add_on_available: true,
    sort_order: 190,
  },
  {
    plan_key: "business_ce_core_monthly",
    feature_key: "ai_tools",
    is_included: false,
    is_add_on_available: true,
    sort_order: 200,
  },
  {
    plan_key: "business_ce_core_monthly",
    feature_key: "advanced_reporting",
    is_included: false,
    is_add_on_available: true,
    sort_order: 210,
  },

  // ── Individual CE Account ────────────────────────────────────────────────
  {
    plan_key: "individual_ce_core_monthly",
    feature_key: "core_platform",
    is_included: true,
    is_add_on_available: false,
    sort_order: 10,
  },
  {
    plan_key: "individual_ce_core_monthly",
    feature_key: "client_management",
    is_included: true,
    is_add_on_available: false,
    sort_order: 20,
  },
  {
    plan_key: "individual_ce_core_monthly",
    feature_key: "ce_practitioner_workspace",
    is_included: true,
    is_add_on_available: false,
    sort_order: 30,
  },
  {
    plan_key: "individual_ce_core_monthly",
    feature_key: "assessments",
    is_included: true,
    is_add_on_available: false,
    sort_order: 40,
  },
  {
    plan_key: "individual_ce_core_monthly",
    feature_key: "documents",
    is_included: true,
    is_add_on_available: false,
    sort_order: 50,
  },
  {
    plan_key: "individual_ce_core_monthly",
    feature_key: "client_records",
    is_included: false,
    is_add_on_available: true,
    sort_order: 100,
  },
  {
    plan_key: "individual_ce_core_monthly",
    feature_key: "ai_tools",
    is_included: false,
    is_add_on_available: true,
    sort_order: 110,
  },
  {
    plan_key: "individual_ce_core_monthly",
    feature_key: "advanced_reporting",
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
            "Only an active Platform Owner can seed plan feature mappings.",
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

    const existingByMappingKey = new Set(
      (Array.isArray(existingMappings) ? existingMappings : [])
        .map((row) => row?.plan_feature_key)
        .filter(Boolean)
    );

    const missingPlanKeys = Array.from(
      new Set(
        PLAN_FEATURE_MAPPINGS.map((mapping) => mapping.plan_key)
          .filter((planKey) => !planByKey.has(planKey))
      )
    );

    const missingFeatureKeys = Array.from(
      new Set(
        PLAN_FEATURE_MAPPINGS.map((mapping) => mapping.feature_key)
          .filter((featureKey) => !featureByKey.has(featureKey))
      )
    );

    if (missingPlanKeys.length > 0 || missingFeatureKeys.length > 0) {
      return Response.json(
        {
          ok: false,
          error:
            "Required plan or feature catalog records are missing. No plan-feature mappings were created.",
          missing_plan_keys: missingPlanKeys,
          missing_feature_keys: missingFeatureKeys,
        },
        { status: 409 }
      );
    }

    const createdKeys: string[] = [];
    const existingKeys: string[] = [];

    for (const mapping of PLAN_FEATURE_MAPPINGS) {
      const plan = planByKey.get(mapping.plan_key);
      const feature = featureByKey.get(mapping.feature_key);

      if (!plan || !feature) {
        continue;
      }

      const planFeatureKey = `${mapping.plan_key}:${mapping.feature_key}`;

      if (existingByMappingKey.has(planFeatureKey)) {
        existingKeys.push(planFeatureKey);
        continue;
      }

      await base44.asServiceRole.entities.PlatformPlanFeature.create({
        platform_plan_id: plan.id,
        platform_feature_id: feature.id,
        plan_feature_key: planFeatureKey,
        feature_key: mapping.feature_key,
        is_included: mapping.is_included,
        is_add_on_available: mapping.is_add_on_available,
        is_active: true,
        sort_order: mapping.sort_order,
      });

      createdKeys.push(planFeatureKey);
    }

    const now = new Date().toISOString();

    await base44.asServiceRole.entities.PlatformAuditLog.create({
      platform_admin_user_id: user.id,
      event_key: "initial_platform_plan_features_seeded",
      event_summary:
        "Initial plan-to-feature mappings were created for unpublished Trainer Business, Business CE, and Individual CE plan templates.",
      actor_type: "platform_admin",
      target_entity: "PlatformPlanFeature",
      tenant_visible: false,
      occurred_at: now,
      details: {
        created_count: createdKeys.length,
        existing_count: existingKeys.length,
        mapping_count: PLAN_FEATURE_MAPPINGS.length,
      },
    });

    return Response.json({
      ok: true,
      created_count: createdKeys.length,
      existing_count: existingKeys.length,
      mapping_count: PLAN_FEATURE_MAPPINGS.length,
      message:
        "Initial plan feature mappings were created. No organization access or billing changed.",
    });
  } catch (error) {
    console.error(
      "seedInitialPlatformPlanFeatures error:",
      error?.message || error
    );

    return Response.json(
      {
        ok: false,
        error:
          error?.message ||
          "Unable to seed initial plan feature mappings.",
      },
      { status: 500 }
    );
  }
});
