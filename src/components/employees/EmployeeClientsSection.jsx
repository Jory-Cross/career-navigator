import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";

export default function EmployeeClientsSection({ clients, isLoading, error }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Users className="w-4 h-4 text-slate-400" /> Assigned Clients
        </h3>
        <Badge className="bg-slate-100 text-slate-600 border-0 text-xs">{clients.length}</Badge>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-400 py-2">Loading clients…</p>
      ) : error ? (
        <p className="text-sm text-red-500 py-2">{error.message || "Clients could not be loaded."}</p>
      ) : clients.length === 0 ? (
        <p className="text-sm text-slate-400 py-2">No clients are currently assigned to this employee.</p>
      ) : (
        <div className="space-y-2">
          {clients.map(client => (
            <div key={client.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-100 bg-slate-50/60">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white text-xs font-semibold shrink-0">
                {`${client.first_name?.[0] || ''}${client.last_name?.[0] || ''}` || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700 truncate">
                  {client.first_name} {client.last_name}
                </p>
                <p className="text-xs text-slate-400 truncate">{client.email}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {client.client_type && (
                  <Badge className="bg-blue-50 text-blue-600 border-0 text-[10px]">{client.client_type}</Badge>
                )}
                {client.status && (
                  <Badge
                    className={
                      client.status === 'active'
                        ? "bg-emerald-50 text-emerald-600 border-0 text-[10px]"
                        : "bg-slate-100 text-slate-500 border-0 text-[10px]"
                    }
                  >
                    {client.status}
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}