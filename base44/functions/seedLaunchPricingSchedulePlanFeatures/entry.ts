import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

const PRICING_SCHEDULE_KEY = "launch_2026";

/**
 * seedLaunchPricingSchedulePlanFeatures
 *
 * Copies the currently active PlatformPlanFeature template mappings into the
 * Launch Pricing 2026 draft schedule as schedule-specific feature snapshots.
 *
 * This protects legacy customers from future changes to global plan templates:
 * - global PlatformPlanFeature = current product template
 * - PlatformPricingSchedulePlanFeature = locked pricing-version feature bundle
 *
 * Safety:
 * - Requires active Platform Owner or Platform Billing role.
 * - Requires Launch Pricing 2026 to still be an unlocked draft.
 * - Creates missing snapshot rows only.
 * - Never overwrites an existing schedule-specific snapshot.
 * - Does not assign pricing to any organization.
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

    const canManagePricing = platformRoles.some((role) =>
      ["platform_owner", "platform_billing"].includes(role)
    );

    if (!canManagePricing) {
      return Response.json(
        {
          ok: false,
          error:
            "Only Platform Owners and Platform Billing users may seed pricing schedule feature snapshots.",
        },
        { status: 403 }
      );
    }

    const scheduleRows =
      await base44.asServiceRole.entities.PlatformPricingSchedule.filter({
        pricing_schedule_key: PRICING_SCHEDULE_KEY,
      });

    const schedules = Array.isArray(scheduleRows) ? scheduleRows : [];

    if (schedules.length !== 1) {
      return Response.json(
        {
          ok: false,
          error:
            "Launch Pricing 2026 could not be resolved to exactly one pricing schedule.",
        },
        { status: 409 }
      );
    }

    const pricingSchedule = schedules[0];

    if (
      pricingSchedule.schedule_status !== "draft" ||
      pricingSchedule.locked_at
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "Launch Pricing 2026 must be an unlocked draft before feature snapshots can be seeded.",
        },
        { status: 409 }
      );
    }

    const [
      planRows,
      featureRows,
      templateMappingRows,
      existingSnapshotRows,
    ] = await Promise.all([
      base44.asServiceRole.entities.PlatformPlan.list(),
      base44.asServiceRole.entities.PlatformFeature.list(),
      base44.asServiceRole.entities.PlatformPlanFeature.list(),
      base44.asServiceRole.entities.PlatformPricingSchedulePlanFeature.filter(
        {
          pricing_schedule_id: pricingSchedule.id,
        }
      ),
    ]);

    const activePlansById = new Map(
      (Array.isArray(planRows) ? planRows : [])
        .filter((plan) => plan?.id && plan?.is_active !== false)
        .map((plan) => [plan.id, plan])
    );

    const activeFeaturesById = new Map(
      (Array.isArray(featureRows) ? featureRows : [])
        .filter((feature) => feature?.id && feature?.is_active !== false)
        .map((feature) => [feature.id, feature])
    );

    const existingSnapshots = Array.isArray(existingSnapshotRows)
      ? existingSnapshotRows
      : [];

    const existingByKey = new Map<string, any>();
    const duplicateSnapshotKeys: string[] = [];

    for (const snapshot of existingSnapshots) {
      const key = snapshot?.pricing_schedule_plan_feature_key;

      if (!key) {
        continue;
      }

      if (existingByKey.has(key)) {
        duplicateSnapshotKeys.push(key);
        continue;
      }

      existingByKey.set(key, snapshot);
    }

    if (duplicateSnapshotKeys.length > 0) {
      return Response.json(
        {
          ok: false,
          error:
            "Duplicate pricing-schedule plan-feature snapshots already exist. No new snapshots were created.",
          duplicate_snapshot_keys: Array.from(
            new Set(duplicateSnapshotKeys)
          ),
        },
        { status: 409 }
      );
    }

    const activeTemplateMappings = (
      Array.isArray(templateMappingRows) ? templateMappingRows : []
    ).filter((mapping) => {
      if (mapping?.is_active === false) {
        return false;
      }

      return (
        activePlansById.has(mapping?.platform_plan_id) &&
        activeFeaturesById.has(mapping?.platform_feature_id)
      );
    });

    const now = new Date().toISOString();
    const createdSnapshotKeys: string[] = [];
    const existingSnapshotKeys: string[] = [];
    const skippedTemplateMappingIds: string[] = [];

    for (const mapping of activeTemplateMappings) {
      const plan = activePlansById.get(mapping.platform_plan_id);
      const feature = activeFeaturesById.get(mapping.platform_feature_id);

      if (!plan || !feature) {
        skippedTemplateMappingIds.push(mapping.id);
        continue;
      }

      const snapshotKey =
        `${pricingSchedule.pricing_schedule_key}:` +
        `${plan.plan_key}:` +
        `${feature.feature_key}`;

      if (existingByKey.has(snapshotKey)) {
        existingSnapshotKeys.push(snapshotKey);
        continue;
      }

      await base44.asServiceRole.entities.PlatformPricingSchedulePlanFeature.create(
        {
          pricing_schedule_id: pricingSchedule.id,
          platform_plan_id: plan.id,
          platform_feature_id: feature.id,
          platform_plan_feature_id: mapping.id,
          pricing_schedule_plan_feature_key: snapshotKey,
          plan_key_snapshot: plan.plan_key,
          feature_key: feature.feature_key,
          feature_name_snapshot: feature.feature_name,
          is_included: mapping.is_included === true,
          is_add_on_available: mapping.is_add_on_available === true,
          default_limit_value: mapping.default_limit_value,
          is_active: true,
          effective_at: now,
          notes:
            "Launch Pricing 2026 feature and capacity snapshot created from the active PlatformPlanFeature template.",
        }
      );

      createdSnapshotKeys.push(snapshotKey);
    }

    await base44.asServiceRole.entities.PlatformAuditLog.create({
      platform_admin_user_id: user.id,
      event_key: "launch_pricing_schedule_plan_features_seeded",
      event_summary:
        "Active plan feature and capacity templates were copied into Launch Pricing 2026 as schedule-specific snapshots.",
      actor_type: "platform_admin",
      target_entity: "PlatformPricingSchedulePlanFeature",
      target_record_id: null,
      tenant_visible: false,
      occurred_at: now,
      details: {
        pricing_schedule_id: pricingSchedule.id,
        pricing_schedule_key: pricingSchedule.pricing_schedule_key,
        created_snapshot_count: createdSnapshotKeys.length,
        existing_snapshot_count: existingSnapshotKeys.length,
        skipped_template_mapping_count: skippedTemplateMappingIds.length,
      },
    });

    return Response.json({
      ok: true,
      created_count: createdSnapshotKeys.length,
      existing_count: existingSnapshotKeys.length,
      skipped_count: skippedTemplateMappingIds.length,
      message:
        "Launch Pricing 2026 feature and capacity snapshots were created. No customer access, plan assignments, subscriptions, or billing changed.",
    });
  } catch (error) {
    console.error(
      "seedLaunchPricingSchedulePlanFeatures error:",
      error?.message || error
    );

    return Response.json(
      {
        ok: false,
        error:
          error?.message ||
          "Unable to seed Launch Pricing 2026 feature snapshots.",
      },
      { status: 500 }
    );
  }
});
