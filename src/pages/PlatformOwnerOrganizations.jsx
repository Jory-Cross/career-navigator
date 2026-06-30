import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertTriangle,
  Building2,
  RefreshCw,
  Search,
  ShieldAlert,
  Users,
} from "lucide-react";

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value || 0);
}

function MetricCard({ label, value, description }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-3xl font-bold text-slate-900">
        {formatNumber(value)}
      </p>
      <p className="mt-1 text-xs text-slate-500">{description}</p>
    </div>
  );
}

function HealthRow({ label, value, severity = "warning" }) {
  const isHealthy = value === 0;

  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 py-3 last:border-b-0">
      <div className="flex items-center gap-2 text-sm text-slate-700">
        {isHealthy ? (
          <div className="h-2 w-2 rounded-full bg-emerald-500" />
        ) : (
          <AlertTriangle
            className={
              severity === "critical"
                ? "h-4 w-4 text-red-500"
                : "h-4 w-4 text-amber-500"
            }
          />
        )}
        <span>{label}</span>
      </div>

      <span
        className={
          isHealthy
            ? "text-sm font-semibold text-emerald-700"
            : severity === "critical"
              ? "text-sm font-semibold text-red-700"
              : "text-sm font-semibold text-amber-700"
        }
      >
        {formatNumber(value)}
      </span>
    </div>
  );
}

export default function PlatformOwnerOrganizations() {
  const [search, setSearch] = useState("");

  const {
    data,
    error,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["platform-organization-directory"],
    queryFn: async () => {
      const result = await base44.functions.invoke(
        "getPlatformOrganizationDirectory",
        {}
      );

      return result?.data;
    },
  });

  const organizations = data?.organizations || [];
  const dataHealth = data?.data_health || {};
  const totals = data?.totals || {};

  const visibleOrganizations = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    if (!normalizedSearch) {
      return organizations;
    }

    return organizations.filter((organization) => {
      const searchable = [
        organization.name,
        organization.tenant_key,
        organization.owner_email,
        organization.subscription_tier,
        organization.subscription_status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(normalizedSearch);
    });
  }, [organizations, search]);

  if (isLoading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-800" />
      </div>
    );
  }

  if (error || data?.error) {
    return (
      <div className="mx-auto max-w-xl rounded-xl border border-red-200 bg-red-50 p-6">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <div>
            <h1 className="font-semibold text-red-900">
              Platform Owner access required
            </h1>
            <p className="mt-1 text-sm text-red-700">
              This workspace is available only to active Platform Owner accounts.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-slate-700" />
            <h1 className="text-2xl font-bold text-slate-900">
              Platform Owner
            </h1>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Organization directory, platform totals, and tenant data-health status.
          </p>
        </div>

        <Button
          variant="outline"
          onClick={() => refetch()}
          disabled={isFetching}
          className="gap-2"
        >
          <RefreshCw
            className={isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"}
          />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Organizations"
          value={totals.organizations}
          description={`${formatNumber(totals.active_organizations)} active`}
        />
        <MetricCard
          label="Accounts"
          value={totals.members}
          description="All user records"
        />
        <MetricCard
          label="Clients"
          value={totals.clients}
          description="Across every organization"
        />
        <MetricCard
          label="Visible Tenants"
          value={organizations.length}
          description="Directory records returned"
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-600" />
            <div>
              <h2 className="font-semibold text-slate-900">Data Health</h2>
              <p className="text-xs text-slate-500">
                Read-only flags for tenant-scoping cleanup.
              </p>
            </div>
          </div>
        </div>

        <div className="px-5">
          <HealthRow
            label="Clients without an organization"
            value={dataHealth.unscoped_clients}
            severity="critical"
          />
          <HealthRow
            label="Staff users without an organization"
            value={dataHealth.unscoped_staff_users}
            severity="critical"
          />
          <HealthRow
            label="Clients with an invalid organization ID"
            value={dataHealth.clients_with_invalid_org_id}
          />
          <HealthRow
            label="Users with an invalid organization ID"
            value={dataHealth.users_with_invalid_org_id}
          />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">
              Organizations
            </h2>
            <p className="text-xs text-slate-500">
              Read-only tenant summary across the Career Navigator platform.
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search organizations..."
              className="pl-9"
            />
          </div>
        </div>

        {visibleOrganizations.length === 0 ? (
          <div className="px-5 py-14 text-center text-sm text-slate-400">
            No organizations match this search.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Organization</th>
                  <th className="px-5 py-3 font-semibold">Owner</th>
                  <th className="px-5 py-3 font-semibold">Plan</th>
                  <th className="px-5 py-3 text-right font-semibold">Staff</th>
                  <th className="px-5 py-3 text-right font-semibold">Clients</th>
                  <th className="px-5 py-3 text-right font-semibold">CE</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {visibleOrganizations.map((organization) => (
                  <tr key={organization.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <div className="font-medium text-slate-900">
                        {organization.name}
                      </div>
                      <div className="mt-0.5 font-mono text-xs text-slate-400">
                        {organization.tenant_key || organization.id}
                      </div>
                    </td>

                    <td className="px-5 py-4 text-slate-600">
                      {organization.owner_email || "—"}
                    </td>

                    <td className="px-5 py-4">
                      <div className="capitalize text-slate-700">
                        {organization.subscription_tier || "—"}
                      </div>
                      <div
                        className={
                          organization.subscription_status === "active"
                            ? "mt-0.5 text-xs text-emerald-700"
                            : "mt-0.5 text-xs text-slate-500"
                        }
                      >
                        {organization.subscription_status || "—"}
                      </div>
                    </td>

                    <td className="px-5 py-4 text-right text-slate-700">
                      {formatNumber(organization.members?.staff_members)}
                    </td>

                    <td className="px-5 py-4 text-right text-slate-700">
                      <div>{formatNumber(organization.clients?.total_clients)}</div>
                      <div className="mt-0.5 text-xs text-slate-400">
                        {formatNumber(organization.clients?.active_clients)} active
                      </div>
                    </td>

                    <td className="px-5 py-4 text-right text-slate-700">
                      <div>
                        {formatNumber(organization.members?.ce_students)}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-400">
                        students
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        <Users className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          This first release is read-only. Organization drill-down, account
          correction, support sessions, and cross-deployment CE aggregation come
          after the tenant directory is verified.
        </p>
      </div>
    </div>
  );
}
