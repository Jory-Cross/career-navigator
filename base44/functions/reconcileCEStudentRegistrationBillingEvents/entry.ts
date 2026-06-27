import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

const ALLOWED_ROLES = new Set([
  "admin",
  "management",
  "ce_instructor",
]);

const OPEN_INVITE_STATUSES = new Set([
  "pending",
  "invite_email_sent",
  "pending_email_failed",
]);

const ACTIVE_SUBSCRIPTION_STATUSES = new Set([
  "active",
  "trialing",
]);

const CE_STUDENT_REGISTRATION_RATE_KEY =
  "ce_student_registration";

function createHttpError(status: number, message: string) {
  const error = new Error(message) as Error & {
    status?: number;
  };

  error.status = status;
  return error;
}

function normalizeText(value: unknown) {
  return String(value || "").trim();
}

function normalizeEmail(value: unknown) {
  return normalizeText(value).toLowerCase();
}

function buildRegistrationBillingEventKey(
  organizationId: string,
  email: string
) {
  return `ce_student_registration:${organizationId}:${encodeURIComponent(
    normalizeEmail(email)
  )}`;
}

function isPriceItemAvailableNow(item: any, nowMs: number) {
  if (item?.is_active === false) {
    return false;
  }

  const effectiveAtMs = Date.parse(
    String(item?.effective_at || "")
  );

  if (
    Number.isFinite(effectiveAtMs) &&
    effectiveAtMs > nowMs
  ) {
    return false;
  }

  const endsAtMs = Date.parse(String(item?.ends_at || ""));

  if (Number.isFinite(endsAtMs) && endsAtMs <= nowMs) {
    return false;
  }

  return true;
}

function getRecordTimestamp(record: any) {
  return new Date(
    record?.invited_at ||
      record?.triggered_at ||
      record?.created_date ||
      0
  ).getTime();
}

async function resolveCallerOrganization(
  base44: any,
  caller: any
) {
  const callerOrganizationId = normalizeText(caller?.org_id);

  if (callerOrganizationId) {
    const directRows =
      await base44.asServiceRole.entities.Organization.filter({
        id: callerOrganizationId,
      });

    const directOrganizations = Array.isArray(directRows)
      ? directRows
      : [];

    if (directOrganizations.length === 1) {
      return directOrganizations[0];
    }
  }

  const ownerRows =
    await base44.asServiceRole.entities.Organization.filter({
      owner_email: caller.email,
    });

  const ownerOrganizations = Array.isArray(ownerRows)
    ? ownerRows
    : [];

  if (ownerOrganizations.length === 1) {
    return ownerOrganizations[0];
  }

  if (ownerOrganizations.length > 1) {
    throw createHttpError(
      409,
      "Your account is connected to multiple owner organizations. Organization resolution must be corrected before billing reconciliation can run."
    );
  }

  throw createHttpError(
    400,
    "Your account is not connected to a canonical organization record."
  );
}

