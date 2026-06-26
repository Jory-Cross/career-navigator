import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

const ALLOWED_PLATFORM_ROLES = new Set([
  "platform_owner",
  "platform_billing",
]);

/**
 * getPlatformPricingManagerData
 *
 * Read-only source for the future internal Platform Pricing Manager.
 *
 * Important:
 * - Reads pricing schedules and their exact schedule items.
 * - Does not modify pricing, plans, customers, subscriptions, or billing.
 * - Existing organizations remain pinned to their assigned pricing schedule.
 * - PlatformPlan.price_cents and PlatformBillingRate.amount_cents are
 *   catalog/template values only; schedule items become the locked source
 *   for organization-specific billing once subscriptions are provisioned.
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

    const platformAdminRows =
      await base44.asServiceRole.entities.PlatformAdmin.filter({
        user_id: user.id,
        is_active: true,
      });

    const platformRoles = Array.from(
      new Set(
        (Array.isArray(platformAdminRows) ? platformAdminRows : [])
          .filter((row) => row?.is_active !== false)
          .map((row) => row?.platform_role)
          .filter(Boolean)
      )
    );

    const canViewPricing = platformRoles.some((role) =>
      ALLOWED_PLATFORM_ROLES.has(role)
    );

    if (!canViewPricing) {
      return Response.json(
        {
          ok: false,
          error:
            "Only Platform Owners and Platform Billing users may view pricing administration.",
        },
        { status: 403 }
      );
    }

    const [
      scheduleRows,
      scheduleItemRows,
      planRows,
      featureRows,
      billingRateRows,
      assignmentRows,
    ] = await Promise.all([
      base44.asServiceRole.entities.PlatformPricingSchedule.list(),
      base44.asServiceRole.entities.PlatformPricingScheduleItem.list(),
      base44.asServiceRole.entities.PlatformPlan.list(),
      base44.asServiceRole.entities.PlatformFeature.list(),
      base44.asServiceRole.entities.PlatformBillingRate.list(),
      base44.asServiceRole.entities.OrganizationPricingScheduleAssignment.list(),
    ]);

    const schedules = Array.isArray(scheduleRows) ? scheduleRows : [];
    const scheduleItems = Array.isArray(scheduleItemRows)
      ? scheduleItemRows
      : [];
    const plans = Array.isArray(planRows) ? planRows : [];
    const features = Array.isArray(featureRows) ? featureRows : [];
    const billingRates = Array.isArray(billingRateRows)
      ? billingRateRows
      : [];
    const assignments = Array.isArray(assignmentRows)
      ? assignmentRows
      : [];

    const activeAssignmentCountByScheduleId = new Map<string, number>();

    for (const assignment of assignments) {
      if (
        assignment?.assignment_status !== "active" ||
        !assignment?.pricing_schedule_id
      ) {
        continue;
      }

      activeAssignmentCountByScheduleId.set(
        assignment.pricing_schedule_id,
        (activeAssignmentCountByScheduleId.get(
          assignment.pricing_schedule_id
        ) || 0) + 1
      );
    }

    const scheduleItemCountByScheduleId = new Map<string, number>();

    for (const item of scheduleItems) {
      if (!item?.pricing_schedule_id) {
        continue;
      }

      scheduleItemCountByScheduleId.set(
        item.pricing_schedule_id,
        (scheduleItemCountByScheduleId.get(item.pricing_schedule_id) || 0) +
          1
      );
    }

    const normalizedSchedules = schedules
      .map((schedule) => ({
        id: schedule.id,
        pricing_schedule_key: schedule.pricing_schedule_key,
        pricing_schedule_name: schedule.pricing_schedule_name,
        description: schedule.description || "",
        schedule_status: schedule.schedule_status,
        is_default_for_new_accounts:
          schedule.is_default_for_new_accounts === true,
        currency: schedule.currency || "USD",
        effective_at: schedule.effective_at || null,
        retired_at: schedule.retired_at || null,
        locked_at: schedule.locked_at || null,
        supersedes_pricing_schedule_id:
          schedule.supersedes_pricing_schedule_id || null,
        notes: schedule.notes || "",
        pricing_item_count:
          scheduleItemCountByScheduleId.get(schedule.id) || 0,
        active_organization_count:
          activeAssignmentCountByScheduleId.get(schedule.id) || 0,
      }))
      .sort((a, b) => {
        const bTime = new Date(b.effective_at || 0).getTime();
        const aTime = new Date(a.effective_at || 0).getTime();
        return bTime - aTime;
      });

    const normalizedScheduleItems = scheduleItems
      .map((item) => ({
        id: item.id,
        pricing_schedule_id: item.pricing_schedule_id,
        pricing_item_key: item.pricing_item_key,
        pricing_item_type: item.pricing_item_type,
        platform_plan_id: item.platform_plan_id || null,
        plan_key_snapshot: item.plan_key_snapshot || null,
        platform_billing_rate_id: item.platform_billing_rate_id || null,
        billing_rate_key_snapshot:
          item.billing_rate_key_snapshot || null,
        feature_key: item.feature_key || null,
        charge_model: item.charge_model,
        amount_cents: item.amount_cents,
        currency: item.currency || "USD",
        is_active: item.is_active !== false,
        effective_at: item.effective_at || null,
        ends_at: item.ends_at || null,
        notes: item.notes || "",
      }))
      .sort((a, b) =>
        String(a.pricing_item_key).localeCompare(
          String(b.pricing_item_key)
        )
      );

    const normalizedPlans = plans
      .map((plan) => ({
        id: plan.id,
        plan_key: plan.plan_key,
        plan_name: plan.plan_name,
        account_model: plan.account_model,
        plan_tier: plan.plan_tier || null,
        navigation_scope: plan.navigation_scope || null,
        billing_interval: plan.billing_interval,
        currency: plan.currency || "USD",
        is_active: plan.is_active !== false,
        is_publicly_available:
          plan.is_publicly_available === true,
      }))
      .sort((a, b) => String(a.plan_name).localeCompare(String(b.plan_name)));

    const normalizedFeatures = features
      .map((feature) => ({
        id: feature.id,
        feature_key: feature.feature_key,
        feature_name: feature.feature_name,
        feature_category: feature.feature_category,
        supports_limit: feature.supports_limit === true,
        limit_label: feature.limit_label || "",
        is_billable_add_on: feature.is_billable_add_on === true,
        is_active: feature.is_active !== false,
      }))
      .sort((a, b) =>
        String(a.feature_name).localeCompare(String(b.feature_name))
      );

    const normalizedBillingRates = billingRates
      .map((rate) => ({
        id: rate.id,
        rate_key: rate.rate_key,
        rate_name: rate.rate_name,
        charge_model: rate.charge_model,
        billing_subject_type: rate.billing_subject_type,
        feature_key: rate.feature_key || null,
        catalog_amount_cents: rate.amount_cents,
        currency: rate.currency || "USD",
        is_active: rate.is_active !== false,
      }))
      .sort((a, b) =>
        String(a.rate_name).localeCompare(String(b.rate_name))
      );

    return Response.json({
      ok: true,
      viewer: {
        user_id: user.id,
        platform_roles: platformRoles,
        can_view_pricing: true,
      },
      schedules: normalizedSchedules,
      pricing_schedule_items: normalizedScheduleItems,
      plans: normalizedPlans,
      features: normalizedFeatures,
      billing_rate_templates: normalizedBillingRates,
    });
  } catch (error) {
    console.error(
      "getPlatformPricingManagerData error:",
      error?.message || error
    );

    return Response.json(
      {
        ok: false,
        error:
          error?.message ||
          "Unable to load platform pricing administration data.",
      },
      { status: 500 }
    );
  }
});
