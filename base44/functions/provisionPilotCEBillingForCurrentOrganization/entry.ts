import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

const PILOT_PRICING_SCHEDULE_KEY = "pilot_ce_2026";
const TRAINER_BUSINESS_PLAN_KEY = "trainer_business_core_monthly";
const CE_STUDENT_REGISTRATION_RATE_KEY = "ce_student_registration";

function createHttpError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

function normalizeText(value: unknown) {
  return String(value || "").trim();
}

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
            "Only an active Platform Owner can provision pilot CE billing.",
        },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));

    const organizationId =
      normalizeText(body?.organization_id) ||
      normalizeText(caller.org_id);

    if (!organizationId) {
      throw createHttpError(
        400,
        "No organization ID was provided and your account is not connected to an organization."
      );
    }

    const organizationRows =
      await base44.asServiceRole.entities.Organization.filter({
        id: organizationId,
      });

    const organization = Array.isArray(organizationRows)
      ? organizationRows[0]
      : null;

    if (!organization) {
      throw createHttpError(
        404,
        "The selected organization could not be found."
      );
    }

    const [
      trainerPlanRows,
      registrationRateRows,
      currentSubscriptionRows,
      pilotScheduleRows,
    ] = await Promise.all([
      base44.asServiceRole.entities.PlatformPlan.filter({
        plan_key: TRAINER_BUSINESS_PLAN_KEY,
      }),
      base44.asServiceRole.entities.PlatformBillingRate.filter({
        rate_key: CE_STUDENT_REGISTRATION_RATE_KEY,
      }),
      base44.asServiceRole.entities.OrganizationPlanSubscription.filter({
        organization_id: organizationId,
      }),
      base44.asServiceRole.entities.PlatformPricingSchedule.filter({
        pricing_schedule_key: PILOT_PRICING_SCHEDULE_KEY,
      }),
    ]);

    const trainerPlans = (Array.isArray(trainerPlanRows)
      ? trainerPlanRows
      : []
    ).filter((plan) => plan?.is_active !== false);

    if (trainerPlans.length !== 1) {
      throw createHttpError(
        409,
        "The Trainer Business Account plan could not be resolved to exactly one active plan."
      );
    }

    const registrationRates = (Array.isArray(registrationRateRows)
      ? registrationRateRows
      : []
    ).filter(
      (rate) =>
        rate?.is_active !== false &&
        rate?.billing_subject_type === "student" &&
        rate?.charge_model === "one_time"
    );

    if (registrationRates.length !== 1) {
      throw createHttpError(
        409,
        "The CE student registration rate could not be resolved to exactly one active rate."
      );
    }

    const currentSubscriptions = (
      Array.isArray(currentSubscriptionRows)
        ? currentSubscriptionRows
        : []
    ).filter((subscription) => subscription?.is_current === true);

    if (currentSubscriptions.length > 1) {
      throw createHttpError(
        409,
        "This organization has multiple current subscription records. Resolve those records before provisioning pilot billing."
      );
    }

    if (currentSubscriptions.length === 1) {
      throw createHttpError(
        409,
        "This organization already has a current subscription record. Pilot billing will not overwrite or replace an existing pricing assignment."
      );
    }

    const now = new Date().toISOString();
    const trainerPlan = trainerPlans[0];
    const registrationRate = registrationRates[0];

    const pilotSchedules = Array.isArray(pilotScheduleRows)
      ? pilotScheduleRows
      : [];

    if (pilotSchedules.length > 1) {
      throw createHttpError(
        409,
        "Multiple Pilot CE 2026 pricing schedules exist. Resolve duplicate schedules before provisioning."
      );
    }

    let pricingSchedule = pilotSchedules[0] || null;
    let scheduleCreated = false;

    if (!pricingSchedule) {
      pricingSchedule =
        await base44.asServiceRole.entities.PlatformPricingSchedule.create({
          pricing_schedule_key: PILOT_PRICING_SCHEDULE_KEY,
          pricing_schedule_name: "Pilot CE Training Pricing 2026",
          description:
            "Locked pilot pricing schedule used only for CE Training registration events until public plan pricing is configured.",
          schedule_status: "active",
          is_default_for_new_accounts: false,
          currency: registrationRate.currency || "USD",
          effective_at: now,
          locked_at: now,
          locked_by_user_id: caller.id,
          notes:
            "Pilot-only schedule. Contains the CE student registration rate and does not create recurring plan charges.",
        });

      scheduleCreated = true;
    }

    if (
      pricingSchedule.schedule_status !== "active" ||
      !pricingSchedule.locked_at
    ) {
      throw createHttpError(
        409,
        "Pilot CE 2026 pricing schedule exists but is not an active locked schedule."
      );
    }

    const pricingItemRows =
      await base44.asServiceRole.entities.PlatformPricingScheduleItem.filter({
        pricing_schedule_id: pricingSchedule.id,
      });

    const matchingPricingItems = (
      Array.isArray(pricingItemRows) ? pricingItemRows : []
    ).filter(
      (item) =>
        item?.pricing_item_type === "billing_rate" &&
        item?.billing_rate_key_snapshot ===
          CE_STUDENT_REGISTRATION_RATE_KEY
    );

    if (matchingPricingItems.length > 1) {
      throw createHttpError(
        409,
        "Pilot CE 2026 pricing schedule contains multiple CE student registration price items."
      );
    }

    let pricingItem = matchingPricingItems[0] || null;
    let pricingItemCreated = false;

    if (!pricingItem) {
      pricingItem =
        await base44.asServiceRole.entities.PlatformPricingScheduleItem.create({
          pricing_schedule_id: pricingSchedule.id,
          pricing_item_key:
            `${PILOT_PRICING_SCHEDULE_KEY}:` +
            `${CE_STUDENT_REGISTRATION_RATE_KEY}:billing_rate`,
          pricing_item_type: "billing_rate",
          platform_billing_rate_id: registrationRate.id,
          billing_rate_key_snapshot:
            CE_STUDENT_REGISTRATION_RATE_KEY,
          feature_key:
            registrationRate.feature_key || "ce_training_portal",
          charge_model: "one_time",
          amount_cents: registrationRate.amount_cents,
          currency: registrationRate.currency || "USD",
          is_active: true,
          effective_at: now,
          notes:
            "Locked $49 CE student registration price for the pilot CE Training enrollment workflow.",
        });

      pricingItemCreated = true;
    }

    if (
      pricingItem.is_active === false ||
      pricingItem.charge_model !== "one_time" ||
      Number(pricingItem.amount_cents) !==
        Number(registrationRate.amount_cents)
    ) {
      throw createHttpError(
        409,
        "Pilot CE student registration pricing item is inactive or does not match the locked registration rate."
      );
    }

    const subscriptionKey =
      `pilot_ce_2026:${organizationId}:` +
      TRAINER_BUSINESS_PLAN_KEY;

    const subscription =
      await base44.asServiceRole.entities.OrganizationPlanSubscription.create({
        organization_id: organizationId,
        platform_plan_id: trainerPlan.id,
        pricing_schedule_id: pricingSchedule.id,
        pricing_schedule_key_snapshot:
          pricingSchedule.pricing_schedule_key,
        subscription_key: subscriptionKey,
        subscription_status: "active",
        billing_interval: "monthly",
        starts_at: now,
        is_current: true,
        subscription_source: "migration",
        notes:
          "Platform Owner-provisioned pilot Trainer Business subscription. No Stripe subscription or recurring charge is created by this record.",
      });

    try {
      await base44.asServiceRole.entities.PlatformAuditLog.create({
        platform_admin_user_id: caller.id,
        event_key: "pilot_ce_billing_provisioned",
        event_summary:
          "Pilot CE registration pricing and a current Trainer Business subscription were provisioned for one organization.",
        actor_type: "platform_admin",
        target_entity: "OrganizationPlanSubscription",
        target_record_id: subscription.id,
        tenant_visible: false,
        occurred_at: now,
        details: {
          organization_id: organizationId,
          pricing_schedule_id: pricingSchedule.id,
          pricing_schedule_key:
            pricingSchedule.pricing_schedule_key,
          pricing_item_id: pricingItem.id,
          pricing_item_key: pricingItem.pricing_item_key,
          organization_plan_subscription_id: subscription.id,
          amount_cents: pricingItem.amount_cents,
          currency: pricingItem.currency,
          schedule_created: scheduleCreated,
          pricing_item_created: pricingItemCreated,
        },
      });
    } catch (auditError) {
      console.error(
        "Pilot CE billing audit logging failed:",
        auditError?.message || auditError
      );
    }

    return Response.json({
      ok: true,
      organization_id: organizationId,
      organization_name: organization.name || null,
      pricing_schedule_id: pricingSchedule.id,
      pricing_schedule_key: pricingSchedule.pricing_schedule_key,
      pricing_schedule_created: scheduleCreated,
      pricing_item_id: pricingItem.id,
      pricing_item_key: pricingItem.pricing_item_key,
      pricing_item_created: pricingItemCreated,
      registration_amount_cents: pricingItem.amount_cents,
      registration_currency: pricingItem.currency,
      organization_plan_subscription_id: subscription.id,
      message:
        "Pilot CE billing was provisioned. No Stripe subscription, invoice, checkout session, or charge was created.",
    });
  } catch (error) {
    console.error(
      "provisionPilotCEBillingForCurrentOrganization error:",
      error?.message || error
    );

    return Response.json(
      {
        ok: false,
        error:
          error?.message ||
          "Unable to provision pilot CE billing.",
      },
      {
        status: Number(
          (error as Error & { status?: number })?.status
        ) || 500,
      }
    );
  }
});
