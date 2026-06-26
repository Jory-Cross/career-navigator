import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  FileText,
  Loader2,
  LockKeyhole,
  Package,
  RefreshCw,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";

function formatMoney(amountCents, currency = "USD") {
  if (typeof amountCents !== "number") {
    return "—";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
  }).format(amountCents / 100);
}

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getScheduleStatusClass(status) {
  if (status === "active") {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }

  if (status === "draft") {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }

  if (status === "retired") {
    return "bg-slate-100 text-slate-600 border-slate-200";
  }

  return "bg-slate-100 text-slate-600 border-slate-200";
}

function getPricingItemTypeLabel(itemType) {
  const labels = {
    plan_monthly: "Plan monthly",
    plan_activation: "Plan activation",
    billing_rate: "Billing rate",
    add_on_monthly: "Add-on monthly",
    add_on_activation: "Add-on activation",
    manual_adjustment: "Manual adjustment",
  };

  return labels[itemType] || itemType || "Unknown";
}

function getChargeModelLabel(chargeModel) {
  const labels = {
    one_time: "One time",
    monthly_flat: "Monthly flat",
    monthly_per_active_unit: "Monthly per active unit",
    usage_based: "Usage based",
  };

  return labels[chargeModel] || chargeModel || "Unknown";
}

function StatCard({ icon: Icon, label, value, detail }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {label}
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
          {detail ? (
            <p className="mt-1 text-xs text-slate-500">{detail}</p>
          ) : null}
        </div>
        <div className="rounded-lg bg-slate-100 p-2">
          <Icon className="h-4 w-4 text-slate-600" />
        </div>
      </div>
    </div>
  );
}

