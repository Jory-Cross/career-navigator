import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Briefcase, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { cn } from "@/lib/utils";

const statusColors = {
  active: "bg-emerald-100 text-emerald-700",
  inactive: "bg-slate-100 text-slate-500",
  completed: "bg-blue-100 text-blue-700",
};

const clientTypeLabels = {
  client: "Client",
  pre_ets: "Pre-ETS",
  dspd: "DSPD",
  employed: "Employed",
  customized_employment: "Customized Employment",
};

const clientTypeColors = {
  client: "bg-violet-100 text-violet-700",
  pre_ets: "bg-amber-100 text-amber-700",
  dspd: "bg-teal-100 text-teal-700",
  employed: "bg-green-100 text-green-700",
  customized_employment: "bg-indigo-100 text-indigo-700",
};

/**
 * Client list card constrained during the security remediation freeze.
 *
 * The prior card directly read TimeEntry records and performed archive,
 * assignment, invitation, restore, and deletion actions in the browser.
 * Client navigation remains available through the secured client workspace.
 */
export default function ClientCard({ client, totalHours, applicationCount }) {
  const firstName = client?.first_name || "";
  const lastName = client?.last_name || "";
  const displayName = `${firstName} ${lastName}`.trim() || "Unnamed client";
  const initials = `${firstName[0] || ""}${lastName[0] || ""}` || "?";
  const status = client?.status || "active";
  const clientType = client?.client_type || "client";

  return (
    <Link to={createPageUrl("ClientDetail") + `?id=${client?.id || ""}`}>
      <Card
        className={cn(
          "cursor-pointer overflow-hidden border-0 shadow-sm transition-all duration-300 hover:shadow-md",
          client?.is_archived && "bg-slate-50 opacity-70"
        )}
      >
        <div className="p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 text-sm font-semibold text-white">
              {initials}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate font-semibold text-slate-900 transition-colors group-hover:text-slate-700">
                  {displayName}
                </h3>

                {client?.is_archived ? (
                  <Badge className="shrink-0 border-0 bg-slate-200 text-[10px] text-slate-600">
                    Archived
                  </Badge>
                ) : (
                  <Badge
                    className={cn(
                      "shrink-0 border-0 text-[10px]",
                      statusColors[status] || "bg-slate-100 text-slate-500"
                    )}
                  >
                    {status}
                  </Badge>
                )}

                {clientType !== "client" && (
                  <Badge
                    className={cn(
                      "shrink-0 border-0 text-[10px]",
                      clientTypeColors[clientType] || "bg-slate-100 text-slate-500"
                    )}
                  >
                    {clientTypeLabels[clientType] || clientType}
                  </Badge>
                )}
              </div>

              {client?.target_role && (
                <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                  <Briefcase className="h-3 w-3" />
                  {client.target_role}
                </p>
              )}

              {client?.location && (
                <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
                  <MapPin className="h-3 w-3" />
                  {client.location}
                </p>
              )}

              <p className="mt-3 text-xs text-slate-500">
                {Number.isFinite(Number(totalHours))
                  ? `${Number(totalHours)} tracked hour${Number(totalHours) === 1 ? "" : "s"}`
                  : "Time and authorization summaries are available in the secured client workspace."}
                {Number.isFinite(Number(applicationCount))
                  ? ` · ${Number(applicationCount)} application${Number(applicationCount) === 1 ? "" : "s"}`
                  : ""}
              </p>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}
