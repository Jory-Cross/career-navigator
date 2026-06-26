import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

const CE_TRAINING_REGISTRATION_RATES = [
  {
    rate_key: "ce_trainer_registration",
    rate_name: "CE Trainer Registration",
    description:
      "One-time registration fee when a new CE trainer account is first activated.",
    charge_model: "one_time",
    billing_subject_type: "trainer",
    feature_key: "ce_training_portal",
    amount_cents: 4900,
    currency: "USD",
  },
  {
    rate_key: "ce_trainer_reactivation",
    rate_name: "CE Trainer Reactivation",
    description:
      "One-time reactivation fee when an archived CE trainer account is activated again.",
    charge_model: "one_time",
    billing_subject_type: "trainer",
    feature_key: "ce_training_portal",
    amount_cents: 4900,
    currency: "USD",
  },
  {
    rate_key: "ce_student_registration",
    rate_name: "CE Student Registration",
    description:
      "One-time registration fee when a new CE student account is first activated.",
    charge_model: "one_time",
    billing_subject_type: "student",
    feature_key: "ce_training_portal",
    amount_cents: 4900,
    currency: "USD",
  },
  {
    rate_key: "ce_student_reactivation",
    rate_name: "CE Student Reactivation",
    description:
      "One-time reactivation fee when an archived CE student account is activated again.",
    charge_model: "one_time",
    billing_subject_type: "student",
    feature_key: "ce_training_portal",
    amount_cents: 4900,
    currency: "USD",
  },
];

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
            "Only an active Platform Owner can seed CE training billing rates.",
        },
        { status: 403 }
      );
    }

    const existingRows =
      await base44.asServiceRole.entities.PlatformBillingRate.list();

    const existingByKey = new Map(
      (Array.isArray(existingRows) ? existingRows : [])
        .filter((row) => row?.rate_key)
        .map((row) => [row.rate_key, row])
    );

    const createdRateKeys: string[] = [];
    const existingRateKeys: string[] = [];
    const effectiveAt = new Date().toISOString();

    for (const rate of CE_TRAINING_REGISTRATION_RATES) {
      if (existingByKey.has(rate.rate_key)) {
        existingRateKeys.push(rate.rate_key);
        continue;
      }

      await base44.asServiceRole.entities.PlatformBillingRate.create({
        ...rate,
        effective_at: effectiveAt,
        is_active: true,
      });

      createdRateKeys.push(rate.rate_key);
    }

    const now = new Date().toISOString();

    await base44.asServiceRole.entities.PlatformAuditLog.create({
      platform_admin_user_id: user.id,
      event_key: "ce_training_registration_rates_seeded",
      event_summary:
        "The confirmed $49 CE trainer and student registration and reactivation billing rates were added to the platform billing catalog.",
      actor_type: "platform_admin",
      target_entity: "PlatformBillingRate",
      tenant_visible: false,
      occurred_at: now,
      details: {
        created_rate_keys: createdRateKeys,
        existing_rate_keys: existingRateKeys,
        amount_cents: 4900,
      },
    });

    return Response.json({
      ok: true,
      created_count: createdRateKeys.length,
      existing_count: existingRateKeys.length,
      message:
        "CE training registration rates were seeded. No charges or billing events were created.",
    });
  } catch (error) {
    console.error(
      "seedCeTrainingRegistrationRates error:",
      error?.message || error
    );

    return Response.json(
      {
        ok: false,
        error:
          error?.message ||
          "Unable to seed CE training registration rates.",
      },
      { status: 500 }
    );
  }
});
