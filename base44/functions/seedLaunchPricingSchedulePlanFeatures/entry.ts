import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

const PRICING_SCHEDULE_KEY = "launch_2026";

function getPlanFeaturePairKey(
  platformPlanId: string,
  platformFeatureId: string
) {
  return `${platformPlanId}::${platformFeatureId}`;
}

function getSnapshotKey(
  pricingScheduleKey: string,
  planKey: string,
  featureKey: string
) {
  return `${pricingScheduleKey}:${planKey}:${featureKey}`;
}

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
 * - Refuses to write if duplicate or malformed template/snapshot data exists.
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
    const existingByPlanFeaturePair = new Map<string, any>();
    const duplicateSnapshotKeys: string[] = [];
    const duplicateSnapshotPlanFeaturePairs: string[] = [];
    const malformedSnapshotRecordIds: string[] = [];

    for (const snapshot of existingSnapshots) {
      const snapshotKey = snapshot?.pricing_schedule_plan_feature_key;
      const platformPlanId = snapshot?.platform_plan_id;
      const platformFeatureId = snapshot?.platform_feature_id;

      if (!snapshotKey || !platformPlanId || !platformFeatureId) {
        malformedSnapshotRecordIds.push(
          String(snapshot?.id || "(missing snapshot id)")
        );
        continue;
      }

      const planFeaturePairKey = getPlanFeaturePairKey(
        platformPlanId,
        platformFeatureId
      );

      if (existingByKey.has(snapshotKey)) {
        duplicateSnapshotKeys.push(snapshotKey);
      } else {
        existingByKey.set(snapshotKey, snapshot);
      }

      if (existingByPlanFeaturePair.has(planFeaturePairKey)) {
        duplicateSnapshotPlanFeaturePairs.push(planFeaturePairKey);
      } else {
        existingByPlanFeaturePair.set(planFeaturePairKey, snapshot);
      }
    }

    if (
      malformedSnapshotRecordIds.length > 0 ||
      duplicateSnapshotKeys.length > 0 ||
      duplicateSnapshotPlanFeaturePairs.length > 0
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "Launch Pricing 2026 has malformed or duplicate schedule-specific feature snapshots. No new snapshots were created.",
          malformed_snapshot_record_ids: Array.from(
            new Set(malformedSnapshotRecordIds)
          ),
          duplicate_snapshot_keys: Array.from(
            new Set(duplicateSnapshotKeys)
          ),
          duplicate_snapshot_plan_feature_pairs: Array.from(
            new Set(duplicateSnapshotPlanFeaturePairs)
          ),
        },
        { status: 409 }
      );
    }

    const allTemplateMappings = Array.isArray(templateMappingRows)
      ? templateMappingRows
      : [];

    const skippedTemplateMappingIds: string[] = [];
    const malformedTemplateMappingIds: string[] = [];
    const templateCandidates: Array<{
      mapping: any;
      plan: any;
      feature: any;
      planFeaturePairKey: string;
      snapshotKey: string;
    }> = [];

    for (const mapping of allTemplateMappings) {
      if (mapping?.is_active === false) {
        continue;
      }

      const plan = activePlansById.get(mapping?.platform_plan_id);
      const feature = activeFeaturesById.get(mapping?.platform_feature_id);

      if (!plan || !feature) {
        skippedTemplateMappingIds.push(
          String(mapping?.id || "(missing template mapping id)")
        );
        continue;
      }

      if (
        !mapping?.id ||
        !plan?.plan_key ||
        !feature?.feature_key ||
        !plan?.id ||
        !feature?.id
      ) {
        malformedTemplateMappingIds.push(
          String(mapping?.id || "(missing template mapping id)")
        );
        continue;
      }

      const planFeaturePairKey = getPlanFeaturePairKey(plan.id, feature.id);
      const snapshotKey = getSnapshotKey(
        pricingSchedule.pricing_schedule_key,
        plan.plan_key,
        feature.feature_key
      );

      templateCandidates.push({
        mapping,
        plan,
        feature,
        planFeaturePairKey,
        snapshotKey,
      });
    }

    if (malformedTemplateMappingIds.length > 0) {
      return Response.json(
        {
          ok: false,
          error:
            "One or more active PlatformPlanFeature template mappings are incomplete. No new snapshots were created.",
          malformed_template_mapping_ids: Array.from(
            new Set(malformedTemplateMappingIds)
          ),
        },
        { status: 409 }
      );
    }

    const templateByPlanFeaturePair = new Map<string, any>();
    const templateBySnapshotKey = new Map<string, any>();
    const duplicateTemplatePlanFeaturePairs: string[] = [];
    const duplicateTemplateSnapshotKeys: string[] = [];

    for (const candidate of templateCandidates) {
      if (templateByPlanFeaturePair.has(candidate.planFeaturePairKey)) {
        duplicateTemplatePlanFeaturePairs.push(candidate.planFeaturePairKey);
      } else {
        templateByPlanFeaturePair.set(
          candidate.planFeaturePairKey,
          candidate
        );
      }

      if (templateBySnapshotKey.has(candidate.snapshotKey)) {
        duplicateTemplateSnapshotKeys.push(candidate.snapshotKey);
      } else {
        templateBySnapshotKey.set(candidate.snapshotKey, candidate);
      }
    }

    if (
      duplicateTemplatePlanFeaturePairs.length > 0 ||
      duplicateTemplateSnapshotKeys.length > 0
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "Duplicate active PlatformPlanFeature template mappings exist. No new snapshots were created.",
          duplicate_template_plan_feature_pairs: Array.from(
            new Set(duplicateTemplatePlanFeaturePairs)
          ),
          duplicate_template_snapshot_keys: Array.from(
            new Set(duplicateTemplateSnapshotKeys)
          ),
        },
        { status: 409 }
      );
    }

    const snapshotIdentityConflicts: Array<{
      snapshot_key: string;
      plan_feature_pair: string;
      issue: string;
    }> = [];

    for (const candidate of templateCandidates) {
      const snapshotByKey = existingByKey.get(candidate.snapshotKey);
      const snapshotByPlanFeaturePair = existingByPlanFeaturePair.get(
        candidate.planFeaturePairKey
      );

      if (snapshotByKey) {
        const snapshotPairKey = getPlanFeaturePairKey(
          snapshotByKey.platform_plan_id,
          snapshotByKey.platform_feature_id
        );

        if (snapshotPairKey !== candidate.planFeaturePairKey) {
          snapshotIdentityConflicts.push({
            snapshot_key: candidate.snapshotKey,
            plan_feature_pair: candidate.planFeaturePairKey,
            issue:
              "The existing deterministic snapshot key belongs to a different plan-feature pair.",
          });
        }
      }

      if (
        snapshotByPlanFeaturePair &&
        snapshotByPlanFeaturePair.pricing_schedule_plan_feature_key !==
          candidate.snapshotKey
      ) {
        snapshotIdentityConflicts.push({
          snapshot_key: candidate.snapshotKey,
          plan_feature_pair: candidate.planFeaturePairKey,
          issue:
            "The existing plan-feature pair has a different deterministic snapshot key.",
        });
      }
    }

    if (snapshotIdentityConflicts.length > 0) {
      return Response.json(
        {
          ok: false,
          error:
            "Existing schedule-specific feature snapshots have inconsistent deterministic identities. No new snapshots were created.",
          snapshot_identity_conflicts: snapshotIdentityConflicts,
        },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    const createdSnapshotKeys: string[] = [];
    const existingSnapshotKeys: string[] = [];

    for (const candidate of templateCandidates) {
      const snapshotAlreadyExists =
        existingByKey.has(candidate.snapshotKey) ||
        existingByPlanFeaturePair.has(candidate.planFeaturePairKey);

      if (snapshotAlreadyExists) {
        existingSnapshotKeys.push(candidate.snapshotKey);
        continue;
      }

      const createdSnapshot =
        await base44.asServiceRole.entities.PlatformPricingSchedulePlanFeature.create(
          {
            pricing_schedule_id: pricingSchedule.id,
            platform_plan_id: candidate.plan.id,
            platform_feature_id: candidate.feature.id,
            platform_plan_feature_id: candidate.mapping.id,
            pricing_schedule_plan_feature_key: candidate.snapshotKey,
            plan_key_snapshot: candidate.plan.plan_key,
            feature_key: candidate.feature.feature_key,
            feature_name_snapshot: candidate.feature.feature_name,
            is_included: candidate.mapping.is_included === true,
            is_add_on_available:
              candidate.mapping.is_add_on_available === true,
            default_limit_value: candidate.mapping.default_limit_value,
            is_active: true,
            effective_at: now,
            notes:
              "Launch Pricing 2026 feature and capacity snapshot created from the active PlatformPlanFeature template.",
          }
        );

      existingByKey.set(candidate.snapshotKey, createdSnapshot);
      existingByPlanFeaturePair.set(
        candidate.planFeaturePairKey,
        createdSnapshot
      );
      createdSnapshotKeys.push(candidate.snapshotKey);
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
