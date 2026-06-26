import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

const NAVIGATION_SCOPE_BY_ACCOUNT_MODEL: Record<string, string> = {
  trainer_business: "ce_training_only",
  business_platform: "full_platform",
  business_ce: "ce_only",
  individual_ce: "ce_only",
};

/**
 * backfillPlatformPlanNavigationScopes
 *
 * Adds the correct navigation_scope to every existing PlatformPlan record
 * based on its account_model.
 *
 * This function does not change:
 * - plan pricing
 * - Stripe IDs
 * - plan features
 * - subscriptions
 * - organization entitlements
 * - user access
 * - routes or navigation
 */
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
            "Only an active Platform Owner can backfill plan navigation scopes.",
        },
        { status: 403 }
      );
    }

    const planRows = await base44.asServiceRole.entities.PlatformPlan.list();

    const plans = Array.isArray(planRows) ? planRows : [];

    const updatedPlanKeys: string[] = [];
    const alreadyCorrectPlanKeys: string[] = [];
    const skippedPlanKeys: string[] = [];

    for (const plan of plans) {
      const expectedNavigationScope =
        NAVIGATION_SCOPE_BY_ACCOUNT_MODEL[plan?.account_model];

      if (!expectedNavigationScope) {
        skippedPlanKeys.push(plan?.plan_key || plan?.id || "unknown");
        continue;
      }

      if (plan.navigation_scope === expectedNavigationScope) {
        alreadyCorrectPlanKeys.push(plan.plan_key);
        continue;
      }

      await base44.asServiceRole.entities.PlatformPlan.update(plan.id, {
        navigation_scope: expectedNavigationScope,
      });

      updatedPlanKeys.push(plan.plan_key);
    }

    const now = new Date().toISOString();

    await base44.asServiceRole.entities.PlatformAuditLog.create({
      platform_admin_user_id: user.id,
      event_key: "platform_plan_navigation_scopes_backfilled",
      event_summary:
        "Navigation scopes were assigned to existing platform plans based on their product account model.",
      actor_type: "platform_admin",
      target_entity: "PlatformPlan",
      tenant_visible: false,
      occurred_at: now,
      details: {
        updated_plan_keys: updatedPlanKeys,
        already_correct_plan_keys: alreadyCorrectPlanKeys,
        skipped_plan_keys: skippedPlanKeys,
      },
    });

    return Response.json({
      ok: true,
      updated_count: updatedPlanKeys.length,
      already_correct_count: alreadyCorrectPlanKeys.length,
      skipped_count: skippedPlanKeys.length,
      message:
        "Plan navigation scopes were updated. No app navigation or user access changed.",
    });
  } catch (error) {
    console.error(
      "backfillPlatformPlanNavigationScopes error:",
      error?.message || error
    );

    return Response.json(
      {
        ok: false,
        error:
          error?.message ||
          "Unable to backfill platform plan navigation scopes.",
      },
      { status: 500 }
    );
  }
});
