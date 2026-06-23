import React from "react";
import { ClipboardList } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/**
 * Receives the already-evaluated rule list from StageTwoReadinessGate.
 * Only failed rules are shown — no new calculations here.
 *
 * Each rule object: { key, label, passed, reason, current?, target?, unit? }
 * The optional current/target/unit fields drive the progress display.
 */
export default function StageOneWorkDashboard({ rules }) {
  const failedRules = rules.filter((r) => !r.passed);

  if (failedRules.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-slate-600" />
          <h5 className="text-sm font-semibold text-slate-900">
            Remaining Stage One Work
          </h5>
        </div>
        <Badge variant="outline" className="border-red-300 text-red-700 bg-red-50">
          {failedRules.length} requirement{failedRules.length === 1 ? "" : "s"} remaining
        </Badge>
      </div>

      <div className="divide-y divide-slate-100">
        {failedRules.map((rule) => {
          const hasProgress = rule.current !== undefined && rule.target !== undefined;
          const remaining = hasProgress ? rule.target - rule.current : null;
          const pct = hasProgress && rule.target > 0
            ? Math.round((rule.current / rule.target) * 100)
            : 0;

          return (
            <div key={rule.key} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-sm font-medium text-slate-800">{rule.label}</span>
                {hasProgress && (
                  <span className="text-xs text-slate-500 shrink-0">
                    {rule.current} / {rule.target}{rule.unit ? ` ${rule.unit}` : ""}
                  </span>
                )}
              </div>

              {hasProgress && (
                <>
                  <div className="mt-1.5 h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-amber-400 transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Remaining: {remaining}{rule.unit ? ` ${rule.unit}` : ""}
                  </p>
                </>
              )}

              {!hasProgress && (
                <p className="text-xs text-slate-500 mt-0.5">{rule.reason}</p>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-slate-400 border-t border-slate-100 pt-3">
        Deterministic only — reflects exactly the failed requirements from the Stage Two Readiness Gate.
      </p>
    </div>
  );
}