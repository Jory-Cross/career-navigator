import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

const INITIAL_PLANS = [
  {
    plan_key: "trainer_business_core_monthly",
    plan_name: "Trainer Business Account",
    account_model: "trainer_business",
    description:
      "Base plan for organizations that operate CE Training Portal cohorts, enroll students, assign trainers, and oversee cohort-scoped CE client work.",
    billing_interval: "monthly",
    currency: "USD",
    is_active: true,
    is_publicly_available: false,
    sort_order: 10,
    notes:
      "Internal plan template. Set price_cents and Stripe IDs before making this plan publicly available.",
  },
  {
    plan_key: "business_ce_core_monthly",
    plan_name: "Business CE Account",
    account_model: "business_ce",
    description:
      "Base plan for businesses employing CE practitioners who manage ongoing CE client work. CE Training Portal may later be added as a paid add-on.",
    billing_interval: "monthly",
    currency: "USD",
    is_active: true,
    is_publicly_available: false,
    sort_order: 20,
    notes:
      "Internal plan template. Set price_cents and Stripe IDs before making this plan publicly available.",
  },
  {
    plan_key: "individual_ce_core_monthly",
    plan_name: "Individual CE Account",
    account_model: "individual_ce",
    description:
      "Base plan for an independent CE practitioner managing ongoing CE client work after training or as an individual business.",
    billing_interval: "monthly",
    currency: "USD",
    is_active: true,
    is_publicly_available: false,
    sort_order: 30,
    notes:
      "Internal plan template. Set price_cents and Stripe IDs before making this plan publicly available.",
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
            "Only an active Platform Owner can seed initial platform plans.",
        },
        { status: 403 }
      );
    }

    const existingRows =
      await base44.asServiceRole.entities.PlatformPlan.list();

    const existingByKey = new Map(
      (Array.isArray(existingRows) ? existingRows : [])
        .filter((row) => row?.plan_key)
        .map((row) => [row.plan_key, row])
    );

    const createdKeys: string[] = [];
    const existingKeys: string[] = [];

    for (const plan of INITIAL_PLANS) {
      if (existingByKey.has(plan.plan_key)) {
        existingKeys.push(plan.plan_key);
        continue;
      }

      await base44.asServiceRole.entities.PlatformPlan.create(plan);
      createdKeys.push(plan.plan_key);
    }

    const now = new Date().toISOString();

    await base44.asServiceRole.entities.PlatformAuditLog.create({
      platform_admin_user_id: user.id,
      event_key: "initial_platform_plans_seeded",
      event_summary:
        "Initial unpublished Trainer Business, Business CE, and Individual CE plan templates were created.",
      actor_type: "platform_admin",
      target_entity: "PlatformPlan",
      tenant_visible: false,
      occurred_at: now,
      details: {
        created_count: createdKeys.length,
        existing_count: existingKeys.length,
        plan_keys: INITIAL_PLANS.map((plan) => plan.plan_key),
      },
    });

    return Response.json({
      ok: true,
      created_count: createdKeys.length,
      existing_count: existingKeys.length,
      message:
        "Initial unpublished platform plans were created. No billing, subscriptions, or feature access changed.",
    });
  } catch (error) {
    console.error(
      "seedInitialPlatformPlans error:",
      error?.message || error
    );

    return Response.json(
      {
        ok: false,
        error:
          error?.message ||
          "Unable to seed initial platform plans.",
      },
      { status: 500 }
    );
  }
});
