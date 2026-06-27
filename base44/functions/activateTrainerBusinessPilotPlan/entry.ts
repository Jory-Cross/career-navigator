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
            "Only an active Platform Owner can activate the Trainer Business pilot plan.",
        },
        { status: 403 }
      );
    }

    const planRows =
      await base44.asServiceRole.entities.PlatformPlan.filter({
        plan_key: TRAINER_BUSINESS_PLAN_KEY,
      });

    const plans = Array.isArray(planRows) ? planRows : [];

    if (plans.length !== 1) {
      return Response.json(
        {
          ok: false,
          error:
            "Trainer Business Account plan could not be resolved to exactly one record.",
        },
        { status: 409 }
      );
    }

    const plan = plans[0];

    if (plan.is_active !== false) {
      return Response.json({
        ok: true,
        changed: false,
        plan_id: plan.id,
        plan_key: plan.plan_key,
        is_active: true,
        is_publicly_available: plan.is_publicly_available === true,
        message:
          "Trainer Business Account plan is already active. No changes were made.",
      });
    }

    await base44.asServiceRole.entities.PlatformPlan.update(plan.id, {
      is_active: true,
      is_publicly_available: false,
    });

    const now = new Date().toISOString();

    try {
      await base44.asServiceRole.entities.PlatformAuditLog.create({
        platform_admin_user_id: caller.id,
        event_key: "trainer_business_pilot_plan_activated",
        event_summary:
          "The Trainer Business Account plan was activated for internal pilot provisioning and remains unavailable for public purchase.",
        actor_type: "platform_admin",
        target_entity: "PlatformPlan",
        target_record_id: plan.id,
        tenant_visible: false,
        occurred_at: now,
        details: {
          plan_key: plan.plan_key,
          plan_name: plan.plan_name,
          is_publicly_available: false,
        },
      });
    } catch (auditError) {
      console.error(
        "Trainer Business pilot plan audit logging failed:",
        auditError?.message || auditError
      );
    }

    return Response.json({
      ok: true,
      changed: true,
      plan_id: plan.id,
      plan_key: plan.plan_key,
      is_active: true,
      is_publicly_available: false,
      message:
        "Trainer Business Account plan is active for internal pilot provisioning. It remains unavailable for public purchase.",
    });
  } catch (error) {
    console.error(
      "activateTrainerBusinessPilotPlan error:",
      error?.message || error
    );

    return Response.json(
      {
        ok: false,
        error:
          error?.message ||
          "Unable to activate the Trainer Business pilot plan.",
      },
      { status: 500 }
    );
  }
});
