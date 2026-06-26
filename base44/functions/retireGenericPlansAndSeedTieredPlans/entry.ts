import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

const LEGACY_PLAN_KEYS = [
  "trainer_business_core_monthly",
  "business_ce_core_monthly",
  "individual_ce_core_monthly",
];

const TIERED_PLANS = [
  {
    plan_key: "trainer_business_starter_monthly",
    plan_name: "Trainer Business — Starter",
    account_model: "trainer_business",
    plan_tier: "starter",
    description:
      "For a small CE training organization operating a limited number of cohorts with trainer oversight and cohort-scoped CE client work.",
    billing_interval: "monthly",
    currency: "USD",
    is_active: true,
    is_publicly_available: false,
    sort_order: 10,
    notes:
      "Unpublished tier template. Pricing, Stripe IDs, included features, and capacity limits must be configured before publication.",
  },
  {
    plan_key: "trainer_business_growth_monthly",
    plan_name: "Trainer Business — Growth",
    account_model: "trainer_business",
    plan_tier: "growth",
    description:
      "For a growing CE training organization operating multiple cohorts, trainers, students, and cohort-scoped CE client work.",
    billing_interval: "monthly",
    currency: "USD",
    is_active: true,
    is_publicly_available: false,
    sort_order: 20,
    notes:
      "Unpublished tier template. Pricing, Stripe IDs, included features, and capacity limits must be configured before publication.",
  },
  {
    plan_key: "trainer_business_enterprise_monthly",
    plan_name: "Trainer Business — Enterprise",
    account_model: "trainer_business",
    plan_tier: "enterprise",
    description:
      "For a large CE training organization requiring customized trainer, student, cohort, feature, and support capacity.",
    billing_interval: "monthly",
    currency: "USD",
    is_active: true,
    is_publicly_available: false,
    sort_order: 30,
    notes:
      "Unpublished tier template. Pricing, Stripe IDs, included features, and capacity limits must be configured before publication.",
  },
  {
    plan_key: "business_ce_starter_monthly",
    plan_name: "Business CE — Starter",
    account_model: "business_ce",
    plan_tier: "starter",
    description:
      "For a business beginning to provide ongoing Customized Employment services through a small practitioner team.",
    billing_interval: "monthly",
    currency: "USD",
    is_active: true,
    is_publicly_available: false,
    sort_order: 40,
    notes:
      "Unpublished tier template. Pricing, Stripe IDs, included features, and capacity limits must be configured before publication.",
  },
  {
    plan_key: "business_ce_growth_monthly",
    plan_name: "Business CE — Growth",
    account_model: "business_ce",
    plan_tier: "growth",
    description:
      "For a growing business with multiple CE practitioners and a larger ongoing CE client caseload.",
    billing_interval: "monthly",
    currency: "USD",
    is_active: true,
    is_publicly_available: false,
    sort_order: 50,
    notes:
      "Unpublished tier template. Pricing, Stripe IDs, included features, and capacity limits must be configured before publication.",
  },
  {
    plan_key: "business_ce_enterprise_monthly",
    plan_name: "Business CE — Enterprise",
    account_model: "business_ce",
    plan_tier: "enterprise",
    description:
      "For a large CE business requiring customized practitioner capacity, client capacity, features, reporting, and support.",
    billing_interval: "monthly",
    currency: "USD",
    is_active: true,
    is_publicly_available: false,
    sort_order: 60,
    notes:
      "Unpublished tier template. Pricing, Stripe IDs, included features, and capacity limits must be configured before publication.",
  },
  {
    plan_key: "individual_ce_starter_monthly",
    plan_name: "Individual CE — Starter",
    account_model: "individual_ce",
    plan_tier: "starter",
    description:
      "For one independent CE practitioner managing an initial ongoing CE client caseload.",
    billing_interval: "monthly",
    currency: "USD",
    is_active: true,
    is_publicly_available: false,
    sort_order: 70,
    notes:
      "Unpublished tier template. Pricing, Stripe IDs, included features, and capacity limits must be configured before publication.",
  },
  {
    plan_key: "individual_ce_pro_monthly",
    plan_name: "Individual CE — Pro",
    account_model: "individual_ce",
    plan_tier: "pro",
    description:
      "For one independent CE practitioner managing a larger CE client caseload with expanded platform capacity.",
    billing_interval: "monthly",
    currency: "USD",
    is_active: true,
    is_publicly_available: false,
    sort_order: 80,
    notes:
      "Unpublished tier template. Pricing, Stripe IDs, included features, and capacity limits must be configured before publication.",
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
            "Only an active Platform Owner can create tiered platform plans.",
        },
        { status: 403 }
      );
    }

    const [planRows, subscriptionRows] = await Promise.all([
      base44.asServiceRole.entities.PlatformPlan.list(),
      base44.asServiceRole.entities.OrganizationPlanSubscription.list(),
    ]);

    const allPlans = Array.isArray(planRows) ? planRows : [];
    const allSubscriptions = Array.isArray(subscriptionRows)
      ? subscriptionRows
      : [];

    const legacyPlans = allPlans.filter((plan) =>
      LEGACY_PLAN_KEYS.includes(plan?.plan_key)
    );

    const legacyPlanIds = new Set(
      legacyPlans.map((plan) => plan.id).filter(Boolean)
    );

    const legacyPlansInUse = allSubscriptions.filter((subscription) =>
      legacyPlanIds.has(subscription?.platform_plan_id)
    );

    if (legacyPlansInUse.length > 0) {
      return Response.json(
        {
          ok: false,
          error:
            "A legacy generic plan is already referenced by a subscription. No plans were retired or created.",
        },
        { status: 409 }
      );
    }

    const tieredPlanKeys = TIERED_PLANS.map((plan) => plan.plan_key);

    const duplicateTieredKeys = tieredPlanKeys.filter(
      (key, index) => tieredPlanKeys.indexOf(key) !== index
    );

    if (duplicateTieredKeys.length > 0) {
      return Response.json(
        {
          ok: false,
          error:
            "Tiered plan configuration contains duplicate plan keys. No changes were made.",
        },
        { status: 500 }
      );
    }

    const existingTieredPlanCounts = new Map();

    for (const plan of allPlans) {
      if (!tieredPlanKeys.includes(plan?.plan_key)) {
        continue;
      }

      const currentCount =
        existingTieredPlanCounts.get(plan.plan_key) || 0;

      existingTieredPlanCounts.set(plan.plan_key, currentCount + 1);
    }

    const duplicateExistingTieredKeys = Array.from(
      existingTieredPlanCounts.entries()
    )
      .filter(([, count]) => count > 1)
      .map(([planKey]) => planKey);

    if (duplicateExistingTieredKeys.length > 0) {
      return Response.json(
        {
          ok: false,
          error:
            "More than one PlatformPlan record already uses a tiered plan key. No changes were made.",
        },
        { status: 409 }
      );
    }

    const retiredPlanKeys: string[] = [];
    const retiredMappingCountByPlan: Record<string, number> = {};

    for (const legacyPlan of legacyPlans) {
      const retirementNote =
        "Retired generic placeholder plan. Replaced by tiered plan templates.";

      const currentNotes = String(legacyPlan.notes || "");

      if (
        legacyPlan.is_active !== false ||
        legacyPlan.is_publicly_available !== false ||
        !currentNotes.includes(retirementNote)
      ) {
        await base44.asServiceRole.entities.PlatformPlan.update(
          legacyPlan.id,
          {
            is_active: false,
            is_publicly_available: false,
            notes: currentNotes.includes(retirementNote)
              ? currentNotes
              : currentNotes
                ? `${currentNotes}\n${retirementNote}`
                : retirementNote,
          }
        );
      }

      retiredPlanKeys.push(legacyPlan.plan_key);

      const mappingRows =
        await base44.asServiceRole.entities.PlatformPlanFeature.filter({
          platform_plan_id: legacyPlan.id,
        });

      const activeMappings = (Array.isArray(mappingRows)
        ? mappingRows
        : []
      ).filter((mapping) => mapping?.is_active !== false);

      for (const mapping of activeMappings) {
        await base44.asServiceRole.entities.PlatformPlanFeature.update(
          mapping.id,
          { is_active: false }
        );
      }

      retiredMappingCountByPlan[legacyPlan.plan_key] =
        activeMappings.length;
    }

    const existingPlanKeys = new Set(
      allPlans.map((plan) => plan?.plan_key).filter(Boolean)
    );

    const createdPlanKeys: string[] = [];
    const existingPlanKeysReturned: string[] = [];

    for (const plan of TIERED_PLANS) {
      if (existingPlanKeys.has(plan.plan_key)) {
        existingPlanKeysReturned.push(plan.plan_key);
        continue;
      }

      await base44.asServiceRole.entities.PlatformPlan.create(plan);
      createdPlanKeys.push(plan.plan_key);
    }

    const now = new Date().toISOString();
    let auditLogged = true;

    try {
      await base44.asServiceRole.entities.PlatformAuditLog.create({
        platform_admin_user_id: user.id,
        event_key: "tiered_platform_plans_seeded",
        event_summary:
          "Unused generic plan templates were retired and the initial unpublished tiered platform plan catalog was created.",
        actor_type: "platform_admin",
        target_entity: "PlatformPlan",
        tenant_visible: false,
        occurred_at: now,
        details: {
          retired_plan_keys: retiredPlanKeys,
          retired_mapping_count_by_plan: retiredMappingCountByPlan,
          created_plan_keys: createdPlanKeys,
          existing_plan_keys: existingPlanKeysReturned,
        },
      });
    } catch (auditError) {
      auditLogged = false;
      console.error(
        "retireGenericPlansAndSeedTieredPlans audit error:",
        auditError?.message || auditError
      );
    }

    return Response.json({
      ok: true,
      audit_logged: auditLogged,
      retired_plan_keys: retiredPlanKeys,
      created_plan_count: createdPlanKeys.length,
      existing_plan_count: existingPlanKeysReturned.length,
      message:
        "Generic placeholder plans were safely retired and tiered plan templates were created. No organization access, pricing, billing, or subscriptions changed.",
    });
  } catch (error) {
    console.error(
      "retireGenericPlansAndSeedTieredPlans error:",
      error?.message || error
    );

    return Response.json(
      {
        ok: false,
        error:
          error?.message ||
          "Unable to retire generic plans and seed tiered plans.",
      },
      { status: 500 }
    );
  }
});
