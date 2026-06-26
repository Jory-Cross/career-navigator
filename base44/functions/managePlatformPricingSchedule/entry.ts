import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

const ALLOWED_PLATFORM_ROLES = new Set([
  "platform_owner",
  "platform_billing",
]);

const VALID_ITEM_TYPES = new Set([
  "plan_monthly",
  "plan_activation",
  "billing_rate",
  "add_on_monthly",
  "add_on_activation",
  "manual_adjustment",
]);

const VALID_CHARGE_MODELS = new Set([
  "one_time",
  "monthly_flat",
  "monthly_per_active_unit",
  "usage_based",
]);

function normalizeKey(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function isValidAmount(value: unknown) {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= 0
  );
}

function hasOwnProperty(value: unknown, key: string) {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    Object.prototype.hasOwnProperty.call(value, key)
  );
}

function isValidOptionalLimit(value: unknown) {
  return (
    value === undefined ||
    (typeof value === "number" &&
      Number.isFinite(value) &&
      Number.isInteger(value) &&
      value >= 0)
  );
}

function getPlanFeaturePairKey(
  platformPlanId: string,
  platformFeatureId: string
) {
  return `${platformPlanId}::${platformFeatureId}`;
}

function getPricingSchedulePlanFeatureKey(
  pricingScheduleKey: string,
  planKey: string,
  featureKey: string
) {
  return `${pricingScheduleKey}:${planKey}:${featureKey}`;
}

function inspectSchedulePlanFeatureSnapshots(
  rows: any[],
  pricingScheduleKey: string
) {
  const snapshots = Array.isArray(rows) ? rows : [];
  const byKey = new Map<string, any>();
  const byPlanFeaturePair = new Map<string, any>();
  const malformedSnapshotIds: string[] = [];
  const duplicateSnapshotKeys: string[] = [];
  const duplicatePlanFeaturePairs: string[] = [];
  const inconsistentSnapshotKeys: string[] = [];

  for (const snapshot of snapshots) {
    const snapshotId = String(snapshot?.id || "(missing snapshot id)");
    const snapshotKey = String(
      snapshot?.pricing_schedule_plan_feature_key || ""
    ).trim();
    const platformPlanId = String(snapshot?.platform_plan_id || "").trim();
    const platformFeatureId = String(
      snapshot?.platform_feature_id || ""
    ).trim();
    const platformPlanFeatureId = String(
      snapshot?.platform_plan_feature_id || ""
    ).trim();
    const planKeySnapshot = String(snapshot?.plan_key_snapshot || "").trim();
    const featureKey = String(snapshot?.feature_key || "").trim();

    if (
      !snapshotKey ||
      !platformPlanId ||
      !platformFeatureId ||
      !platformPlanFeatureId ||
      !planKeySnapshot ||
      !featureKey
    ) {
      malformedSnapshotIds.push(snapshotId);
      continue;
    }

    const expectedSnapshotKey = getPricingSchedulePlanFeatureKey(
      pricingScheduleKey,
      planKeySnapshot,
      featureKey
    );

    if (snapshotKey !== expectedSnapshotKey) {
      inconsistentSnapshotKeys.push(snapshotKey);
    }

    const planFeaturePairKey = getPlanFeaturePairKey(
      platformPlanId,
      platformFeatureId
    );

    if (byKey.has(snapshotKey)) {
      duplicateSnapshotKeys.push(snapshotKey);
    } else {
      byKey.set(snapshotKey, snapshot);
    }

    if (byPlanFeaturePair.has(planFeaturePairKey)) {
      duplicatePlanFeaturePairs.push(planFeaturePairKey);
    } else {
      byPlanFeaturePair.set(planFeaturePairKey, snapshot);
    }
  }

  return {
    byKey,
    byPlanFeaturePair,
    malformedSnapshotIds: Array.from(new Set(malformedSnapshotIds)),
    duplicateSnapshotKeys: Array.from(new Set(duplicateSnapshotKeys)),
    duplicatePlanFeaturePairs: Array.from(
      new Set(duplicatePlanFeaturePairs)
    ),
    inconsistentSnapshotKeys: Array.from(
      new Set(inconsistentSnapshotKeys)
    ),
  };
}

function hasSnapshotIntegrityIssues(inspection: any) {
  return (
    inspection.malformedSnapshotIds.length > 0 ||
    inspection.duplicateSnapshotKeys.length > 0 ||
    inspection.duplicatePlanFeaturePairs.length > 0 ||
    inspection.inconsistentSnapshotKeys.length > 0
  );
}

async function getPlatformPlanById(base44: any, planId: string) {
  const rows = await base44.asServiceRole.entities.PlatformPlan.filter({
    id: planId,
  });

  return Array.isArray(rows) ? rows[0] || null : null;
}

async function getPlatformFeatureById(base44: any, featureId: string) {
  const rows = await base44.asServiceRole.entities.PlatformFeature.filter({
    id: featureId,
  });

  return Array.isArray(rows) ? rows[0] || null : null;
}

async function getSingleActiveTemplateMapping(
  base44: any,
  platformPlanId: string,
  platformFeatureId: string
) {
  const rows =
    await base44.asServiceRole.entities.PlatformPlanFeature.filter({
      platform_plan_id: platformPlanId,
      platform_feature_id: platformFeatureId,
    });

  const activeRows = (Array.isArray(rows) ? rows : []).filter(
    (row) => row?.is_active !== false
  );

  if (activeRows.length !== 1) {
    return {
      mapping: null,
      activeMappingCount: activeRows.length,
    };
  }

  return {
    mapping: activeRows[0],
    activeMappingCount: 1,
  };
}

async function getPlatformRoles(base44: any, userId: string) {
  const rows = await base44.asServiceRole.entities.PlatformAdmin.filter({
    user_id: userId,
    is_active: true,
  });

  return Array.from(
    new Set(
      (Array.isArray(rows) ? rows : [])
        .filter((row) => row?.is_active !== false)
        .map((row) => row?.platform_role)
        .filter(Boolean)
    )
  );
}

async function getSchedule(base44: any, scheduleId: string) {
  const rows =
    await base44.asServiceRole.entities.PlatformPricingSchedule.filter({
      id: scheduleId,
    });

  return Array.isArray(rows) ? rows[0] || null : null;
}