export default function PlatformPricingManager() {
  const [data, setData] = useState(null);
  const [selectedScheduleId, setSelectedScheduleId] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const schedules = data?.schedules || [];
  const pricingScheduleItems = data?.pricing_schedule_items || [];
  const plans = data?.plans || [];
  const features = data?.features || [];
  const billingRateTemplates = data?.billing_rate_templates || [];

  const planNameById = useMemo(() => {
    return new Map(plans.map((plan) => [plan.id, plan.plan_name]));
  }, [plans]);

  const selectedSchedule = useMemo(() => {
    return (
      schedules.find((schedule) => schedule.id === selectedScheduleId) ||
      schedules[0] ||
      null
    );
  }, [schedules, selectedScheduleId]);

  const selectedScheduleItems = useMemo(() => {
    if (!selectedSchedule?.id) {
      return [];
    }

    return pricingScheduleItems.filter(
      (item) => item.pricing_schedule_id === selectedSchedule.id
    );
  }, [pricingScheduleItems, selectedSchedule]);

  const activeScheduleCount = schedules.filter(
    (schedule) => schedule.schedule_status === "active"
  ).length;

  const draftScheduleCount = schedules.filter(
    (schedule) => schedule.schedule_status === "draft"
  ).length;

  const activePlanCount = plans.filter((plan) => plan.is_active).length;

  async function loadPricingManagerData({ showRefreshToast = false } = {}) {
    setError("");

    if (showRefreshToast) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const result = await base44.functions.invoke(
        "getPlatformPricingManagerData",
        {}
      );

      const payload = result?.data || result;

      if (!payload?.ok) {
        throw new Error(
          payload?.error || "Unable to load platform pricing administration."
        );
      }

      setData(payload);

      setSelectedScheduleId((currentScheduleId) => {
        const scheduleStillExists = payload.schedules?.some(
          (schedule) => schedule.id === currentScheduleId
        );

        if (scheduleStillExists) {
          return currentScheduleId;
        }

        return payload.schedules?.[0]?.id || "";
      });

      if (showRefreshToast) {
        toast.success("Pricing administration refreshed");
      }
    } catch (loadError) {
      const message =
        loadError?.message || "Unable to load platform pricing administration.";

      setError(message);
      setData(null);

      if (showRefreshToast) {
        toast.error(message);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadPricingManagerData();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[360px] items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading platform pricing administration...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl space-y-5">
        <div className="rounded-xl border border-red-200 bg-red-50 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            <div>
              <h1 className="text-lg font-semibold text-red-900">
                Platform Pricing Manager Unavailable
              </h1>
              <p className="mt-1 text-sm text-red-700">{error}</p>
              <p className="mt-2 text-sm text-red-700">
                This page is restricted to active Platform Owner and Platform
                Billing users.
              </p>
            </div>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={() => loadPricingManagerData({ showRefreshToast: true })}
          disabled={refreshing}
          className="gap-2"
        >
          {refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl space-y-6 pb-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-indigo-600" />
            <h1 className="text-xl font-bold text-slate-900">
              Platform Pricing Manager
            </h1>
          </div>

          <p className="mt-1 text-sm text-slate-500">
            Internal pricing administration for schedules, price items, plan
            catalog, features, and billing-rate templates.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={() => loadPricingManagerData({ showRefreshToast: true })}
          disabled={refreshing}
          className="gap-2"
        >
          {refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Refresh
        </Button>
      </div>

      <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
        <div className="flex items-start gap-2">
          <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-indigo-700" />
          <div className="text-sm text-indigo-800">
            <span className="font-semibold">Read-only view.</span> This page
            does not activate schedules, assign organizations, alter
            subscriptions, create invoices, or change customer access. Existing
            organizations remain pinned to their assigned pricing schedule.
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={CreditCard}
          label="Pricing Schedules"
          value={schedules.length}
          detail={`${activeScheduleCount} active · ${draftScheduleCount} draft`}
        />
        <StatCard
          icon={FileText}
          label="Schedule Price Items"
          value={pricingScheduleItems.length}
          detail="Across all pricing schedules"
        />
        <StatCard
          icon={Package}
          label="Active Plans"
          value={activePlanCount}
          detail={`${plans.length} total catalog plans`}
        />
        <StatCard
          icon={Users}
          label="Assigned Organizations"
          value={schedules.reduce(
            (total, schedule) =>
              total + (schedule.active_organization_count || 0),
            0
          )}
          detail="Active pricing-schedule assignments"
        />
      </div>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            Pricing Schedules
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Select a schedule to review its exact pricing items and assignment
            exposure.
          </p>
        </div>

        {schedules.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-500">
            No pricing schedules are available.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {schedules.map((schedule) => {
              const isSelected = selectedSchedule?.id === schedule.id;

              return (
                <button
                  key={schedule.id}
                  type="button"
                  onClick={() => setSelectedScheduleId(schedule.id)}
                  className={`w-full px-5 py-4 text-left transition-colors ${
                    isSelected
                      ? "bg-indigo-50"
                      : "bg-white hover:bg-slate-50"
                  }`}
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-slate-900">
                          {schedule.pricing_schedule_name}
                        </p>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-xs font-medium ${getScheduleStatusClass(
                            schedule.schedule_status
                          )}`}
                        >
                          {schedule.schedule_status || "unknown"}
                        </span>
                        {schedule.is_default_for_new_accounts ? (
                          <span className="rounded-full border border-indigo-200 bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                            Default for new accounts
                          </span>
                        ) : null}
                        {schedule.locked_at ? (
                          <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                            Locked
                          </span>
                        ) : null}
                      </div>

                      <p className="mt-1 font-mono text-xs text-slate-500">
                        {schedule.pricing_schedule_key}
                      </p>

                      {schedule.description ? (
                        <p className="mt-2 text-sm text-slate-600">
                          {schedule.description}
                        </p>
                      ) : null}
                    </div>

                    <div className="grid grid-cols-3 gap-x-6 gap-y-2 text-sm text-slate-600">
                      <div>
                        <p className="text-xs text-slate-400">Price items</p>
                        <p className="font-medium text-slate-800">
                          {schedule.pricing_item_count}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Organizations</p>
                        <p className="font-medium text-slate-800">
                          {schedule.active_organization_count}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Effective</p>
                        <p className="font-medium text-slate-800">
                          {formatDate(schedule.effective_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {selectedSchedule ? (
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                {selectedSchedule.pricing_schedule_name}
              </h2>
              <p className="mt-1 font-mono text-xs text-slate-500">
                {selectedSchedule.pricing_schedule_key}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <span
                className={`rounded-full border px-2 py-1 text-xs font-medium ${getScheduleStatusClass(
                  selectedSchedule.schedule_status
                )}`}
              >
                {selectedSchedule.schedule_status || "unknown"}
              </span>

              {selectedSchedule.locked_at ? (
                <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                  Locked {formatDate(selectedSchedule.locked_at)}
                </span>
              ) : (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                  Editable draft
                </span>
              )}
            </div>
          </div>

          <div className="grid gap-4 border-b border-slate-100 px-5 py-4 md:grid-cols-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Active organization assignments
              </p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {selectedSchedule.active_organization_count}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Schedule price items
              </p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {selectedSchedule.pricing_item_count}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Currency
              </p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {selectedSchedule.currency || "USD"}
              </p>
            </div>
          </div>

          {selectedSchedule.notes ? (
            <div className="border-b border-slate-100 px-5 py-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Internal Notes
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
                {selectedSchedule.notes}
              </p>
            </div>
          ) : null}

          <div className="px-5 py-4">
            <div className="mb-3 flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-slate-600" />
              <h3 className="text-sm font-semibold text-slate-900">
                Schedule Price Items
              </h3>
            </div>

            {selectedScheduleItems.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                No pricing items have been added to this schedule. This is
                expected for the current draft while pricing decisions remain
                open.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Item</th>
                      <th className="px-4 py-3">Reference</th>
                      <th className="px-4 py-3">Charge Model</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {selectedScheduleItems.map((item) => {
                      const reference =
                        planNameById.get(item.platform_plan_id) ||
                        item.plan_key_snapshot ||
                        item.billing_rate_key_snapshot ||
                        item.feature_key ||
                        "Manual adjustment";

                      return (
                        <tr key={item.id}>
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-800">
                              {getPricingItemTypeLabel(item.pricing_item_type)}
                            </p>
                            <p className="mt-0.5 font-mono text-xs text-slate-400">
                              {item.pricing_item_key}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {reference}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {getChargeModelLabel(item.charge_model)}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-slate-800">
                            {formatMoney(item.amount_cents, item.currency)}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                item.is_active
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {item.is_active ? "Active" : "Archived"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-900">
              Plan Catalog
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Global plan templates. These do not overwrite locked schedule
              snapshots for customers.
            </p>
          </div>

          <div className="max-h-[420px] overflow-y-auto divide-y divide-slate-100">
            {plans.map((plan) => (
              <div key={plan.id} className="px-5 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {plan.plan_name}
                    </p>
                    <p className="mt-0.5 font-mono text-xs text-slate-400">
                      {plan.plan_key}
                    </p>
                  </div>

                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      plan.is_active
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {plan.is_active ? "Active" : "Inactive"}
                  </span>
                </div>

                <p className="mt-2 text-xs text-slate-500">
                  {plan.account_model || "—"} · {plan.plan_tier || "—"} ·{" "}
                  {plan.navigation_scope || "—"} ·{" "}
                  {plan.billing_interval || "—"}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-900">
              Billing-Rate Templates
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Catalog templates only. Schedule-specific price items become the
              locked billing source after future provisioning.
            </p>
          </div>

          {billingRateTemplates.length === 0 ? (
            <div className="px-5 py-8 text-sm text-slate-500">
              No billing-rate templates are available.
            </div>
          ) : (
            <div className="max-h-[420px] overflow-y-auto divide-y divide-slate-100">
              {billingRateTemplates.map((rate) => (
                <div key={rate.id} className="px-5 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-800">
                        {rate.rate_name}
                      </p>
                      <p className="mt-0.5 font-mono text-xs text-slate-400">
                        {rate.rate_key}
                      </p>
                    </div>

                    <p className="text-sm font-semibold text-slate-800">
                      {formatMoney(
                        rate.catalog_amount_cents,
                        rate.currency
                      )}
                    </p>
                  </div>

                  <p className="mt-2 text-xs text-slate-500">
                    {getChargeModelLabel(rate.charge_model)} ·{" "}
                    {rate.billing_subject_type || "—"}
                    {rate.feature_key ? ` · ${rate.feature_key}` : ""}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            Feature Catalog
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            The available platform feature definitions used by plans and future
            schedule-specific feature snapshots.
          </p>
        </div>

        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.id}
              className="rounded-lg border border-slate-200 bg-slate-50 p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-slate-800">
                  {feature.feature_name}
                </p>

                {feature.is_billable_add_on ? (
                  <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                    Add-on
                  </span>
                ) : null}
              </div>

              <p className="mt-1 font-mono text-xs text-slate-400">
                {feature.feature_key}
              </p>

              <p className="mt-2 text-xs text-slate-500">
                {feature.feature_category || "Uncategorized"}
                {feature.supports_limit
                  ? ` · Limit: ${feature.limit_label || "supported"}`
                  : ""}
              </p>
            </div>
          ))}
        </div>
      </section>

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
        <div className="flex items-start gap-2">
          <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <p className="text-sm text-amber-800">
            <span className="font-semibold">Current draft safety:</span>{" "}
            schedule feature/capacity snapshots exist separately from the
            global plan catalog. This read-only page will show schedule pricing
            items once you decide plan and add-on amounts. No activation should
            occur until the full price book and provisioning workflow are
            complete.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-slate-400">
        <CheckCircle2 className="h-4 w-4" />
        Viewer role verified by the server:
        {" "}
        {(data?.viewer?.platform_roles || []).join(", ") || "none"}
      </div>
    </div>
  );
}
