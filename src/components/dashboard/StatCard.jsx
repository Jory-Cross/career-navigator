import React from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function StatCard({ label, value, icon: Icon, color = "text-slate-600", bgColor = "bg-slate-50", trend }) {
  return (
    <Card className="relative overflow-hidden border-0 shadow-sm hover:shadow-md transition-shadow duration-300">
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</p>
            <p className="text-2xl font-bold text-slate-900">{value}</p>
            {trend && <p className="text-xs text-emerald-600 font-medium">{trend}</p>}
          </div>
          <div className={cn("p-2.5 rounded-xl", bgColor)}>
            <Icon className={cn("w-5 h-5", color)} />
          </div>
        </div>
      </div>
      <div className={cn("h-1 w-full", bgColor)} />
    </Card>
  );
}