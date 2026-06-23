import React from "react";
import { CheckCircle2, Circle } from "lucide-react";

const MILESTONES = [
  { key: "home_community", label: "Home & Community Discovery Complete" },
  { key: "benefits",       label: "Benefits & Resources Complete" },
  { key: "assistive_tech", label: "Assistive Technology Complete" },
  { key: "discovery_interviews", label: "Discovery Interview Target Met (3)" },
  { key: "informational_interviews", label: "Informational Interview Target Met (2)" },
  { key: "discovery_activities", label: "Discovery Activity Target Met (1)" },
  { key: "stage_two_ready", label: "Stage Two Ready" },
];

export default function StageOneMilestoneTracker({
  homeDiscoveryCompleted,
  benefitsCompleted,
  assistiveTechCompleted,
  discoveryInterviewCompletedCount,
  informationalInterviewCompletedCount,
  discoveryActivityCompletedCount,
  stageTwoReady,
}) {
  const status = {
    home_community: homeDiscoveryCompleted,
    benefits: benefitsCompleted,
    assistive_tech: assistiveTechCompleted,
    discovery_interviews: discoveryInterviewCompletedCount >= 3,
    informational_interviews: informationalInterviewCompletedCount >= 2,
    discovery_activities: discoveryActivityCompletedCount >= 1,
    stage_two_ready: stageTwoReady,
  };

  const completedCount = Object.values(status).filter(Boolean).length;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h5 className="text-sm font-semibold text-slate-900">Stage One Milestones</h5>
        <span className="text-xs text-slate-500">{completedCount} of {MILESTONES.length} complete</span>
      </div>

      <div className="space-y-2">
        {MILESTONES.map((milestone, index) => {
          const done = status[milestone.key];
          const isFinal = milestone.key === "stage_two_ready";
          return (
            <div key={milestone.key} className="flex items-center gap-2.5">
              {/* Connector line above (except first) */}
              <div className="flex flex-col items-center self-stretch">
                <div className={`w-px flex-1 ${index === 0 ? "invisible" : done ? "bg-emerald-300" : "bg-slate-200"}`} />
                {done ? (
                  <CheckCircle2 className={`h-4 w-4 shrink-0 ${isFinal ? "text-emerald-600" : "text-emerald-500"}`} />
                ) : (
                  <Circle className="h-4 w-4 shrink-0 text-slate-300" />
                )}
                <div className={`w-px flex-1 ${index === MILESTONES.length - 1 ? "invisible" : done ? "bg-emerald-300" : "bg-slate-200"}`} />
              </div>

              <span className={`text-sm ${done ? "text-slate-800 font-medium" : "text-slate-400"} ${isFinal && done ? "text-emerald-700 font-semibold" : ""}`}>
                {milestone.label}
              </span>

              {done && (
                <span className="ml-auto text-xs text-emerald-600 font-medium shrink-0">✓ Complete</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}