async function assertEditableDraft(base44: any, scheduleId: string) {
  const schedule = await getSchedule(base44, scheduleId);

  if (!schedule) {
    throw new Error("Pricing schedule not found.");
  }

  if (schedule.schedule_status !== "draft" || schedule.locked_at) {
    throw new Error(
      "Only unlocked draft pricing schedules may be edited. Create or clone a new draft for pricing changes."
    );
  }

  return schedule;
}

async function writeAuditLog(
  base44: any,
  userId: string,
  eventKey: string,
  eventSummary: string,
  targetEntity: string,
  targetRecordId: string | null,
  details: Record<string, unknown>
) {
  try {
    await base44.asServiceRole.entities.PlatformAuditLog.create({
      platform_admin_user_id: userId,
      event_key: eventKey,
      event_summary: eventSummary,
      actor_type: "platform_admin",
      target_entity: targetEntity,
      target_record_id: targetRecordId,
      tenant_visible: false,
      occurred_at: new Date().toISOString(),
      details,
    });
  } catch (error) {
    console.error(
      "managePlatformPricingSchedule audit error:",
      error?.message || error
    );
  }
}

/**
 * managePlatformPricingSchedule
 *
 * Supported actions:
 * - create_draft
 * - clone_to_draft
 * - update_draft_details
 * - upsert_draft_item
 * - archive_draft_item
 * - upsert_draft_plan_feature_snapshot
 * - archive_draft_plan_feature_snapshot
 * - activate_for_new_accounts
 * - retire_schedule
 *
 * Customer organizations remain pinned to their existing
 * OrganizationPricingScheduleAssignment records unless a separate,
 * explicit future assignment workflow changes them.
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

    const platformRoles = await getPlatformRoles(base44, user.id);

    const canManagePricing = platformRoles.some((role) =>
      ALLOWED_PLATFORM_ROLES.has(role)
    );

    if (!canManagePricing) {
      return Response.json(
        {
          ok: false,
          error:
            "Only Platform Owners and Platform Billing users may manage pricing schedules.",
        },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "").trim();

    if (
      ![
        "create_draft",
        "clone_to_draft",
        "update_draft_details",
        "upsert_draft_item",
        "archive_draft_item",
        "upsert_draft_plan_feature_snapshot",
        "archive_draft_plan_feature_snapshot",
        "activate_for_new_accounts",
        "retire_schedule",
      ].includes(action)
    ) {
      return Response.json(
        {
          ok: false,
          error: "A valid pricing-management action is required.",
        },
        { status: 400 }
      );
    }

    // ── Create a blank editable pricing draft ──────────────────────────────
    if (action === "create_draft") {
      const pricingScheduleKey = normalizeKey(body?.pricing_schedule_key);
      const pricingScheduleName = String(
        body?.pricing_schedule_name || ""
      ).trim();

      if (!pricingScheduleKey || !pricingScheduleName) {
        return Response.json(
          {
            ok: false,
            error:
              "pricing_schedule_key and pricing_schedule_name are required.",
          },
          { status: 400 }
        );
      }

      const existingRows =
        await base44.asServiceRole.entities.PlatformPricingSchedule.filter({
          pricing_schedule_key: pricingScheduleKey,
        });

      if ((Array.isArray(existingRows) ? existingRows : []).length > 0) {
        return Response.json(
          {
            ok: false,
            error:
              "A pricing schedule already uses this pricing_schedule_key.",
          },
          { status: 409 }
        );
      }

      const now = new Date().toISOString();

      const schedule =
        await base44.asServiceRole.entities.PlatformPricingSchedule.create({
          pricing_schedule_key: pricingScheduleKey,
          pricing_schedule_name: pricingScheduleName,
          description: String(body?.description || "").trim(),
          schedule_status: "draft",
          is_default_for_new_accounts: false,
          currency: String(body?.currency || "USD").trim() || "USD",
          effective_at: body?.effective_at || now,
          supersedes_pricing_schedule_id:
            body?.supersedes_pricing_schedule_id || undefined,
          notes: String(body?.notes || "").trim(),
        });

      await writeAuditLog(
        base44,
        user.id,
        "pricing_schedule_draft_created",
        "An editable pricing schedule draft was created.",
        "PlatformPricingSchedule",
        schedule.id,
        {
          pricing_schedule_key: schedule.pricing_schedule_key,
          pricing_schedule_name: schedule.pricing_schedule_name,
        }
      );

      return Response.json({
        ok: true,
        action,
        pricing_schedule: schedule,
      });
    }

    // ── Clone an existing schedule into a new editable draft ───────────────
    if (action === "clone_to_draft") {
      const sourceScheduleId = String(
        body?.source_pricing_schedule_id || ""
      ).trim();
      const pricingScheduleKey = normalizeKey(body?.pricing_schedule_key);
      const pricingScheduleName = String(
        body?.pricing_schedule_name || ""
      ).trim();

      if (!sourceScheduleId || !pricingScheduleKey || !pricingScheduleName) {
        return Response.json(
          {
            ok: false,
            error:
              "source_pricing_schedule_id, pricing_schedule_key, and pricing_schedule_name are required.",
          },
          { status: 400 }
        );
      }

      const sourceSchedule = await getSchedule(base44, sourceScheduleId);

      if (!sourceSchedule) {
        return Response.json(
          { ok: false, error: "Source pricing schedule not found." },
          { status: 404 }
        );
      }

      const duplicateRows =
        await base44.asServiceRole.entities.PlatformPricingSchedule.filter({
          pricing_schedule_key: pricingScheduleKey,
        });

      if ((Array.isArray(duplicateRows) ? duplicateRows : []).length > 0) {
        return Response.json(
          {
            ok: false,
            error:
              "A pricing schedule already uses this pricing_schedule_key.",
          },
          { status: 409 }
        );
      }

      const [sourceItemRows, sourceSnapshotRows] = await Promise.all([
        base44.asServiceRole.entities.PlatformPricingScheduleItem.filter({
          pricing_schedule_id: sourceSchedule.id,
        }),
        base44.asServiceRole.entities.PlatformPricingSchedulePlanFeature.filter(
          {
            pricing_schedule_id: sourceSchedule.id,
          }
        ),
      ]);

      const sourceItems = Array.isArray(sourceItemRows)
        ? sourceItemRows
        : [];
      const sourceSnapshots = Array.isArray(sourceSnapshotRows)
        ? sourceSnapshotRows
        : [];
      const sourceSnapshotInspection = inspectSchedulePlanFeatureSnapshots(
        sourceSnapshots,
        sourceSchedule.pricing_schedule_key
      );

      if (hasSnapshotIntegrityIssues(sourceSnapshotInspection)) {
        return Response.json(
          {
            ok: false,
            error:
              "The source pricing schedule has malformed or duplicate feature snapshots. No draft was created.",
            malformed_snapshot_ids:
              sourceSnapshotInspection.malformedSnapshotIds,
            duplicate_snapshot_keys:
              sourceSnapshotInspection.duplicateSnapshotKeys,
            duplicate_plan_feature_pairs:
              sourceSnapshotInspection.duplicatePlanFeaturePairs,
            inconsistent_snapshot_keys:
              sourceSnapshotInspection.inconsistentSnapshotKeys,
          },
          { status: 409 }
        );
      }

      const now = new Date().toISOString();

      const newSchedule =
        await base44.asServiceRole.entities.PlatformPricingSchedule.create({
          pricing_schedule_key: pricingScheduleKey,
          pricing_schedule_name: pricingScheduleName,
          description:
            String(body?.description || "").trim() ||
            `Draft copied from ${sourceSchedule.pricing_schedule_name}.`,
          schedule_status: "draft",
          is_default_for_new_accounts: false,
          currency: sourceSchedule.currency || "USD",
          effective_at: body?.effective_at || now,
          supersedes_pricing_schedule_id: sourceSchedule.id,
          notes: String(body?.notes || "").trim(),
        });

      let copiedItemCount = 0;
      let copiedPlanFeatureSnapshotCount = 0;

      for (const sourceItem of sourceItems) {
        const suffix = String(sourceItem.pricing_item_key || "")
          .split(":")
          .slice(1)
          .join(":");

        const copiedItemKey = suffix
          ? `${pricingScheduleKey}:${suffix}`
          : `${pricingScheduleKey}:copied_item_${copiedItemCount + 1}`;

        await base44.asServiceRole.entities.PlatformPricingScheduleItem.create(
          {
            pricing_schedule_id: newSchedule.id,
            pricing_item_key: copiedItemKey,
            pricing_item_type: sourceItem.pricing_item_type,
            platform_plan_id: sourceItem.platform_plan_id || undefined,
            plan_key_snapshot: sourceItem.plan_key_snapshot || undefined,
            platform_billing_rate_id:
              sourceItem.platform_billing_rate_id || undefined,
            billing_rate_key_snapshot:
              sourceItem.billing_rate_key_snapshot || undefined,
            feature_key: sourceItem.feature_key || undefined,
            charge_model: sourceItem.charge_model,
            amount_cents: sourceItem.amount_cents,
            currency: sourceItem.currency || "USD",
            is_active: sourceItem.is_active !== false,
            effective_at: now,
            notes: sourceItem.notes || "",
          }
        );

        copiedItemCount += 1;
      }

      for (const sourceSnapshot of sourceSnapshots) {
        const copiedSnapshotKey = getPricingSchedulePlanFeatureKey(
          pricingScheduleKey,
          sourceSnapshot.plan_key_snapshot,
          sourceSnapshot.feature_key
        );

        await base44.asServiceRole.entities.PlatformPricingSchedulePlanFeature.create(
          {
            pricing_schedule_id: newSchedule.id,
            platform_plan_id: sourceSnapshot.platform_plan_id,
            platform_feature_id: sourceSnapshot.platform_feature_id,
            platform_plan_feature_id:
              sourceSnapshot.platform_plan_feature_id || undefined,
            pricing_schedule_plan_feature_key: copiedSnapshotKey,
            plan_key_snapshot: sourceSnapshot.plan_key_snapshot,
            feature_key: sourceSnapshot.feature_key,
            feature_name_snapshot:
              sourceSnapshot.feature_name_snapshot || "",
            is_included: sourceSnapshot.is_included === true,
            is_add_on_available:
              sourceSnapshot.is_add_on_available === true,
            default_limit_value:
              sourceSnapshot.default_limit_value ?? undefined,
            is_active: sourceSnapshot.is_active !== false,
            effective_at: now,
            notes: sourceSnapshot.notes || "",
          }
        );

        copiedPlanFeatureSnapshotCount += 1;
      }

      await writeAuditLog(
        base44,
        user.id,
        "pricing_schedule_cloned_to_draft",
        "A pricing schedule was cloned into a new editable draft.",
        "PlatformPricingSchedule",
        newSchedule.id,
        {
          source_pricing_schedule_id: sourceSchedule.id,
          source_pricing_schedule_key: sourceSchedule.pricing_schedule_key,
          copied_item_count: copiedItemCount,
          copied_plan_feature_snapshot_count:
            copiedPlanFeatureSnapshotCount,
        }
      );

      return Response.json({
        ok: true,
        action,
        pricing_schedule: newSchedule,
        copied_item_count: copiedItemCount,
        copied_plan_feature_snapshot_count:
          copiedPlanFeatureSnapshotCount,
      });
    }

    // ── Update editable draft details ──────────────────────────────────────
    if (action === "update_draft_details") {
      const scheduleId = String(body?.pricing_schedule_id || "").trim();

      if (!scheduleId) {
        return Response.json(
          { ok: false, error: "pricing_schedule_id is required." },
          { status: 400 }
        );
      }

      const schedule = await assertEditableDraft(base44, scheduleId);

      const updateData: Record<string, unknown> = {};

      if (typeof body?.pricing_schedule_name === "string") {
        const name = body.pricing_schedule_name.trim();

        if (!name) {
          return Response.json(
            {
              ok: false,
              error: "pricing_schedule_name cannot be blank.",
            },
            { status: 400 }
          );
        }

        updateData.pricing_schedule_name = name;
      }

      if (typeof body?.description === "string") {
        updateData.description = body.description.trim();
      }

      if (typeof body?.notes === "string") {
        updateData.notes = body.notes.trim();
      }

      if (typeof body?.effective_at === "string" && body.effective_at) {
        updateData.effective_at = body.effective_at;
      }

      if (typeof body?.currency === "string" && body.currency.trim()) {
        updateData.currency = body.currency.trim();
      }

      if (Object.keys(updateData).length === 0) {
        return Response.json(
          {
            ok: false,
            error: "No editable draft fields were supplied.",
          },
          { status: 400 }
        );
      }

      await base44.asServiceRole.entities.PlatformPricingSchedule.update(
        schedule.id,
        updateData
      );

      await writeAuditLog(
        base44,
        user.id,
        "pricing_schedule_draft_updated",
        "An editable pricing schedule draft was updated.",
        "PlatformPricingSchedule",
        schedule.id,
        {
          updated_fields: Object.keys(updateData),
        }
      );

      return Response.json({
        ok: true,
        action,
        pricing_schedule_id: schedule.id,
        updated_fields: Object.keys(updateData),
      });
    }

    // ── Create or update one exact price inside an editable draft ──────────
    if (action === "upsert_draft_item") {
      const scheduleId = String(body?.pricing_schedule_id || "").trim();

      if (!scheduleId) {
        return Response.json(
          { ok: false, error: "pricing_schedule_id is required." },
          { status: 400 }
        );
      }

      const schedule = await assertEditableDraft(base44, scheduleId);

      const pricingItemType = String(body?.pricing_item_type || "").trim();
      const chargeModel = String(body?.charge_model || "").trim();
      const amountCents = body?.amount_cents;

      if (!VALID_ITEM_TYPES.has(pricingItemType)) {
        return Response.json(
          { ok: false, error: "A valid pricing_item_type is required." },
          { status: 400 }
        );
      }

      if (!VALID_CHARGE_MODELS.has(chargeModel)) {
        return Response.json(
          { ok: false, error: "A valid charge_model is required." },
          { status: 400 }
        );
      }

      if (!isValidAmount(amountCents)) {
        return Response.json(
          {
            ok: false,
            error:
              "amount_cents must be a non-negative whole number of cents.",
          },
          { status: 400 }
        );
      }

      const platformPlanId = String(body?.platform_plan_id || "").trim();
      const platformBillingRateId = String(
        body?.platform_billing_rate_id || ""
      ).trim();
      const featureKey = String(body?.feature_key || "").trim();

      let plan = null;
      let billingRate = null;

      if (platformPlanId) {
        const planRows =
          await base44.asServiceRole.entities.PlatformPlan.filter({
            id: platformPlanId,
          });

        plan = Array.isArray(planRows) ? planRows[0] || null : null;

        if (!plan) {
          return Response.json(
            { ok: false, error: "platform_plan_id was not found." },
            { status: 404 }
          );
        }
      }

      if (platformBillingRateId) {
        const rateRows =
          await base44.asServiceRole.entities.PlatformBillingRate.filter({
            id: platformBillingRateId,
          });

        billingRate = Array.isArray(rateRows)
          ? rateRows[0] || null
          : null;

        if (!billingRate) {
          return Response.json(
            {
              ok: false,
              error: "platform_billing_rate_id was not found.",
            },
            { status: 404 }
          );
        }
      }

      if (
        !plan &&
        !billingRate &&
        !featureKey &&
        pricingItemType !== "manual_adjustment"
      ) {
        return Response.json(
          {
            ok: false,
            error:
              "A plan, billing-rate template, feature_key, or manual adjustment reference is required.",
          },
          { status: 400 }
        );
      }

      const referenceKey =
        plan?.plan_key ||
        billingRate?.rate_key ||
        featureKey ||
        normalizeKey(body?.reference_key) ||
        "manual";

      const proposedItemKey =
        `${schedule.pricing_schedule_key}:${pricingItemType}:${referenceKey}`;

      const suppliedItemId = String(
        body?.pricing_schedule_item_id || ""
      ).trim();

      let existingItem = null;

      if (suppliedItemId) {
        const existingItemRows =
          await base44.asServiceRole.entities.PlatformPricingScheduleItem.filter(
            {
              id: suppliedItemId,
              pricing_schedule_id: schedule.id,
            }
          );

        existingItem = Array.isArray(existingItemRows)
          ? existingItemRows[0] || null
          : null;

        if (!existingItem) {
          return Response.json(
            {
              ok: false,
              error:
                "pricing_schedule_item_id was not found in this pricing schedule.",
            },
            { status: 404 }
          );
        }
      } else {
        const matchingItemRows =
          await base44.asServiceRole.entities.PlatformPricingScheduleItem.filter(
            {
              pricing_schedule_id: schedule.id,
              pricing_item_key: proposedItemKey,
            }
          );

        existingItem = Array.isArray(matchingItemRows)
          ? matchingItemRows[0] || null
          : null;
      }

      const now = new Date().toISOString();

      const itemData = {
        pricing_schedule_id: schedule.id,
        pricing_item_key: existingItem?.pricing_item_key || proposedItemKey,
        pricing_item_type: pricingItemType,
        platform_plan_id: plan?.id || undefined,
        plan_key_snapshot: plan?.plan_key || undefined,
        platform_billing_rate_id: billingRate?.id || undefined,
        billing_rate_key_snapshot: billingRate?.rate_key || undefined,
        feature_key: featureKey || billingRate?.feature_key || undefined,
        charge_model: chargeModel,
        amount_cents: amountCents,
        currency: String(body?.currency || schedule.currency || "USD").trim(),
        is_active: body?.is_active !== false,
        effective_at: body?.effective_at || now,
        ends_at: body?.ends_at || undefined,
        notes: String(body?.notes || "").trim(),
      };

      let pricingItemId = existingItem?.id || null;
      let created = false;

      if (existingItem) {
        await base44.asServiceRole.entities.PlatformPricingScheduleItem.update(
          existingItem.id,
          itemData
        );
      } else {
        const createdItem =
          await base44.asServiceRole.entities.PlatformPricingScheduleItem.create(
            itemData
          );

        pricingItemId = createdItem.id;
        created = true;
      }

      await writeAuditLog(
        base44,
        user.id,
        created
          ? "pricing_schedule_draft_item_created"
          : "pricing_schedule_draft_item_updated",
        created
          ? "A pricing item was added to an editable pricing schedule draft."
          : "A pricing item in an editable pricing schedule draft was updated.",
        "PlatformPricingScheduleItem",
        pricingItemId,
        {
          pricing_schedule_id: schedule.id,
          pricing_item_key: itemData.pricing_item_key,
          pricing_item_type: pricingItemType,
          amount_cents: amountCents,
        }
      );

      return Response.json({
        ok: true,
        action,
        created,
        pricing_schedule_item_id: pricingItemId,
        pricing_item_key: itemData.pricing_item_key,
      });
    }

    // ── Archive an item from an editable draft ─────────────────────────────
    if (action === "archive_draft_item") {
      const scheduleId = String(body?.pricing_schedule_id || "").trim();
      const itemId = String(body?.pricing_schedule_item_id || "").trim();

      if (!scheduleId || !itemId) {
        return Response.json(
          {
            ok: false,
            error:
              "pricing_schedule_id and pricing_schedule_item_id are required.",
          },
          { status: 400 }
        );
      }

      await assertEditableDraft(base44, scheduleId);

      const itemRows =
        await base44.asServiceRole.entities.PlatformPricingScheduleItem.filter(
          {
            id: itemId,
            pricing_schedule_id: scheduleId,
          }
        );

      const item = Array.isArray(itemRows) ? itemRows[0] || null : null;

      if (!item) {
        return Response.json(
          {
            ok: false,
            error:
              "Pricing schedule item was not found in this pricing schedule.",
          },
          { status: 404 }
        );
      }

      await base44.asServiceRole.entities.PlatformPricingScheduleItem.update(
        item.id,
        {
          is_active: false,
          ends_at: new Date().toISOString(),
        }
      );

      await writeAuditLog(
        base44,
        user.id,
        "pricing_schedule_draft_item_archived",
        "A pricing item was archived from an editable pricing schedule draft.",
        "PlatformPricingScheduleItem",
        item.id,
        {
          pricing_schedule_id: scheduleId,
          pricing_item_key: item.pricing_item_key,
        }
      );

      return Response.json({
        ok: true,
        action,
        pricing_schedule_item_id: item.id,
      });
    }


    // ── Create or update one feature snapshot inside an editable draft ─────
    if (action === "upsert_draft_plan_feature_snapshot") {
      const scheduleId = String(body?.pricing_schedule_id || "").trim();
      const suppliedSnapshotId = String(
        body?.pricing_schedule_plan_feature_id || ""
      ).trim();
      const suppliedPlanId = String(body?.platform_plan_id || "").trim();
      const suppliedFeatureId = String(
        body?.platform_feature_id || ""
      ).trim();

      if (!scheduleId) {
        return Response.json(
          { ok: false, error: "pricing_schedule_id is required." },
          { status: 400 }
        );
      }

      const schedule = await assertEditableDraft(base44, scheduleId);

      const snapshotRows =
        await base44.asServiceRole.entities.PlatformPricingSchedulePlanFeature.filter(
          {
            pricing_schedule_id: schedule.id,
          }
        );

      const snapshotInspection = inspectSchedulePlanFeatureSnapshots(
        Array.isArray(snapshotRows) ? snapshotRows : [],
        schedule.pricing_schedule_key
      );

      if (hasSnapshotIntegrityIssues(snapshotInspection)) {
        return Response.json(
          {
            ok: false,
            error:
              "This pricing schedule has malformed or duplicate feature snapshots. No snapshot was changed.",
            malformed_snapshot_ids:
              snapshotInspection.malformedSnapshotIds,
            duplicate_snapshot_keys:
              snapshotInspection.duplicateSnapshotKeys,
            duplicate_plan_feature_pairs:
              snapshotInspection.duplicatePlanFeaturePairs,
            inconsistent_snapshot_keys:
              snapshotInspection.inconsistentSnapshotKeys,
          },
          { status: 409 }
        );
      }

      let existingSnapshot: any = null;
      let platformPlanId = "";
      let platformFeatureId = "";
      let platformPlanFeatureId = "";
      let planKeySnapshot = "";
      let featureKey = "";
      let featureNameSnapshot = "";
      let templateMapping: any = null;

      if (suppliedSnapshotId) {
        const suppliedSnapshotRows =
          await base44.asServiceRole.entities.PlatformPricingSchedulePlanFeature.filter(
            {
              id: suppliedSnapshotId,
              pricing_schedule_id: schedule.id,
            }
          );

        existingSnapshot = Array.isArray(suppliedSnapshotRows)
          ? suppliedSnapshotRows[0] || null
          : null;

        if (!existingSnapshot) {
          return Response.json(
            {
              ok: false,
              error:
                "pricing_schedule_plan_feature_id was not found in this pricing schedule.",
            },
            { status: 404 }
          );
        }

        if (
          (suppliedPlanId &&
            suppliedPlanId !== existingSnapshot.platform_plan_id) ||
          (suppliedFeatureId &&
            suppliedFeatureId !== existingSnapshot.platform_feature_id)
        ) {
          return Response.json(
            {
              ok: false,
              error:
                "A schedule feature snapshot identity cannot be changed. Create a separate snapshot for a different plan-feature pair.",
            },
            { status: 409 }
          );
        }

        platformPlanId = existingSnapshot.platform_plan_id;
        platformFeatureId = existingSnapshot.platform_feature_id;
        platformPlanFeatureId =
          existingSnapshot.platform_plan_feature_id;
        planKeySnapshot = existingSnapshot.plan_key_snapshot;
        featureKey = existingSnapshot.feature_key;
        featureNameSnapshot =
          existingSnapshot.feature_name_snapshot || "";
      } else {
        if (!suppliedPlanId || !suppliedFeatureId) {
          return Response.json(
            {
              ok: false,
              error:
                "platform_plan_id and platform_feature_id are required when pricing_schedule_plan_feature_id is not supplied.",
            },
            { status: 400 }
          );
        }

        const [plan, feature] = await Promise.all([
          getPlatformPlanById(base44, suppliedPlanId),
          getPlatformFeatureById(base44, suppliedFeatureId),
        ]);

        if (!plan || !feature) {
          return Response.json(
            {
              ok: false,
              error:
                "platform_plan_id and platform_feature_id must reference existing catalog records.",
            },
            { status: 404 }
          );
        }

        if (plan.is_active === false || feature.is_active === false) {
          return Response.json(
            {
              ok: false,
              error:
                "Only active PlatformPlan and PlatformFeature catalog records may be added to a pricing draft.",
            },
            { status: 409 }
          );
        }

        platformPlanId = plan.id;
        platformFeatureId = feature.id;
        planKeySnapshot = plan.plan_key;
        featureKey = feature.feature_key;
        featureNameSnapshot = feature.feature_name || "";

        if (!planKeySnapshot || !featureKey) {
          return Response.json(
            {
              ok: false,
              error:
                "The selected PlatformPlan or PlatformFeature is missing its immutable catalog key.",
            },
            { status: 409 }
          );
        }

        const candidateSnapshotKey = getPricingSchedulePlanFeatureKey(
          schedule.pricing_schedule_key,
          planKeySnapshot,
          featureKey
        );
        const candidatePairKey = getPlanFeaturePairKey(
          platformPlanId,
          platformFeatureId
        );
        const snapshotByKey =
          snapshotInspection.byKey.get(candidateSnapshotKey) || null;
        const snapshotByPair =
          snapshotInspection.byPlanFeaturePair.get(candidatePairKey) || null;

        if (
          snapshotByKey &&
          getPlanFeaturePairKey(
            snapshotByKey.platform_plan_id,
            snapshotByKey.platform_feature_id
          ) !== candidatePairKey
        ) {
          return Response.json(
            {
              ok: false,
              error:
                "The deterministic snapshot key is already associated with a different plan-feature pair. No snapshot was changed.",
            },
            { status: 409 }
          );
        }

        if (
          snapshotByPair &&
          snapshotByPair.pricing_schedule_plan_feature_key !==
            candidateSnapshotKey
        ) {
          return Response.json(
            {
              ok: false,
              error:
                "The selected plan-feature pair already has a different deterministic snapshot key. No snapshot was changed.",
            },
            { status: 409 }
          );
        }

        if (
          snapshotByKey &&
          snapshotByPair &&
          snapshotByKey.id !== snapshotByPair.id
        ) {
          return Response.json(
            {
              ok: false,
              error:
                "The selected schedule feature snapshot identity is inconsistent. No snapshot was changed.",
            },
            { status: 409 }
          );
        }

        existingSnapshot = snapshotByKey || snapshotByPair || null;

        if (existingSnapshot) {
          platformPlanFeatureId =
            existingSnapshot.platform_plan_feature_id;
          planKeySnapshot = existingSnapshot.plan_key_snapshot;
          featureKey = existingSnapshot.feature_key;
          featureNameSnapshot =
            existingSnapshot.feature_name_snapshot || featureNameSnapshot;
        } else {
          const templateLookup = await getSingleActiveTemplateMapping(
            base44,
            platformPlanId,
            platformFeatureId
          );

          if (!templateLookup.mapping) {
            return Response.json(
              {
                ok: false,
                error:
                  "The selected plan-feature pair must have exactly one active PlatformPlanFeature template mapping before it can be snapshotted.",
                active_template_mapping_count:
                  templateLookup.activeMappingCount,
              },
              { status: 409 }
            );
          }

          templateMapping = templateLookup.mapping;
          platformPlanFeatureId = templateMapping.id;
        }
      }

      const snapshotKey = getPricingSchedulePlanFeatureKey(
        schedule.pricing_schedule_key,
        planKeySnapshot,
        featureKey
      );
      const planFeaturePairKey = getPlanFeaturePairKey(
        platformPlanId,
        platformFeatureId
      );
      const snapshotByKey =
        snapshotInspection.byKey.get(snapshotKey) || null;
      const snapshotByPair =
        snapshotInspection.byPlanFeaturePair.get(planFeaturePairKey) || null;

      if (
        snapshotByKey &&
        snapshotByPair &&
        snapshotByKey.id !== snapshotByPair.id
      ) {
        return Response.json(
          {
            ok: false,
            error:
              "The selected schedule feature snapshot identity is inconsistent. No snapshot was changed.",
          },
          { status: 409 }
        );
      }

      if (
        existingSnapshot &&
        ((snapshotByKey && snapshotByKey.id !== existingSnapshot.id) ||
          (snapshotByPair && snapshotByPair.id !== existingSnapshot.id))
      ) {
        return Response.json(
          {
            ok: false,
            error:
              "A different schedule feature snapshot already uses this deterministic identity. No snapshot was changed.",
          },
          { status: 409 }
        );
      }

      if (
        hasOwnProperty(body, "is_included") &&
        typeof body.is_included !== "boolean"
      ) {
        return Response.json(
          {
            ok: false,
            error: "is_included must be true or false when supplied.",
          },
          { status: 400 }
        );
      }

      if (
        hasOwnProperty(body, "is_add_on_available") &&
        typeof body.is_add_on_available !== "boolean"
      ) {
        return Response.json(
          {
            ok: false,
            error:
              "is_add_on_available must be true or false when supplied.",
          },
          { status: 400 }
        );
      }

      if (
        hasOwnProperty(body, "is_active") &&
        typeof body.is_active !== "boolean"
      ) {
        return Response.json(
          {
            ok: false,
            error: "is_active must be true or false when supplied.",
          },
          { status: 400 }
        );
      }

      if (
        hasOwnProperty(body, "default_limit_value") &&
        !isValidOptionalLimit(body.default_limit_value)
      ) {
        return Response.json(
          {
            ok: false,
            error:
              "default_limit_value must be a non-negative whole number when supplied.",
          },
          { status: 400 }
        );
      }

      if (
        hasOwnProperty(body, "effective_at") &&
        (typeof body.effective_at !== "string" ||
          !body.effective_at.trim())
      ) {
        return Response.json(
          {
            ok: false,
            error: "effective_at must be a non-empty ISO datetime string.",
          },
          { status: 400 }
        );
      }

      if (
        hasOwnProperty(body, "notes") &&
        typeof body.notes !== "string"
      ) {
        return Response.json(
          {
            ok: false,
            error: "notes must be a string when supplied.",
          },
          { status: 400 }
        );
      }

      const now = new Date().toISOString();
      const nextData = {
        pricing_schedule_id: schedule.id,
        platform_plan_id: platformPlanId,
        platform_feature_id: platformFeatureId,
        platform_plan_feature_id:
          existingSnapshot?.platform_plan_feature_id ||
          platformPlanFeatureId ||
          undefined,
        pricing_schedule_plan_feature_key: snapshotKey,
        plan_key_snapshot: planKeySnapshot,
        feature_key: featureKey,
        feature_name_snapshot: featureNameSnapshot,
        is_included: hasOwnProperty(body, "is_included")
          ? body.is_included
          : existingSnapshot
            ? existingSnapshot.is_included === true
            : templateMapping.is_included === true,
        is_add_on_available: hasOwnProperty(
          body,
          "is_add_on_available"
        )
          ? body.is_add_on_available
          : existingSnapshot
            ? existingSnapshot.is_add_on_available === true
            : templateMapping.is_add_on_available === true,
        default_limit_value: hasOwnProperty(body, "default_limit_value")
          ? body.default_limit_value
          : existingSnapshot
            ? existingSnapshot.default_limit_value ?? undefined
            : templateMapping.default_limit_value ?? undefined,
        is_active: hasOwnProperty(body, "is_active")
          ? body.is_active
          : existingSnapshot
            ? existingSnapshot.is_active !== false
            : true,
        effective_at: hasOwnProperty(body, "effective_at")
          ? body.effective_at.trim()
          : existingSnapshot?.effective_at || now,
        notes: hasOwnProperty(body, "notes")
          ? body.notes.trim()
          : existingSnapshot?.notes ||
            "Pricing schedule feature and capacity snapshot.",
      };

      let pricingSchedulePlanFeatureId = existingSnapshot?.id || null;
      let created = false;

      if (existingSnapshot) {
        await base44.asServiceRole.entities.PlatformPricingSchedulePlanFeature.update(
          existingSnapshot.id,
          nextData
        );
      } else {
        const createdSnapshot =
          await base44.asServiceRole.entities.PlatformPricingSchedulePlanFeature.create(
            nextData
          );

        pricingSchedulePlanFeatureId = createdSnapshot.id;
        created = true;
      }

      await writeAuditLog(
        base44,
        user.id,
        created
          ? "pricing_schedule_draft_plan_feature_snapshot_created"
          : "pricing_schedule_draft_plan_feature_snapshot_updated",
        created
          ? "A feature and capacity snapshot was added to an editable pricing schedule draft."
          : "A feature and capacity snapshot in an editable pricing schedule draft was updated.",
        "PlatformPricingSchedulePlanFeature",
        pricingSchedulePlanFeatureId,
        {
          pricing_schedule_id: schedule.id,
          pricing_schedule_plan_feature_key: snapshotKey,
          platform_plan_id: platformPlanId,
          platform_feature_id: platformFeatureId,
          is_included: nextData.is_included,
          is_add_on_available: nextData.is_add_on_available,
          default_limit_value: nextData.default_limit_value,
        }
      );

      return Response.json({
        ok: true,
        action,
        created,
        pricing_schedule_plan_feature_id:
          pricingSchedulePlanFeatureId,
        pricing_schedule_plan_feature_key: snapshotKey,
      });
    }

    // ── Archive one feature snapshot from an editable draft ────────────────
    if (action === "archive_draft_plan_feature_snapshot") {
      const scheduleId = String(body?.pricing_schedule_id || "").trim();
      const snapshotId = String(
        body?.pricing_schedule_plan_feature_id || ""
      ).trim();

      if (!scheduleId || !snapshotId) {
        return Response.json(
          {
            ok: false,
            error:
              "pricing_schedule_id and pricing_schedule_plan_feature_id are required.",
          },
          { status: 400 }
        );
      }

      const schedule = await assertEditableDraft(base44, scheduleId);

      const snapshotRows =
        await base44.asServiceRole.entities.PlatformPricingSchedulePlanFeature.filter(
          {
            pricing_schedule_id: schedule.id,
          }
        );

      const snapshotInspection = inspectSchedulePlanFeatureSnapshots(
        Array.isArray(snapshotRows) ? snapshotRows : [],
        schedule.pricing_schedule_key
      );

      if (hasSnapshotIntegrityIssues(snapshotInspection)) {
        return Response.json(
          {
            ok: false,
            error:
              "This pricing schedule has malformed or duplicate feature snapshots. No snapshot was changed.",
            malformed_snapshot_ids:
              snapshotInspection.malformedSnapshotIds,
            duplicate_snapshot_keys:
              snapshotInspection.duplicateSnapshotKeys,
            duplicate_plan_feature_pairs:
              snapshotInspection.duplicatePlanFeaturePairs,
            inconsistent_snapshot_keys:
              snapshotInspection.inconsistentSnapshotKeys,
          },
          { status: 409 }
        );
      }

      const snapshotRowsById =
        await base44.asServiceRole.entities.PlatformPricingSchedulePlanFeature.filter(
          {
            id: snapshotId,
            pricing_schedule_id: schedule.id,
          }
        );

      const snapshot = Array.isArray(snapshotRowsById)
        ? snapshotRowsById[0] || null
        : null;

      if (!snapshot) {
        return Response.json(
          {
            ok: false,
            error:
              "Pricing schedule feature snapshot was not found in this pricing schedule.",
          },
          { status: 404 }
        );
      }

      if (snapshot.is_active === false) {
        return Response.json({
          ok: true,
          action,
          already_archived: true,
          pricing_schedule_plan_feature_id: snapshot.id,
        });
      }

      await base44.asServiceRole.entities.PlatformPricingSchedulePlanFeature.update(
        snapshot.id,
        {
          is_active: false,
        }
      );

      await writeAuditLog(
        base44,
        user.id,
        "pricing_schedule_draft_plan_feature_snapshot_archived",
        "A feature and capacity snapshot was archived from an editable pricing schedule draft.",
        "PlatformPricingSchedulePlanFeature",
        snapshot.id,
        {
          pricing_schedule_id: schedule.id,
          pricing_schedule_plan_feature_key:
            snapshot.pricing_schedule_plan_feature_key,
        }
      );

      return Response.json({
        ok: true,
        action,
        already_archived: false,
        pricing_schedule_plan_feature_id: snapshot.id,
      });
    }

    // ── Lock and activate schedule for future new accounts only ────────────
    if (action === "activate_for_new_accounts") {
      const scheduleId = String(body?.pricing_schedule_id || "").trim();

      if (!scheduleId) {
        return Response.json(
          { ok: false, error: "pricing_schedule_id is required." },
          { status: 400 }
        );
      }

      const schedule = await getSchedule(base44, scheduleId);

      if (!schedule) {
        return Response.json(
          { ok: false, error: "Pricing schedule not found." },
          { status: 404 }
        );
      }

      if (schedule.schedule_status !== "draft" || schedule.locked_at) {
        return Response.json(
          {
            ok: false,
            error:
              "Only an unlocked draft schedule may be activated for new accounts.",
          },
          { status: 409 }
        );
      }

      const [itemRows, snapshotRows] = await Promise.all([
        base44.asServiceRole.entities.PlatformPricingScheduleItem.filter({
          pricing_schedule_id: schedule.id,
          is_active: true,
        }),
        base44.asServiceRole.entities.PlatformPricingSchedulePlanFeature.filter(
          {
            pricing_schedule_id: schedule.id,
          }
        ),
      ]);

      const activeItems = Array.isArray(itemRows) ? itemRows : [];
      const scheduleSnapshots = Array.isArray(snapshotRows)
        ? snapshotRows
        : [];
      const snapshotInspection = inspectSchedulePlanFeatureSnapshots(
        scheduleSnapshots,
        schedule.pricing_schedule_key
      );

      if (activeItems.length === 0) {
        return Response.json(
          {
            ok: false,
            error:
              "A pricing schedule needs at least one active pricing item before activation.",
          },
          { status: 409 }
        );
      }

      if (scheduleSnapshots.length === 0) {
        return Response.json(
          {
            ok: false,
            error:
              "A pricing schedule needs feature and capacity snapshots before activation.",
          },
          { status: 409 }
        );
      }

      if (hasSnapshotIntegrityIssues(snapshotInspection)) {
        return Response.json(
          {
            ok: false,
            error:
              "A pricing schedule with malformed or duplicate feature snapshots cannot be activated.",
            malformed_snapshot_ids:
              snapshotInspection.malformedSnapshotIds,
            duplicate_snapshot_keys:
              snapshotInspection.duplicateSnapshotKeys,
            duplicate_plan_feature_pairs:
              snapshotInspection.duplicatePlanFeaturePairs,
            inconsistent_snapshot_keys:
              snapshotInspection.inconsistentSnapshotKeys,
          },
          { status: 409 }
        );
      }

      const allScheduleRows =
        await base44.asServiceRole.entities.PlatformPricingSchedule.list();

      const currentDefaultSchedules = (
        Array.isArray(allScheduleRows) ? allScheduleRows : []
      ).filter(
        (row) =>
          row?.id !== schedule.id &&
          row?.is_default_for_new_accounts === true
      );

      for (const priorDefault of currentDefaultSchedules) {
        await base44.asServiceRole.entities.PlatformPricingSchedule.update(
          priorDefault.id,
          {
            is_default_for_new_accounts: false,
          }
        );
      }

      const now = new Date().toISOString();

      await base44.asServiceRole.entities.PlatformPricingSchedule.update(
        schedule.id,
        {
          schedule_status: "active",
          is_default_for_new_accounts: true,
          locked_at: now,
          locked_by_user_id: user.id,
        }
      );

      await writeAuditLog(
        base44,
        user.id,
        "pricing_schedule_activated_for_new_accounts",
        "A locked pricing schedule was activated as the default for future new accounts only.",
        "PlatformPricingSchedule",
        schedule.id,
        {
          pricing_schedule_key: schedule.pricing_schedule_key,
          active_pricing_item_count: activeItems.length,
          pricing_schedule_plan_feature_snapshot_count:
            scheduleSnapshots.length,
          prior_default_schedule_count: currentDefaultSchedules.length,
        }
      );

      return Response.json({
        ok: true,
        action,
        pricing_schedule_id: schedule.id,
        pricing_schedule_key: schedule.pricing_schedule_key,
        pricing_item_count: activeItems.length,
        pricing_schedule_plan_feature_snapshot_count:
          scheduleSnapshots.length,
      });
    }

    // ── Retire a schedule while preserving legacy customer assignments ─────
    if (action === "retire_schedule") {
      const scheduleId = String(body?.pricing_schedule_id || "").trim();

      if (!scheduleId) {
        return Response.json(
          { ok: false, error: "pricing_schedule_id is required." },
          { status: 400 }
        );
      }

      const schedule = await getSchedule(base44, scheduleId);

      if (!schedule) {
        return Response.json(
          { ok: false, error: "Pricing schedule not found." },
          { status: 404 }
        );
      }

      const now = new Date().toISOString();

      await base44.asServiceRole.entities.PlatformPricingSchedule.update(
        schedule.id,
        {
          schedule_status: "retired",
          is_default_for_new_accounts: false,
          retired_at: now,
        }
      );

      await writeAuditLog(
        base44,
        user.id,
        "pricing_schedule_retired",
        "A pricing schedule was retired for new assignments while preserving all existing legacy customer assignments.",
        "PlatformPricingSchedule",
        schedule.id,
        {
          pricing_schedule_key: schedule.pricing_schedule_key,
        }
      );

      return Response.json({
        ok: true,
        action,
        pricing_schedule_id: schedule.id,
        pricing_schedule_key: schedule.pricing_schedule_key,
      });
    }

    return Response.json(
      { ok: false, error: "Unsupported pricing-management action." },
      { status: 400 }
    );
  } catch (error) {
    console.error(
      "managePlatformPricingSchedule error:",
      error?.message || error
    );

    return Response.json(
      {
        ok: false,
        error:
          error?.message ||
          "Unable to manage the platform pricing schedule.",
      },
      { status: 500 }
    );
  }
});
