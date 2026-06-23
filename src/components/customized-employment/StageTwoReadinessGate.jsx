import React, { useEffect } from "react";
import { CheckCircle2, XCircle, AlertTriangle, ShieldCheck, ShieldX } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// ─── Rule definitions ──────────────────────────────────────────────────────
// Each rule is evaluated deterministically from the inputs.
// passed: boolean — whether the rule is satisfied
// label: short name shown in the gate
// reason: message shown when the rule fails

function buildRules({
  totalScore,
  homeDiscoveryCompleted,
  benefitsCompleted,
  assistiveTechCompleted,
  discoveryInterviewCompletedCount,
  discoveryInterviewTotalCount,
  informationalInterviewCompletedCount,
  informationalInterviewTotalCount,
  discoveryActivityCompletedCount,
  discoveryActivityTotalCount,
  fidelityMissingCount,
  fidelityWeakCount,
}) {
  return [
    {
      key: "score_threshold",
      label: "Readiness Score",
      passed: totalScore >= 80,
      reason: `Score is ${totalScore}% — at least 80% required to advance.`,
      current: totalScore,
      target: 80,
      unit: "%",
    },
    {
      key: "home_community",
      label: "Home & Community Discovery completed",
      passed: homeDiscoveryCompleted,
      reason: "Home & Community Discovery assessment must be marked complete.",
    },
    {
      key: "benefits",
      label: "Benefits & Resources Assessment completed",
      passed: benefitsCompleted,
      reason: "Benefits & Resources Assessment must be marked complete.",
    },
    {
      key: "assistive_tech",
      label: "Assistive Technology Assessment completed",
      passed: assistiveTechCompleted,
      reason: "Assistive Technology Assessment must be marked complete.",
    },
    {
      key: "discovery_interviews",
      label: "Discovery Interviews",
      passed: discoveryInterviewCompletedCount >= 3,
      reason:
        discoveryInterviewTotalCount === 0
          ? "No Discovery Interview records found. Complete at least 3."
          : `${discoveryInterviewCompletedCount} of ${discoveryInterviewTotalCount} interviews completed — 3 required.`,
      current: discoveryInterviewCompletedCount,
      total: discoveryInterviewTotalCount,
      target: 3,
      unit: "complete",
    },
    {
      key: "informational_interviews",
      label: "Informational Interviews",
      passed: informationalInterviewCompletedCount >= 2,
      reason:
        informationalInterviewTotalCount === 0
          ? "No Informational Interview records found. Complete at least 2."
          : `${informationalInterviewCompletedCount} of ${informationalInterviewTotalCount} completed — 2 required.`,
      current: informationalInterviewCompletedCount,
      total: informationalInterviewTotalCount,
      target: 2,
      unit: "complete",
    },
    {
      key: "discovery_activities",
      label: "Discovery Activities",
      passed: discoveryActivityCompletedCount >= 1,
      reason:
        discoveryActivityTotalCount === 0
          ? "No Discovery Activity records found. Complete at least 1."
          : `${discoveryActivityCompletedCount} of ${discoveryActivityTotalCount} completed — 1 required.`,
      current: discoveryActivityCompletedCount,
      total: discoveryActivityTotalCount,
      target: 1,
      unit: "complete",
    },
    {
      key: "fidelity_no_missing",
      label: "No missing evidence categories",
      passed: fidelityMissingCount === 0,
      reason: `${fidelityMissingCount} evidence ${fidelityMissingCount === 1 ? "category has" : "categories have"} no items. All categories must have at least some evidence.`,
    },
    {
      key: "fidelity_weak_cap",
      label: "Fewer than 4 weak evidence categories",
      passed: fidelityWeakCount < 4,
      reason: `${fidelityWeakCount} categories have weak evidence (< 3 items or < 2 sources). Strengthen discovery before advancing.`,
    },
  ];
}