async function getLockedRegistrationPricing(
  base44: any,
  organizationId: string
) {
  const subscriptionRows =
    await base44.asServiceRole.entities.OrganizationPlanSubscription.filter({
      organization_id: organizationId,
    });

  const currentSubscriptions = (
    Array.isArray(subscriptionRows) ? subscriptionRows : []
  ).filter(
    (subscription) =>
      subscription?.is_current === true &&
      ACTIVE_SUBSCRIPTION_STATUSES.has(
        subscription?.subscription_status
      )
  );

  if (currentSubscriptions.length === 0) {
    throw createHttpError(
      409,
      "This organization has no current active pricing subscription. Missing CE registration billing events cannot be created."
    );
  }

  if (currentSubscriptions.length > 1) {
    throw createHttpError(
      409,
      "This organization has multiple current active pricing subscriptions. Resolve those subscription records before billing reconciliation."
    );
  }

  const subscription = currentSubscriptions[0];
  const pricingScheduleId = normalizeText(
    subscription?.pricing_schedule_id
  );

  if (!pricingScheduleId) {
    throw createHttpError(
      409,
      "The organization's current pricing subscription is missing its locked pricing schedule."
    );
  }

  const scheduleRows =
    await base44.asServiceRole.entities.PlatformPricingSchedule.filter({
      id: pricingScheduleId,
    });

  const schedules = Array.isArray(scheduleRows)
    ? scheduleRows
    : [];

  if (schedules.length !== 1) {
    throw createHttpError(
      409,
      "The organization's locked pricing schedule could not be resolved."
    );
  }

  const pricingSchedule = schedules[0];

  if (pricingSchedule.schedule_status === "draft") {
    throw createHttpError(
      409,
      "The organization's locked pricing schedule is still a draft and cannot be used for billing reconciliation."
    );
  }

  const [rateRows, scheduleItemRows] = await Promise.all([
    base44.asServiceRole.entities.PlatformBillingRate.filter({
      rate_key: CE_STUDENT_REGISTRATION_RATE_KEY,
    }),
    base44.asServiceRole.entities.PlatformPricingScheduleItem.filter({
      pricing_schedule_id: pricingSchedule.id,
    }),
  ]);

  const matchingRates = (
    Array.isArray(rateRows) ? rateRows : []
  ).filter(
    (rate) =>
      rate?.rate_key === CE_STUDENT_REGISTRATION_RATE_KEY &&
      rate?.billing_subject_type === "student" &&
      rate?.charge_model === "one_time"
  );

  if (matchingRates.length !== 1) {
    throw createHttpError(
      409,
      "The CE student registration billing rate could not be resolved to exactly one record."
    );
  }

  const billingRate = matchingRates[0];
  const nowMs = Date.now();

  const matchingScheduleItems = (
    Array.isArray(scheduleItemRows) ? scheduleItemRows : []
  ).filter((item) => {
    const matchesRateKey =
      normalizeText(item?.billing_rate_key_snapshot) ===
      CE_STUDENT_REGISTRATION_RATE_KEY;

    const matchesRateId =
      normalizeText(item?.platform_billing_rate_id) ===
      normalizeText(billingRate.id);

    return (
      item?.pricing_item_type === "billing_rate" &&
      item?.charge_model === "one_time" &&
      (matchesRateKey || matchesRateId) &&
      isPriceItemAvailableNow(item, nowMs)
    );
  });

  if (matchingScheduleItems.length === 0) {
    throw createHttpError(
      409,
      "The organization's locked pricing schedule does not contain an active CE student registration price item."
    );
  }

  if (matchingScheduleItems.length > 1) {
    throw createHttpError(
      409,
      "The organization's locked pricing schedule contains multiple active CE student registration price items. Resolve duplicates before billing reconciliation."
    );
  }

  const pricingItem = matchingScheduleItems[0];
  const unitAmountCents = Number(pricingItem.amount_cents);

  if (
    !Number.isInteger(unitAmountCents) ||
    unitAmountCents < 0
  ) {
    throw createHttpError(
      409,
      "The locked CE student registration price item has an invalid amount."
    );
  }

  const currency = normalizeText(
    pricingItem.currency ||
      pricingSchedule.currency ||
      billingRate.currency ||
      "USD"
  ).toUpperCase();

  if (!currency) {
    throw createHttpError(
      409,
      "The locked CE student registration price item is missing a currency."
    );
  }

  return {
    subscription,
    pricingSchedule,
    pricingItem,
    billingRate,
    unitAmountCents,
    currency,
  };
}

