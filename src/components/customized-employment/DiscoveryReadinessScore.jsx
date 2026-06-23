import React from "react";
import { CheckCircle2, Circle, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// Scoring rules — each criterion has a max weight; partial credit where noted.
const CRITERIA = [
  {
    key: "home_community_discovery",
    label: "Home & Community Discovery",
    weight: 25,
    description: "Completed assessment",
  },
  {
    key: "benefits_resources",
    label: "Benefits & Resources Assessment",
    weight: 15,
    description: "Completed assessment",
  },
  {
    key: "assistive_technology",
    label: "Assistive Technology Assessment",
    weight: 10,
    description: "Completed assessment",
  },
  {
    key: "discovery_interviews",
    label: "Discovery Interviews",
    weight: 25,
    description: "≥3 completed interviews for full credit; partial for 1–2",
    target: 3,
  },
  {
    key: "informational_interviews",
    label: "Informational Interviews",
    weight: 15,
    description: "≥2 completed interviews for full credit; partial for 1",
    target: 2,
  },
  {
    key: "discovery_activities",
    label: "Discovery Activities",
    weight: 10,
    description: "≥1 completed activity",
    target: 1,
  },
];

function getStatus(score) {
  if (score === 0) return { label: "Not Started", color: "slate", bar: "bg-slate-300" };
  if (score < 40) return { label: "In Progress", color: "amber", bar: "bg-amber-400" };
  if (score < 80) return { label: "Nearly Complete", color: "blue", bar: "bg-blue-500" };
  return { label: "Ready for Stage Two", color: "emerald", bar: "bg-emerald-500" };
}

function CriterionRow({ label, earned, max, description }) {
  const pct = max > 0 ? earned / max : 0;
  const done = earned >= max;
  const partial = earned > 0 && earned < max;

  return (
    <div className="flex items-start gap-2">
      {done ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
      ) : partial ? (
        <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
      ) : (
        <Circle className="h-4 w-4 text-slate-300 shrink-0 mt-0.5" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-sm ${done ? "text-slate-800 font-medium" : "text-slate-600"}`}>
            {label}
          </span>
          <span className="text-xs text-slate-500 shrink-0">
            {earned}/{max} pts
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-0.5">{description}</p>
      </div>
    </div>
  );
}

export default function DiscoveryReadinessScore({
  homeDiscoveryCompleted,
  benefitsCompleted,
  assistiveTechCompleted,
  discoveryInterviewCompletedCount,
  discoveryInterviewTotalCount,
  informationalInterviewCompletedCount,
  informationalInterviewTotalCount,
  discoveryActivityCompletedCount,
  discoveryActivityTotalCount,
}) {
  // Calculate earned points per criterion
  const earned = {
    home_community_discovery: homeDiscoveryCompleted ? 25 : 0,
    benefits_resources: benefitsCompleted ? 15 : 0,
    assistive_technology: assistiveTechCompleted ? 10 : 0,
    discovery_interviews: Math.min(
      25,
      Math.round((Math.min(discoveryInterviewCompletedCount, 3) / 3) * 25)
    ),
    informational_interviews: Math.min(
      15,
      Math.round((Math.min(informationalInterviewCompletedCount, 2) / 2) * 15)
    ),
    discovery_activities: discoveryActivityCompletedCount >= 1 ? 10 : 0,
  };

  const totalScore = Object.values(earned).reduce((sum, v) => sum + v, 0);
  const status = getStatus(totalScore);

  const criteriaRows = [
    { key: "home_community_discovery", label: "Home & Community Discovery", earned: earned.home_community_discovery, max: 25, description: homeDiscoveryCompleted ? "Completed" : "Not yet completed" },
    { key: "benefits_resources", label: "Benefits & Resources Assessment", earned: earned.benefits_resources, max: 15, description: benefitsCompleted ? "Completed" : "Not yet completed" },
    { key: "assistive_technology", label: "Assistive Technology Assessment", earned: earned.assistive_technology, max: 10, description: assistiveTechCompleted ? "Completed" : "Not yet completed" },
    {
      key: "discovery_interviews",
      label: "Discovery Interviews",
      earned: earned.discovery_interviews,
      max: 25,
      description: discoveryInterviewTotalCount === 0
        ? "No records found (target: 3 completed)"
        : discoveryInterviewCompletedCount === 0
        ? `${discoveryInterviewTotalCount} record${discoveryInterviewTotalCount === 1 ? "" : "s"} found, 0 completed — mark complete to earn credit (target: 3)`
        : `${discoveryInterviewCompletedCount} of ${discoveryInterviewTotalCount} completed (target: 3)`,
    },
    {
      key: "informational_interviews",
      label: "Informational Interviews",
      earned: earned.informational_interviews,
      max: 15,
      description: informationalInterviewTotalCount === 0
        ? "No records found (target: 2 completed)"
        : informationalInterviewCompletedCount === 0
        ? `${informationalInterviewTotalCount} record${informationalInterviewTotalCount === 1 ? "" : "s"} found, 0 completed — mark complete to earn credit (target: 2)`
        : `${informationalInterviewCompletedCount} of ${informationalInterviewTotalCount} completed (target: 2)`,
    },
    {
      key: "discovery_activities",
      label: "Discovery Activities",
      earned: earned.discovery_activities,
      max: 10,
      description: discoveryActivityTotalCount === 0
        ? "No records found (target: 1 completed)"
        : discoveryActivityCompletedCount === 0
        ? `${discoveryActivityTotalCount} record${discoveryActivityTotalCount === 1 ? "" : "s"} found, 0 completed — mark complete to earn credit (target: 1)`
        : `${discoveryActivityCompletedCount} of ${discoveryActivityTotalCount} completed (target: 1)`,
    },
  ];

  const badgeClass = {
    slate: "border-slate-300 text-slate-600 bg-slate-50",
    amber: "border-amber-300 text-amber-700 bg-amber-50",
    blue: "border-blue-300 text-blue-700 bg-blue-50",
    emerald: "border-emerald-300 text-emerald-700 bg-emerald-50",
  }[status.color];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h5 className="text-sm font-semibold text-slate-900">
          Discovery Readiness Score
        </h5>
        <Badge variant="outline" className={badgeClass}>
          {status.label}
        </Badge>
      </div>

      {/* Score bar */}
      <div className="space-y-1.5">
        <div className="flex items-end justify-between">
          <span className="text-3xl font-bold text-slate-900">{totalScore}%</span>
          <span className="text-xs text-slate-400 mb-1">Stage One Readiness</span>
        </div>
        <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${status.bar}`}
            style={{ width: `${totalScore}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-slate-400">
          <span>Not Started</span>
          <span>40% — In Progress</span>
          <span>80% — Nearly Complete</span>
          <span>100%</span>
        </div>
      </div>

      {/* Criterion rows */}
      <div className="space-y-2.5 pt-1">
        {criteriaRows.map((row) => (
          <CriterionRow key={row.key} {...row} />
        ))}
      </div>

      <p className="text-xs text-slate-400 pt-1 border-t border-slate-100">
        Completeness only — based on assessment completion and interview counts. No AI generation.
      </p>
    </div>
  );
}