function RuleRow({ rule }) {
  return (
    <div
      className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 ${
        rule.passed
          ? "border-emerald-200 bg-emerald-50"
          : "border-red-200 bg-red-50"
      }`}
    >
      {rule.passed ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
      ) : (
        <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
      )}
      <div className="min-w-0">
        <p
          className={`text-sm font-medium ${
            rule.passed ? "text-emerald-800" : "text-red-800"
          }`}
        >
          {rule.label}
        </p>
        {!rule.passed && (
          <p className="text-xs text-red-600 mt-0.5">{rule.reason}</p>
        )}
      </div>
    </div>
  );
}

export default function StageTwoReadinessGate({
  totalScore,
  homeDiscoveryCompleted,
  benefitsCompleted,
  assistiveTechCompleted,
  discoveryInterviewCompletedCount,
  discoveryInterviewTotalCount,
  informationalInterviewCompletedCount,
  informationalInterviewTotalCount,
  discoveryActivityCompletedCount,
  discoveryActivityTotalCount,
  fidelityMissingCount,
  fidelityWeakCount,
  onRules,
}) {
  const rules = buildRules({
    totalScore,
    homeDiscoveryCompleted,
    benefitsCompleted,
    assistiveTechCompleted,
    discoveryInterviewCompletedCount,
    discoveryInterviewTotalCount,
    informationalInterviewCompletedCount,
    informationalInterviewTotalCount,
    discoveryActivityCompletedCount,
    discoveryActivityTotalCount,
    fidelityMissingCount,
    fidelityWeakCount,
  });

  const failedRules = rules.filter((r) => !r.passed);
  const passedRules = rules.filter((r) => r.passed);
  const isReady = failedRules.length === 0;

  // Surface rules to parent so StageOneWorkDashboard can consume them without re-computing
  useEffect(() => {
    if (onRules) onRules(rules);
  }, [rules.map((r) => r.passed).join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className={`rounded-xl border-2 p-5 space-y-4 ${
        isReady
          ? "border-emerald-400 bg-emerald-50"
          : "border-red-300 bg-red-50"
      }`}
    >
      {/* Header verdict */}
      <div className="flex items-center gap-3">
        {isReady ? (
          <ShieldCheck className="h-6 w-6 text-emerald-600 shrink-0" />
        ) : (
          <ShieldX className="h-6 w-6 text-red-500 shrink-0" />
        )}
        <div className="flex-1">
          <h5
            className={`text-base font-bold ${
              isReady ? "text-emerald-800" : "text-red-800"
            }`}
          >
            {isReady ? "READY FOR STAGE TWO" : "NOT READY FOR STAGE TWO"}
          </h5>
          <p
            className={`text-xs mt-0.5 ${
              isReady ? "text-emerald-600" : "text-red-600"
            }`}
          >
            {isReady
              ? `All ${rules.length} Stage One requirements satisfied. You may advance to Stage Two.`
              : `${failedRules.length} of ${rules.length} requirement${
                  failedRules.length === 1 ? "" : "s"
                } not yet met.`}
          </p>
        </div>
        <Badge
          variant="outline"
          className={
            isReady
              ? "border-emerald-400 text-emerald-700 bg-white font-semibold"
              : "border-red-400 text-red-700 bg-white font-semibold"
          }
        >
          {passedRules.length}/{rules.length} passed
        </Badge>
      </div>

      {/* Failed requirements first */}
      {failedRules.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
            <p className="text-xs font-semibold text-red-700 uppercase tracking-wide">
              Missing Requirements
            </p>
          </div>
          <div className="space-y-1.5">
            {failedRules.map((rule) => (
              <RuleRow key={rule.key} rule={rule} />
            ))}
          </div>
        </div>
      )}

      {/* Passed requirements (collapsible appearance) */}
      {passedRules.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Satisfied Requirements
          </p>
          <div className="space-y-1.5">
            {passedRules.map((rule) => (
              <RuleRow key={rule.key} rule={rule} />
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-slate-400 border-t border-slate-200 pt-3">
        Deterministic rule-based gate — no AI generation. All criteria must pass before Stage Two begins.
      </p>
    </div>
  );
}