function classifyExistingBillingEvents(
  billingEvents: any[],
  organizationId: string,
  email: string
) {
  if (billingEvents.length === 0) {
    return {
      status: "missing",
      billingEvent: null,
      reason: "",
    };
  }

  if (billingEvents.length > 1) {
    return {
      status: "conflict",
      billingEvent: null,
      reason:
        "Multiple billing events use this deterministic registration key.",
    };
  }

  const billingEvent = billingEvents[0];

  const valid =
    normalizeText(billingEvent?.organization_id) ===
      organizationId &&
    normalizeEmail(billingEvent?.subject_verified_email) ===
      normalizeEmail(email) &&
    billingEvent?.fee_kind === "training_registration" &&
    billingEvent?.billing_subject_type === "student";

  if (!valid) {
    return {
      status: "conflict",
      billingEvent: null,
      reason:
        "The existing billing event does not match the organization, student email, or CE registration event type.",
    };
  }

  return {
    status: "already_present",
    billingEvent,
    reason: "",
  };
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

    if (!ALLOWED_ROLES.has(caller.role)) {
      return Response.json(
        {
          ok: false,
          error:
            "Only authorized CE organization users can reconcile CE registration billing events.",
        },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const apply = body?.apply === true;

    const organization = await resolveCallerOrganization(
      base44,
      caller
    );

    const organizationId = normalizeText(organization.id);

    const [inviteRows, billingEventRows] = await Promise.all([
      base44.asServiceRole.entities.PendingRoleAssignment.filter({
        org_id: organizationId,
        role: "ce_student",
      }),
      base44.asServiceRole.entities.OrganizationBillingEvent.filter({
        organization_id: organizationId,
      }),
    ]);

    const openInvites = (
      Array.isArray(inviteRows) ? inviteRows : []
    )
      .filter((invite) =>
        OPEN_INVITE_STATUSES.has(invite?.status)
      )
      .sort(
        (a, b) =>
          getRecordTimestamp(a) - getRecordTimestamp(b)
      );

    const allBillingEvents = Array.isArray(billingEventRows)
      ? billingEventRows
      : [];

    const registrationBillingEvents = allBillingEvents.filter(
      (event) =>
        event?.fee_kind === "training_registration" &&
        event?.billing_subject_type === "student"
    );

    const billingEventsByKey = new Map<string, any[]>();

    for (const event of registrationBillingEvents) {
      const eventKey = normalizeText(event?.billing_event_key);

      if (!eventKey) {
        continue;
      }

      if (!billingEventsByKey.has(eventKey)) {
        billingEventsByKey.set(eventKey, []);
      }

      billingEventsByKey.get(eventKey)?.push(event);
    }

    const invitesByBillingKey = new Map<string, any[]>();

    for (const invite of openInvites) {
      const email = normalizeEmail(invite?.email);

      if (!email) {
        continue;
      }

      const billingEventKey = buildRegistrationBillingEventKey(
        organizationId,
        email
      );

      if (!invitesByBillingKey.has(billingEventKey)) {
        invitesByBillingKey.set(billingEventKey, []);
      }

      invitesByBillingKey.get(billingEventKey)?.push(invite);
    }

    const candidateRows: any[] = [];

    for (const [billingEventKey, groupedInvites] of invitesByBillingKey) {
      const representativeInvite = groupedInvites[0];
      const email = normalizeEmail(representativeInvite?.email);
      const matchingBillingEvents =
        billingEventsByKey.get(billingEventKey) || [];

      if (groupedInvites.length > 1) {
        candidateRows.push({
          pending_invite_id: representativeInvite.id,
          email,
          billing_event_key: billingEventKey,
          action: "skipped",
          reason:
            "Multiple open CE student invitations exist for this organization and email. No billing event was created.",
          duplicate_open_invite_count: groupedInvites.length,
        });
        continue;
      }

      const existing = classifyExistingBillingEvents(
        matchingBillingEvents,
        organizationId,
        email
      );

      if (existing.status === "already_present") {
        candidateRows.push({
          pending_invite_id: representativeInvite.id,
          email,
          billing_event_key: billingEventKey,
          action: "already_present",
          billing_event_id: existing.billingEvent.id,
          billing_event_status:
            existing.billingEvent.event_status || null,
          amount_cents:
            existing.billingEvent.amount_cents ?? null,
          currency: existing.billingEvent.currency || null,
        });
        continue;
      }

      if (existing.status === "conflict") {
        candidateRows.push({
          pending_invite_id: representativeInvite.id,
          email,
          billing_event_key: billingEventKey,
          action: "skipped",
          reason: existing.reason,
        });
        continue;
      }

      candidateRows.push({
        pending_invite_id: representativeInvite.id,
        email,
        billing_event_key: billingEventKey,
        action: "create",
        cohort_id: normalizeText(representativeInvite?.cohort_id) || null,
        payment_responsibility:
          representativeInvite?.payment_responsibility ||
          "student_paid",
        instructor_payment_mode:
          representativeInvite?.payment_responsibility ===
          "instructor_paid"
            ? representativeInvite?.instructor_payment_mode ||
              "pay_now"
            : null,
      });
    }

    const missingRows = candidateRows.filter(
      (row) => row.action === "create"
    );

    let lockedPricing: any = null;

    if (missingRows.length > 0) {
      lockedPricing = await getLockedRegistrationPricing(
        base44,
        organizationId
      );
    }

    if (!apply) {
      return Response.json({
        ok: true,
        mode: "preview",
        organization_id: organizationId,
        organization_name: organization.name || "",
        open_ce_student_invite_count: openInvites.length,
        billing_events_already_present: candidateRows.filter(
          (row) => row.action === "already_present"
        ).length,
        billing_events_ready_to_create: missingRows.length,
        skipped_or_conflicted: candidateRows.filter(
          (row) => row.action === "skipped"
        ).length,
        locked_registration_price:
          lockedPricing
            ? {
                amount_cents: lockedPricing.unitAmountCents,
                currency: lockedPricing.currency,
                pricing_schedule_id:
                  lockedPricing.pricingSchedule.id,
                pricing_schedule_key:
                  lockedPricing.pricingSchedule
                    .pricing_schedule_key,
                pricing_item_id: lockedPricing.pricingItem.id,
                pricing_item_key:
                  lockedPricing.pricingItem.pricing_item_key,
              }
            : null,
        results: candidateRows,
        message:
          "Preview only. No billing events, invoices, checkout sessions, charges, access changes, or emails were created.",
      });
    }

    const appliedResults: any[] = [];

    for (const row of candidateRows) {
      if (row.action !== "create") {
        appliedResults.push(row);
        continue;
      }

      try {
        const recheckRows =
          await base44.asServiceRole.entities.OrganizationBillingEvent.filter(
            {
              billing_event_key: row.billing_event_key,
            }
          );

        const recheckEvents = Array.isArray(recheckRows)
          ? recheckRows
          : [];

        const recheck = classifyExistingBillingEvents(
          recheckEvents,
          organizationId,
          row.email
        );

        if (recheck.status === "already_present") {
          appliedResults.push({
            ...row,
            action: "already_present",
            billing_event_id: recheck.billingEvent.id,
            billing_event_status:
              recheck.billingEvent.event_status || null,
            amount_cents:
              recheck.billingEvent.amount_cents ?? null,
            currency: recheck.billingEvent.currency || null,
            reason:
              "A billing event was already present when this reconciliation item was applied.",
          });
          continue;
        }

        if (recheck.status === "conflict") {
          appliedResults.push({
            ...row,
            action: "skipped",
            reason: recheck.reason,
          });
          continue;
        }

        const now = new Date().toISOString();

        const createdEvent =
          await base44.asServiceRole.entities.OrganizationBillingEvent.create(
            {
              organization_id: organizationId,
              billing_event_key: row.billing_event_key,
              fee_kind: "training_registration",
              event_status: "pending",
              billing_subject_type: "student",
              subject_verified_email: row.email,
              ...(row.cohort_id
                ? { cohort_id: row.cohort_id }
                : {}),
              organization_plan_subscription_id:
                lockedPricing.subscription.id,
              pricing_schedule_id:
                lockedPricing.pricingSchedule.id,
              pricing_schedule_key_snapshot:
                lockedPricing.pricingSchedule
                  .pricing_schedule_key,
              pricing_schedule_item_id:
                lockedPricing.pricingItem.id,
              pricing_item_key_snapshot:
                lockedPricing.pricingItem.pricing_item_key,
              feature_key:
                lockedPricing.pricingItem.feature_key ||
                lockedPricing.billingRate.feature_key ||
                "ce_training_portal",
              quantity: 1,
              unit_amount_cents:
                lockedPricing.unitAmountCents,
              amount_cents: lockedPricing.unitAmountCents,
              currency: lockedPricing.currency,
              triggered_at: now,
              notes:
                "Backfilled CE student registration billing event for a pending invitation created before CE registration billing was enabled. Payment responsibility remains controlled by the related PendingRoleAssignment.",
            }
          );

        appliedResults.push({
          ...row,
          action: "created",
          billing_event_id: createdEvent.id,
          billing_event_status: createdEvent.event_status,
          amount_cents: createdEvent.amount_cents,
          currency: createdEvent.currency,
        });
      } catch (itemError) {
        appliedResults.push({
          ...row,
          action: "error",
          reason:
            itemError?.message ||
            "Unable to create this missing billing event.",
        });
      }
    }

    return Response.json({
      ok: true,
      mode: "apply",
      organization_id: organizationId,
      organization_name: organization.name || "",
      created_count: appliedResults.filter(
        (row) => row.action === "created"
      ).length,
      already_present_count: appliedResults.filter(
        (row) => row.action === "already_present"
      ).length,
      skipped_or_conflicted_count: appliedResults.filter(
        (row) => row.action === "skipped"
      ).length,
      error_count: appliedResults.filter(
        (row) => row.action === "error"
      ).length,
      results: appliedResults,
      message:
        "Reconciliation completed. No invoices, checkout sessions, payment charges, access changes, cohort assignments, or emails were created.",
    });
  } catch (error) {
    console.error(
      "reconcileCEStudentRegistrationBillingEvents error:",
      error?.message || error
    );

    return Response.json(
      {
        ok: false,
        error:
          error?.message ||
          "Unable to reconcile CE student registration billing events.",
      },
      {
        status: Number(
          (error as Error & { status?: number })?.status
        ) || 500,
      }
    );
  }
});
