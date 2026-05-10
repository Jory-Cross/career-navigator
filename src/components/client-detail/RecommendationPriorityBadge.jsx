import React, { useState } from "react";
import { ChevronDown, ChevronUp, AlertCircle, Lightbulb, TrendingUp, Eye, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const PRIORITY_CONFIG = {
  strong_target: {
    label: "Strong Target",
    icon: TrendingUp,
    badge: "bg-green-100 border-green-300 text-green-800",
    iconColor: "text-green-600",
    descColor: "text-green-700",
  },
  explore_further: {
    label: "Explore Further",
    icon: Eye,
    badge: "bg-blue-100 border-blue-300 text-blue-800",
    iconColor: "text-blue-600",
    descColor: "text-blue-700",
  },
  stretch: {
    label: "Stretch / Developmental",
    icon: Lightbulb,
    badge: "bg-purple-100 border-purple-300 text-purple-800",
    iconColor: "text-purple-600",
    descColor: "text-purple-700",
  },
  caution: {
    label: "Caution / Verify First",
    icon: AlertCircle,
    badge: "bg-amber-100 border-amber-300 text-amber-800",
    iconColor: "text-amber-600",
    descColor: "text-amber-700",
  },
  low_priority: {
    label: "Low Priority",
    icon: Zap,
    badge: "bg-slate-100 border-slate-300 text-slate-700",
    iconColor: "text-slate-500",
    descColor: "text-slate-600",
  },
  unknown: {
    label: "Unknown Priority",
    icon: AlertCircle,
    badge: "bg-slate-100 border-slate-300 text-slate-700",
    iconColor: "text-slate-400",
    descColor: "text-slate-600",
  },
};

export default function RecommendationPriorityBadge({ priority }) {
  const [expanded, setExpanded] = useState(false);

  if (!priority) return null;

  const level = priority.priority_level || "unknown";
  const config = PRIORITY_CONFIG[level] || PRIORITY_CONFIG.unknown;
  const Icon = config.icon;

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "w-full flex items-center justify-between px-3 py-2.5 hover:bg-slate-50 transition-colors text-left border-l-4",
          `border-l-${config.iconColor.split("-")[1]}-500`
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Icon className={cn("w-4 h-4 shrink-0", config.iconColor)} />
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-semibold text-slate-800">{config.label}</div>
            <p className={cn("text-[11px] leading-relaxed mt-0.5", config.descColor)}>
              {priority.priority_reason}
            </p>
          </div>
        </div>
        {expanded
          ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
          : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
      </button>

      {expanded && (
        <div className="border-t border-slate-100 px-3 py-3 space-y-2 bg-slate-50/40">
          {/* Staff Action */}
          {priority.staff_action && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600 mb-1">
                Recommended Action
              </p>
              <p className="text-[11px] text-slate-700 leading-relaxed font-medium">
                {priority.staff_action}
              </p>
            </div>
          )}

          {/* Priority Factors */}
          {priority.priority_factors && priority.priority_factors.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600 mb-1">
                Contributing Factors
              </p>
              <ul className="space-y-1">
                {priority.priority_factors.map((factor, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-[11px] text-slate-700 leading-relaxed">
                    <span className="shrink-0 text-slate-400 font-bold mt-0.5">◦</span>
                    <span>{factor}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}