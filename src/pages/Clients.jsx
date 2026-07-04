import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Archive, Search } from "lucide-react";
import ClientCard from "@/components/clients/ClientCard";
import OrgGate from "@/lib/OrgGate";

const VALID_CLIENT_TYPES = new Set([
  "job_seeker",
  "pre_ets",
  "dspd",
  "employed",
  "customized_employment",
]);

/**
 * Client list constrained during the security remediation freeze.
 *
 * Client records are loaded exclusively through getClientsForUser, which
 * derives organization and assignment scope from the authenticated caller.
 * New-client creation is unavailable until it has a server-authorized route.
 */
export default function Clients() {
  const location = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => setUser(null));
  }, []);

  useEffect(() => {
    const typeParam = new URLSearchParams(location.search).get("type") || "all";
    setTypeFilter(VALID_CLIENT_TYPES.has(typeParam) ? typeParam : "all");
  }, [location.search]);

  const {
    data: clients = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["authorized-clients", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const response = await base44.functions.invoke("getClientsForUser", {});
      const payload = response?.data ?? response ?? {};

      if (!Array.isArray(payload.clients)) {
        throw new Error(payload.error || "Unable to load your authorized clients.");
      }

      if (user?.role === "admin") {
        return payload.clients;
      }

      try {
        const cohortResponse = await base44.functions.invoke(
          "getCohortVisibleClients",
          { user_id: user.id }
        );
        const cohortPayload = cohortResponse?.data ?? cohortResponse ?? {};
        const cohortClients = Array.isArray(cohortPayload.clients)
          ? cohortPayload.clients
          : [];
        const seenIds = new Set(payload.clients.map((client) => client.id));

        return [
          ...payload.clients,
          ...cohortClients.filter((client) => client?.id && !seenIds.has(client.id)),
        ].sort(
          (left, right) =>
            new Date(right?.created_date || 0).getTime() -
            new Date(left?.created_date || 0).getTime()
        );
      } catch {
        return payload.clients;
      }
    },
  });

  const filteredClients = clients.filter((client) => {
    const searchable = [client?.first_name, client?.last_name, client?.email]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const clientType = client?.client_type || "job_seeker";

    return (
      searchable.includes(search.trim().toLowerCase()) &&
      (statusFilter === "all" || client?.status === statusFilter) &&
      (typeFilter === "all" || clientType === typeFilter) &&
      (showArchived ? client?.is_archived === true : client?.is_archived !== true)
    );
  });

  const activeClientCount = clients.filter((client) => client?.is_archived !== true).length;

  return (
    <OrgGate>
      <main className="space-y-6">
        <section className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Clients</h1>
            <p className="mt-1 text-sm text-slate-500">
              {isLoading ? "Loading authorized clients…" : `${activeClientCount} active clients`}
            </p>
          </div>
          <p className="text-sm text-amber-800">
            New-client creation is temporarily unavailable during security remediation.
          </p>
        </section>

        <section className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search clients..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="border-slate-200 pl-10"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full border-slate-200 sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full border-slate-200 sm:w-48">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="job_seeker">Job Seeker</SelectItem>
              <SelectItem value="pre_ets">Pre-ETS</SelectItem>
              <SelectItem value="dspd">DSPD</SelectItem>
              <SelectItem value="employed">Employed</SelectItem>
              <SelectItem value="customized_employment">Customized Employment / CE</SelectItem>
            </SelectContent>
          </Select>

          <button
            type="button"
            onClick={() => setShowArchived((current) => !current)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <Archive className="h-4 w-4" />
            {showArchived ? "Hide Archived" : "Show Archived"}
          </button>
        </section>

        {isError ? (
          <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Clients could not be loaded through the authorized access route. Try refreshing the page.
          </section>
        ) : (
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredClients.map((client) => (
              <ClientCard key={client.id} client={client} />
            ))}
          </section>
        )}

        {!isLoading && !isError && filteredClients.length === 0 && (
          <section className="py-16 text-center text-sm text-slate-400">
            No clients match the selected filters.
          </section>
        )}
      </main>
    </OrgGate>
  );
}
