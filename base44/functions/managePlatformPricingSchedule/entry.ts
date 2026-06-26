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

      const sourceItemRows =
        await base44.asServiceRole.entities.PlatformPricingScheduleItem.filter(
          {
            pricing_schedule_id: sourceSchedule.id,
          }
        );

      const sourceItems = Array.isArray(sourceItemRows)
        ? sourceItemRows
        : [];

      let copiedItemCount = 0;

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
        }
      );

      return Response.json({
        ok: true,
        action,
        pricing_schedule: newSchedule,
        copied_item_count: copiedItemCount,
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

      const itemRows =
        await base44.asServiceRole.entities.PlatformPricingScheduleItem.filter(
          {
            pricing_schedule_id: schedule.id,
            is_active: true,
          }
        );

      const activeItems = Array.isArray(itemRows) ? itemRows : [];

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
          prior_default_schedule_count: currentDefaultSchedules.length,
        }
      );

      return Response.json({
        ok: true,
        action,
        pricing_schedule_id: schedule.id,
        pricing_schedule_key: schedule.pricing_schedule_key,
        pricing_item_count: activeItems.length,
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
