import React, { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { format } from "date-fns";

function HoursBar({ used, total }) {
  if (!total) return null;
  const pct = Math.min(100, Math.round((used / total) * 100));
  const color = pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-blue-500";
  return (
    <div className="w-full bg-slate-200 rounded-full h-1.5 mt-1">
      <div className={`${color} h-1.5 rounded-full transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function StatCell({ label, value }) {
  return (
    <div className="text-center">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}

export default function AuthorizationHoursCards({ client, timeEntries = [], selectedMonth }) {
  // ── Job Coaching card ──────────────────────────────────────────────────
  const jcAuthTotal = Number(client?.job_coaching_authorized_hours_total || 0);
  const showJobCoaching = jcAuthTotal > 0;

  const jcUsedMinutes = useMemo(() => {
    if (!showJobCoaching) return 0;
    return timeEntries
      .filter((e) => {
        const code = (e.entry_type_code || e.entry_type || "").toLowerCase();
        return code === "job_coaching";
      })
      .reduce((sum, e) => sum + Number(e.duration_minutes || 0), 0);
  }, [timeEntries, showJobCoaching]);

  const jcUsedHours = +(jcUsedMinutes / 60).toFixed(2);
  const jcRemaining = +(jcAuthTotal - jcUsedHours).toFixed(2);

  // ── DSPD monthly card ──────────────────────────────────────────────────
  const dspdMonthly = Number(client?.dspd_monthly_authorized_hours || 0);
  const showDspd = dspdMonthly > 0;

  // Determine the month to calculate against
  const targetYYYYMM = useMemo(() => {
    if (selectedMonth) return selectedMonth; // e.g. "2024-06"
    return format(new Date(), "yyyy-MM");
  }, [selectedMonth]);

  const dspdUsedMinutes = useMemo(() => {
    if (!showDspd) return 0;
    return timeEntries
      .filter((e) => {
        const code = (e.entry_type_code || e.entry_type || "").toLowerCase();
        if (code !== "dspd") return false;
        if (!e.date) return false;
        return e.date.startsWith(targetYYYYMM);
      })
      .reduce((sum, e) => sum + Number(e.duration_minutes || 0), 0);
  }, [timeEntries, showDspd, targetYYYYMM]);

  const dspdUsedHours = +(dspdUsedMinutes / 60).toFixed(2);
  const dspdRemaining = +(dspdMonthly - dspdUsedHours).toFixed(2);

  // Month label for display
  const monthLabel = useMemo(() => {
    try {
      return format(new Date(`${targetYYYYMM}-01`), "MMMM yyyy");
    } catch {
      return targetYYYYMM;
    }
  }, [targetYYYYMM]);

  if (!showJobCoaching && !showDspd) return null;

  return (
    <div className="space-y-3">
      {/* ── Job Coaching Authorization Card ── */}
      {showJobCoaching && (
        <Card className="p-4 border-blue-200 bg-blue-50/40">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            <h4 className="font-semibold text-sm text-blue-900">Job Coaching Authorization</h4>
            {client.job_coaching_auth_number && (
              <span className="ml-auto text-xs text-slate-500">Auth #: {client.job_coaching_auth_number}</span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 mb-2">
            <StatCell label="Authorized" value={`${jcAuthTotal}h`} />
            <StatCell label="Used" value={`${jcUsedHours}h`} />
            <StatCell label="Remaining" value={`${jcRemaining}h`} />
          </div>

          <HoursBar used={jcUsedHours} total={jcAuthTotal} />

          {client.job_coaching_auth_start_date || client.job_coaching_auth_end_date ? (
            <p className="text-xs text-slate-500 mt-2">
              {client.job_coaching_auth_start_date && `From ${client.job_coaching_auth_start_date}`}
              {client.job_coaching_auth_start_date && client.job_coaching_auth_end_date && " – "}
              {client.job_coaching_auth_end_date && `To ${client.job_coaching_auth_end_date}`}
            </p>
          ) : null}

          {jcRemaining <= 0 && (
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-100 border border-red-200 px-3 py-2 text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              Job coaching authorization hours exhausted. Request new authorization before adding more hours.
            </div>
          )}
          {jcRemaining > 0 && jcRemaining <= 10 && (
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-100 border border-amber-200 px-3 py-2 text-sm text-amber-700">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              Only {jcRemaining}h of job coaching hours remaining. Request new authorization.
            </div>
          )}
        </Card>
      )}

      {/* ── DSPD Monthly Authorization Card ── */}
      {showDspd && (
        <Card className="p-4 border-purple-200 bg-purple-50/40">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="w-4 h-4 text-purple-600" />
            <h4 className="font-semibold text-sm text-purple-900">DSPD Monthly Hours</h4>
            <span className="ml-auto text-xs text-slate-500">{monthLabel}</span>
          </div>

          {client.dspd_auth_number && (
            <p className="text-xs text-slate-500 mb-2">Auth #: {client.dspd_auth_number}</p>
          )}

          <div className="grid grid-cols-3 gap-2 mb-2">
            <StatCell label="Monthly Auth" value={`${dspdMonthly}h`} />
            <StatCell label="Used This Month" value={`${dspdUsedHours}h`} />
            <StatCell label="Remaining" value={`${dspdRemaining}h`} />
          </div>

          <HoursBar used={dspdUsedHours} total={dspdMonthly} />

          {dspdRemaining <= 0 && (
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-100 border border-red-200 px-3 py-2 text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              DSPD monthly authorized hours exhausted.
            </div>
          )}
          {dspdRemaining > 0 && dspdRemaining <= 10 && (
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-100 border border-amber-200 px-3 py-2 text-sm text-amber-700">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              Only {dspdRemaining}h of DSPD hours remaining this month.
            </div>
          )}
        </Card>
      )}
    </div>
  );
}