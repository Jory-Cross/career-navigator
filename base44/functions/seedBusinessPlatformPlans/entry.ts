import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

const BUSINESS_PLATFORM_PLANS = [
  {
    plan_key: "business_platform_starter_monthly",
    plan_name: "Business Platform — Starter",
    account_model: "business_platform",
    plan_tier: "starter",
    description:
      "For a small organization using Career Navigator core business features. CE Practitioner and CE Training modules may be purchased later as add-ons.",
    billing_interval: "monthly",
    currency: "USD",
    is_active: true,
    is_publicly_available: false,
    sort_order: 90,
    notes:
      "Unpublished general-business plan template. Configure pricing, Stripe IDs, included features, limits, and add-ons before publication.",
  },
  {
    plan_key: "business_platform_growth_monthly",
    plan_name: "Business Platform — Growth",
    account_model: "business_platform",
    plan_tier: "growth",
    description:
      "For a growing organization using broader Career Navigator operational features. CE Practitioner and CE Training modules may be purchased later as add-ons.",
    billing_interval: "monthly",
    currency: "USD",
    is_active: true,
    is_publicly_available: false,
    sort_order: 100,
    notes:
      "Unpublished general-business plan template. Configure pricing, Stripe IDs, included features, limits, and add-ons before publication.",
  },
  {
    plan_key: "business_platform_enterprise_monthly",
    plan_name: "Business Platform — Enterprise",
    account_model: "business_platform",
    plan_tier: "enterprise",
    description:
      "For a larger organization requiring expanded capacity, advanced platform modules, custom configuration, and future CE add-on options.",
    billing_interval: "monthly",
    currency: "USD",
    is_active: true,
    is_publicly_available: false,
    sort_order: 110,
    notes:
      "Unpublished general-business plan template. Configure pricing, Stripe IDs, included features, limits, and add-ons before publication.",
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
            "Only an active Platform Owner can seed Business Platform plans.",
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

    const createdPlanKeys: string[] = [];
    const existingPlanKeys: string[] = [];

    for (const plan of BUSINESS_PLATFORM_PLANS) {
      if (existingByKey.has(plan.plan_key)) {
        existingPlanKeys.push(plan.plan_key);
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
        event_key: "business_platform_plans_seeded",
        event_summary:
          "The initial unpublished Business Platform Starter, Growth, and Enterprise plan templates were created.",
        actor_type: "platform_admin",
        target_entity: "PlatformPlan",
        tenant_visible: false,
        occurred_at: now,
        details: {
          created_plan_keys: createdPlanKeys,
          existing_plan_keys: existingPlanKeys,
        },
      });
    } catch (auditError) {
      auditLogged = false;
      console.error(
        "seedBusinessPlatformPlans audit error:",
        auditError?.message || auditError
      );
    }

    return Response.json({
      ok: true,
      created_count: createdPlanKeys.length,
      existing_count: existingPlanKeys.length,
      audit_logged: auditLogged,
      message:
        "Business Platform plan templates were created. No feature access, CE access, billing, or subscriptions changed.",
    });
  } catch (error) {
    console.error(
      "seedBusinessPlatformPlans error:",
      error?.message || error
    );

    return Response.json(
      {
        ok: false,
        error:
          error?.message ||
          "Unable to seed Business Platform plan templates.",
      },
      { status: 500 }
    );
  }
});
