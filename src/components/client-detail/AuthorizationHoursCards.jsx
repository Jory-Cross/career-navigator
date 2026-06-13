import React, { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle, ShieldCheck, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

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

const EMPTY_AUTH = { auth_number: "", authorized_hours: "", start_date: "", end_date: "", notes: "" };

export default function AuthorizationHoursCards({ client, timeEntries = [], selectedMonth, onClientUpdate }) {
  const [showAddAuth, setShowAddAuth] = useState(false);
  const [newAuth, setNewAuth] = useState(EMPTY_AUTH);
  const [saving, setSaving] = useState(false);
  const [showAuthDetails, setShowAuthDetails] = useState(false);

  // ── Build combined auth list for Job Coaching ─────────────────────────
  const allJCAuths = useMemo(() => {
    const auths = [];
    // Primary auth
    if (Number(client?.job_coaching_authorized_hours_total) > 0) {
      auths.push({
        auth_number: client.job_coaching_auth_number || "",
        authorized_hours: Number(client.job_coaching_authorized_hours_total),
        start_date: client.job_coaching_auth_start_date || "",
        end_date: client.job_coaching_auth_end_date || "",
        isPrimary: true,
      });
    }
    // Additional auths
    const extras = Array.isArray(client?.job_coaching_additional_auths)
      ? client.job_coaching_additional_auths
      : [];
    for (const a of extras) {
      if (Number(a.authorized_hours) > 0) {
        auths.push({ ...a, isPrimary: false });
      }
    }
    return auths;
  }, [client]);

  const showJobCoaching = allJCAuths.length > 0;

  // Combined total authorized hours across all auths
  const jcAuthTotal = useMemo(() =>
    allJCAuths.reduce((sum, a) => sum + Number(a.authorized_hours || 0), 0),
    [allJCAuths]
  );

  // Used hours: for each auth, count entries on/after its start_date (up to end_date if set)
  // Combined = sum of all usage across all auth periods (no double-counting since periods shouldn't overlap)
  const jcUsedMinutes = useMemo(() => {
    if (!showJobCoaching) return 0;
    const jcEntries = timeEntries.filter((e) => {
      const code = (e.entry_type_code || e.entry_type || "").toLowerCase();
      return code === "job_coaching";
    });

    // Find the earliest start date across all auths (or null = count all)
    const startDates = allJCAuths.map(a => a.start_date).filter(Boolean).sort();
    const earliestStart = startDates[0] || null;

    return jcEntries
      .filter((e) => {
        if (!e.date) return true;
        if (earliestStart && e.date < earliestStart) return false;
        return true;
      })
      .reduce((sum, e) => sum + Number(e.duration_minutes || 0), 0);
  }, [timeEntries, showJobCoaching, allJCAuths]);

  const jcUsedHours = +(jcUsedMinutes / 60).toFixed(2);
  const jcRemaining = +(jcAuthTotal - jcUsedHours).toFixed(2);

  // ── DSPD monthly card ──────────────────────────────────────────────────
  const dspdMonthly = Number(client?.dspd_monthly_authorized_hours || 0);
  const showDspd = dspdMonthly > 0;

  const targetYYYYMM = useMemo(() => {
    if (selectedMonth) return selectedMonth;
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

  const monthLabel = useMemo(() => {
    try { return format(new Date(`${targetYYYYMM}-01`), "MMMM yyyy"); }
    catch { return targetYYYYMM; }
  }, [targetYYYYMM]);

  // ── Add additional auth ───────────────────────────────────────────────
  const handleAddAuth = async () => {
    if (!Number(newAuth.authorized_hours) || Number(newAuth.authorized_hours) <= 0) {
      toast.error("Please enter valid authorized hours.");
      return;
    }
    setSaving(true);
    try {
      const existing = Array.isArray(client?.job_coaching_additional_auths)
        ? client.job_coaching_additional_auths
        : [];
      const updated = [
        ...existing,
        {
          auth_number: newAuth.auth_number,
          authorized_hours: Number(newAuth.authorized_hours),
          start_date: newAuth.start_date,
          end_date: newAuth.end_date,
          notes: newAuth.notes,
        },
      ];
      await base44.entities.Client.update(client.id, {
        job_coaching_additional_auths: updated,
      });
      toast.success("Authorization added");
      setShowAddAuth(false);
      setNewAuth(EMPTY_AUTH);
      onClientUpdate?.();
    } catch (err) {
      toast.error("Failed to save authorization");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAdditionalAuth = async (index) => {
    if (!window.confirm("Remove this authorization?")) return;
    const existing = Array.isArray(client?.job_coaching_additional_auths)
      ? [...client.job_coaching_additional_auths]
      : [];
    existing.splice(index, 1);
    try {
      await base44.entities.Client.update(client.id, {
        job_coaching_additional_auths: existing,
      });
      toast.success("Authorization removed");
      onClientUpdate?.();
    } catch {
      toast.error("Failed to remove authorization");
    }
  };

  if (!showJobCoaching && !showDspd) return null;

  return (
    <div className="space-y-3">
      {/* ── Job Coaching Authorization Card ── */}
      {showJobCoaching && (
        <Card className="p-4 border-blue-200 bg-blue-50/40">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            <h4 className="font-semibold text-sm text-blue-900">Job Coaching Authorization</h4>
            <div className="ml-auto flex items-center gap-2">
              {allJCAuths.length > 1 && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                  {allJCAuths.length} auths combined
                </span>
              )}
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1 border-blue-300 text-blue-700 hover:bg-blue-100"
                onClick={() => setShowAddAuth(true)}
              >
                <Plus className="w-3 h-3" /> Add Auth
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-2">
            <StatCell label="Total Authorized" value={`${jcAuthTotal}h`} />
            <StatCell label="Used" value={`${jcUsedHours}h`} />
            <StatCell label="Remaining" value={`${jcRemaining}h`} />
          </div>

          <HoursBar used={jcUsedHours} total={jcAuthTotal} />

          {/* Breakdown toggle */}
          <button
            className="mt-2 flex items-center gap-1 text-xs text-blue-600 hover:underline"
            onClick={() => setShowAuthDetails(v => !v)}
          >
            {showAuthDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {showAuthDetails ? "Hide" : "Show"} authorization breakdown
          </button>

          {showAuthDetails && (
            <div className="mt-3 space-y-2">
              {allJCAuths.map((a, i) => (
                <div key={i} className="flex items-start justify-between bg-white border border-blue-100 rounded-lg px-3 py-2 text-xs text-slate-600">
                  <div>
                    <span className="font-medium text-slate-800">
                      {a.isPrimary ? "Primary" : `Auth ${i + 1}`}
                      {a.auth_number ? ` — #${a.auth_number}` : ""}
                    </span>
                    <span className="ml-2 text-blue-700 font-semibold">{a.authorized_hours}h</span>
                    {(a.start_date || a.end_date) && (
                      <p className="mt-0.5 text-slate-400">
                        {a.start_date && `From ${a.start_date}`}
                        {a.start_date && a.end_date && " – "}
                        {a.end_date && `To ${a.end_date}`}
                      </p>
                    )}
                    {a.notes && <p className="mt-0.5 text-slate-400 italic">{a.notes}</p>}
                  </div>
                  {!a.isPrimary && (
                    <button
                      onClick={() => handleRemoveAdditionalAuth(i - 1)}
                      className="text-red-400 hover:text-red-600 ml-2 shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

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

      {/* ── Add Authorization Dialog ── */}
      <Dialog open={showAddAuth} onOpenChange={(o) => { if (!o) { setShowAddAuth(false); setNewAuth(EMPTY_AUTH); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Job Coaching Authorization</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-slate-500">
              Add a new or renewed authorization. The hours will be combined with existing authorizations.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Auth Number</Label>
                <Input value={newAuth.auth_number} onChange={e => setNewAuth(p => ({ ...p, auth_number: e.target.value }))} placeholder="e.g. 12345-B" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Authorized Hours <span className="text-red-500">*</span></Label>
                <Input type="number" min="0" value={newAuth.authorized_hours} onChange={e => setNewAuth(p => ({ ...p, authorized_hours: e.target.value }))} placeholder="e.g. 40" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Start Date</Label>
                <Input type="date" value={newAuth.start_date} onChange={e => setNewAuth(p => ({ ...p, start_date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">End Date</Label>
                <Input type="date" value={newAuth.end_date} onChange={e => setNewAuth(p => ({ ...p, end_date: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Notes (optional)</Label>
              <Input value={newAuth.notes} onChange={e => setNewAuth(p => ({ ...p, notes: e.target.value }))} placeholder="e.g. Renewal approved by counselor" />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" onClick={() => { setShowAddAuth(false); setNewAuth(EMPTY_AUTH); }} disabled={saving}>Cancel</Button>
              <Button onClick={handleAddAuth} disabled={saving}>{saving ? "Saving..." : "Add Authorization"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}