import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

const PRICING_SCHEDULE_KEY = "launch_2026";
const PRICING_SCHEDULE_NAME = "Launch Pricing 2026";

/**
 * bootstrapLaunchPricingSchedule
 *
 * Creates the first editable draft pricing schedule.
 *
 * Important:
 * - This does not create pricing items.
 * - This does not set plan prices.
 * - This does not assign any organization to this schedule.
 * - This does not make the schedule default for new accounts.
 * - This does not lock pricing.
 *
 * Future pricing changes must create a new pricing schedule instead of
 * altering a locked schedule assigned to customer organizations.
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
            "Only an active Platform Owner can create a platform pricing schedule.",
        },
        { status: 403 }
      );
    }

    const existingRows =
      await base44.asServiceRole.entities.PlatformPricingSchedule.filter({
        pricing_schedule_key: PRICING_SCHEDULE_KEY,
      });

    const existingSchedules = Array.isArray(existingRows)
      ? existingRows
      : [];

    if (existingSchedules.length > 1) {
      return Response.json(
        {
          ok: false,
          error:
            "More than one pricing schedule already uses the launch_2026 key. No changes were made.",
        },
        { status: 409 }
      );
    }

    if (existingSchedules.length === 1) {
      const existingSchedule = existingSchedules[0];

      return Response.json({
        ok: true,
        created: false,
        message:
          "Launch Pricing 2026 already exists. No changes were made.",
        pricing_schedule: {
          id: existingSchedule.id,
          pricing_schedule_key: existingSchedule.pricing_schedule_key,
          pricing_schedule_name: existingSchedule.pricing_schedule_name,
          schedule_status: existingSchedule.schedule_status,
          is_default_for_new_accounts:
            existingSchedule.is_default_for_new_accounts === true,
        },
      });
    }

    const now = new Date().toISOString();

    const pricingSchedule =
      await base44.asServiceRole.entities.PlatformPricingSchedule.create({
        pricing_schedule_key: PRICING_SCHEDULE_KEY,
        pricing_schedule_name: PRICING_SCHEDULE_NAME,
        description:
          "Initial editable pricing schedule for launch-era plans, registration fees, cohort-overage fees, and future add-ons. Do not assign to customers or lock until all pricing items are configured.",
        schedule_status: "draft",
        is_default_for_new_accounts: false,
        currency: "USD",
        effective_at: now,
        notes:
          "Draft schedule created before public pricing and Stripe setup. Existing organizations must later be assigned intentionally; future pricing revisions will use separate schedules.",
      });

    let auditLogged = true;

    try {
      await base44.asServiceRole.entities.PlatformAuditLog.create({
        platform_admin_user_id: user.id,
        event_key: "launch_pricing_schedule_bootstrapped",
        event_summary:
          "The initial editable Launch Pricing 2026 schedule was created without assigning it to any organization.",
        actor_type: "platform_admin",
        target_entity: "PlatformPricingSchedule",
        target_record_id: pricingSchedule.id,
        tenant_visible: false,
        occurred_at: now,
        details: {
          pricing_schedule_key: PRICING_SCHEDULE_KEY,
          schedule_status: "draft",
          is_default_for_new_accounts: false,
        },
      });
    } catch (auditError) {
      auditLogged = false;
      console.error(
        "bootstrapLaunchPricingSchedule audit error:",
        auditError?.message || auditError
      );
    }

    return Response.json({
      ok: true,
      created: true,
      audit_logged: auditLogged,
      message:
        "Launch Pricing 2026 draft schedule was created. No prices, customers, subscriptions, or billing events changed.",
      pricing_schedule: {
        id: pricingSchedule.id,
        pricing_schedule_key: pricingSchedule.pricing_schedule_key,
        pricing_schedule_name: pricingSchedule.pricing_schedule_name,
        schedule_status: pricingSchedule.schedule_status,
      },
    });
  } catch (error) {
    console.error(
      "bootstrapLaunchPricingSchedule error:",
      error?.message || error
    );

    return Response.json(
      {
        ok: false,
        error:
          error?.message ||
          "Unable to create the Launch Pricing 2026 schedule.",
      },
      { status: 500 }
    );
  }
});
