import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

const TRAINER_BUSINESS_PLAN_KEY = "trainer_business_core_monthly";

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

    const platformAdminRows =
      await base44.asServiceRole.entities.PlatformAdmin.filter({
        user_id: caller.id,
        platform_role: "platform_owner",
        is_active: true,
      });

    const isPlatformOwner = (
      Array.isArray(platformAdminRows) ? platformAdminRows : []
    ).some((row) => row?.is_active !== false);

    if (!isPlatformOwner) {
      return Response.json(
        {
          ok: false,
          error:
            "Only an active Platform Owner can inspect platform plan records.",
        },
        { status: 403 }
      );
    }

    const planRows =
      await base44.asServiceRole.entities.PlatformPlan.filter({
        plan_key: TRAINER_BUSINESS_PLAN_KEY,
      });

    const plans = Array.isArray(planRows) ? planRows : [];

    return Response.json({
      ok: true,
      plan_key: TRAINER_BUSINESS_PLAN_KEY,
      matching_record_count: plans.length,
      active_matching_record_count: plans.filter(
        (plan) => plan?.is_active !== false
      ).length,
      plans: plans.map((plan) => ({
        id: plan.id,
        plan_key: plan.plan_key,
        plan_name: plan.plan_name,
        account_model: plan.account_model,
        billing_interval: plan.billing_interval,
        currency: plan.currency,
        is_active: plan.is_active,
        is_publicly_available: plan.is_publicly_available,
        created_date: plan.created_date || null,
        updated_date: plan.updated_date || null,
      })),
      message:
        "Read-only plan diagnostic complete. No records were changed.",
    });
  } catch (error) {
    console.error(
      "inspectTrainerBusinessPlanRecords error:",
      error?.message || error
    );

    return Response.json(
      {
        ok: false,
        error:
          error?.message ||
          "Unable to inspect Trainer Business plan records.",
      },
      { status: 500 }
    );
  }
});
