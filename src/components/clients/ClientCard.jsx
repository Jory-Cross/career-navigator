import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, MapPin, Briefcase, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { cn } from "@/lib/utils";

const statusColors = {
  active: "bg-emerald-100 text-emerald-700",
  inactive: "bg-slate-100 text-slate-500",
  completed: "bg-blue-100 text-blue-700"
};

export default function ClientCard({ client, totalHours, applicationCount }) {
  return (
    <Link to={createPageUrl("ClientDetail") + `?id=${client.id}`}>
      <Card className="border-0 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer group overflow-hidden">
        <div className="p-5">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white font-semibold text-sm shrink-0">
              {client.first_name?.[0]}{client.last_name?.[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-900 truncate group-hover:text-slate-700 transition-colors">
                  {client.first_name} {client.last_name}
                </h3>
                <Badge className={cn("text-[10px] border-0 shrink-0", statusColors[client.status])}>
                  {client.status}
                </Badge>
              </div>
              {client.target_role && (
                <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                  <Briefcase className="w-3 h-3" />
                  {client.target_role}
                </p>
              )}
              {client.location && (
                <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {client.location}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 mt-4 pt-3 border-t border-slate-50">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Clock className="w-3 h-3" />
              <span>{totalHours || 0}h logged</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Briefcase className="w-3 h-3" />
              <span>{applicationCount || 0} applications</span>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}