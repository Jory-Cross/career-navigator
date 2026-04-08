import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowRight, CheckCircle2, Save, AlertCircle, Lock } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * StructuredVRTimeEntryForm
 *
 * Fully database-driven form. Loads EntryType and ReportFieldTemplate from DB.
 * Separates internal-only notes from reportable fields.
 * Supports draft save (no validation) and final submit (full validation).
 *
 * Core time entry fields (date, duration) are always rendered explicitly —
 * not guessed from field template keys.
 *
 * Props:
 *   clientId     - required
 *   onSuccess(timeEntry, isDraft) - called after save
 */
export default function StructuredVRTimeEntryForm({ clientId, onSuccess }) {
  const [step, setStep] = useState("select_type");

  // Selected entry type
  const [entryType, setEntryType]   = useState(null); // full DB record
  const [entryTypes, setEntryTypes] = useState([]);
  const [loadingTypes, setLoadingTypes] = useState(true);

  // Field templates from DB
  const [templates, setTemplates]   = useState([]);
  const [loadingFields, setLoadingFields] = useState(false);

  // Core time entry fields (always present, not from templates)
  const [coreData, setCoreData] = useState({ date: "", duration_hours: "", general_notes: "" });
  const [coreErrors, setCoreErrors] = useState({});

  // Dynamic reportable field answers
  const [answers, setAnswers] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});

  const [saving, setSaving] = useState(false);

  // ── Load entry types ──────────────────────────────────────────────────────

  useEffect(() => {
    base44.entities.EntryType.filter({ is_active: true })
      .then(setEntryTypes)
      .catch(() => toast.error("Failed to load entry types"))
      .finally(() => setLoadingTypes(false));
  }, []);

  useEffect(() => {
    if (!entryType) return;
    setLoadingFields(true);
    setTemplates([]);
    setAnswers({});
    setFieldErrors({});
    base44.entities.ReportFieldTemplate.filter({ entry_type_id: entryType.id, is_active: true })
      .then(t => setTemplates(t.sort((a, b) => (a.order || 0) - (b.order || 0))))
      .catch(() => toast.error("Failed to load form fields"))
      .finally(() => setLoadingFields(false));
  }, [entryType?.id]);

  // ── Field classification ──────────────────────────────────────────────────

  // Internal fields are stored on the TimeEntry directly, not in ReportFieldAnswer
  const INTERNAL_KEYS = new Set(["date", "duration_hours", "duration_minutes", "start_time", "end_time", "general_notes", "internal_notes"]);

  const reportableFields = templates.filter(t => !INTERNAL_KEYS.has(t.field_key));
  const internalFields   = templates.filter(t => INTERNAL_KEYS.has(t.field_key));

  // Group reportable fields by section
  const groupedReportable = reportableFields.reduce((acc, f) => {
    const s = f.section || "Details";
    if (!acc[s]) acc[s] = [];
    acc[s].push(f);
    return acc;
  }, {});

  // ── Validation ────────────────────────────────────────────────────────────

  function validateCore() {
    const errs = {};
    if (!coreData.date) errs.date = "Date is required";
    if (!coreData.duration_hours || isNaN(Number(coreData.duration_hours)) || Number(coreData.duration_hours) <= 0)
      errs.duration_hours = "Duration must be a positive number";
    setCoreErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function validateReportableFields() {
    const errs = {};
    reportableFields.forEach(f => {
      if (f.is_required) {
        const val = answers[f.field_key];
        if (val === null || val === undefined || val === "") {
          errs[f.field_key] = `${f.label} is required`;
        }
      }
    });
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // ── Save handlers ─────────────────────────────────────────────────────────

  async function save(isDraft) {
    if (!validateCore()) return;
    if (!isDraft && !validateReportableFields()) return;

    setSaving(true);
    try {
      const durationMinutes = Math.round(Number(coreData.duration_hours) * 60);

      // Compute reporting_period_key (YYYY-MM)
      const reportingPeriodKey = coreData.date ? coreData.date.slice(0, 7) : null;

      // 1. Create TimeEntry — dual-write legacy + new schema fields
      const timeEntry = await base44.entities.TimeEntry.create({
        // ── Legacy fields ──
        client_id:        clientId,
        date:             coreData.date,
        duration_minutes: durationMinutes,
        general_notes:    coreData.general_notes || "",
        // ── New schema fields ──
        entry_type_id:       entryType.id,
        entry_type_code:     entryType.code,
        reporting_period_key: reportingPeriodKey,
        status:              isDraft ? "draft" : "submitted",
        is_reportable:       entryType.report_mode !== "none",
        is_billable:         entryType.is_billable ?? false,
        is_payroll_eligible: entryType.is_payroll_eligible ?? true,
        report_ready:        false,
        // Carry any internal template field extras
        ...buildInternalExtras()
      });

      // 2. Submit field answers via backend (schema snapshot + validation)
      const result = await base44.functions.invoke("submitFieldAnswers", {
        time_entry_id:   timeEntry.id,
        entry_type_id:   entryType.id,
        entry_type_code: entryType.code,
        answers,
        notes: isDraft ? "Draft save" : "Final submission"
      });

      if (!result?.data?.success) {
        const msg = result?.data?.validation?.errors?.[0]?.message || "Failed to save field answers";
        throw new Error(msg);
      }

      const { required_fields_complete, report_ready } = result.data;

      // Back-fill report_ready on TimeEntry once we know the answer status
      if (!isDraft && report_ready) {
        await base44.entities.TimeEntry.update(timeEntry.id, { report_ready: true });
      } else if (!isDraft && required_fields_complete) {
        await base44.entities.TimeEntry.update(timeEntry.id, { report_ready: true });
      }

      if (isDraft) {
        toast.success("Draft saved");
      } else if (report_ready) {
        toast.success("Entry submitted — ready for report generation");
      } else {
        toast.warning(`Entry saved (${result.data.summary?.completion_percentage ?? 0}% complete — some required fields missing)`);
      }

      onSuccess?.(timeEntry, isDraft);
      resetForm();

    } catch (err) {
      toast.error("Save failed: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  function buildInternalExtras() {
    const extras = {};
    internalFields.forEach(f => {
      if (!INTERNAL_KEYS.has(f.field_key)) return; // only carry through known core keys
      const val = answers[f.field_key];
      if (val !== undefined && val !== "") extras[f.field_key] = val;
    });
    return extras;
  }

  function resetForm() {
    setStep("select_type");
    setEntryType(null);
    setTemplates([]);
    setCoreData({ date: "", duration_hours: "", general_notes: "" });
    setCoreErrors({});
    setAnswers({});
    setFieldErrors({});
  }

  // ── STEP 1: Select entry type ─────────────────────────────────────────────

  if (step === "select_type") {
    if (loadingTypes) return <LoadingCard label="Loading entry types..." />;
    return (
      <Card className="p-6 space-y-4">
        <h3 className="font-semibold text-base">Select Entry Type</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {entryTypes.map(et => (
            <button
              key={et.id}
              onClick={() => { setEntryType(et); setStep("enter_data"); }}
              className="p-4 text-left rounded-lg border-2 border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-all"
              style={{ borderColor: et.color ? et.color + "80" : undefined }}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-sm">{et.name}</p>
                  {et.description && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{et.description}</p>}
                </div>
                {et.color && (
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: et.color }} />
                )}
              </div>
            </button>
          ))}
        </div>
      </Card>
    );
  }

  // ── STEP 2: Enter data ────────────────────────────────────────────────────

  if (step === "enter_data") {
    if (loadingFields) return <LoadingCard label="Loading form fields..." />;
    return (
      <Card className="p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-base">{entryType.name}</h3>
            {entryType.color && (
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entryType.color }} />
            )}
          </div>
          <button
            onClick={resetForm}
            className="text-xs text-slate-500 hover:text-slate-800 underline"
          >
            Change Type
          </button>
        </div>

        {/* ── Core Fields (always present) ── */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Time Entry</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Date <span className="text-red-500">*</span></Label>
              <Input
                type="date"
                value={coreData.date}
                onChange={e => setCoreData(p => ({ ...p, date: e.target.value }))}
                className={coreErrors.date ? "border-red-500" : ""}
              />
              {coreErrors.date && <p className="text-xs text-red-500">{coreErrors.date}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Duration (hours) <span className="text-red-500">*</span></Label>
              <Input
                type="number"
                step="0.25"
                min="0"
                placeholder="e.g. 1.5"
                value={coreData.duration_hours}
                onChange={e => setCoreData(p => ({ ...p, duration_hours: e.target.value }))}
                className={coreErrors.duration_hours ? "border-red-500" : ""}
              />
              {coreErrors.duration_hours && <p className="text-xs text-red-500">{coreErrors.duration_hours}</p>}
            </div>
          </div>
        </div>

        {/* ── Reportable Fields (from ReportFieldTemplate, grouped by section) ── */}
        {Object.entries(groupedReportable).map(([section, sectionFields]) => (
          <div key={section} className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{section}</h4>
            <div className="space-y-3">
              {sectionFields.map(f => (
                <FieldInput
                  key={f.id}
                  field={f}
                  value={answers[f.field_key] ?? ""}
                  error={fieldErrors[f.field_key]}
                  onChange={val => {
                    setAnswers(p => ({ ...p, [f.field_key]: val }));
                    if (fieldErrors[f.field_key]) setFieldErrors(p => ({ ...p, [f.field_key]: null }));
                  }}
                />
              ))}
            </div>
          </div>
        ))}

        {/* ── Internal Notes (not in report) ── */}
        <div className="space-y-2 pt-1 border-t border-dashed border-slate-200">
          <div className="flex items-center gap-1.5">
            <Lock className="w-3 h-3 text-slate-400" />
            <h4 className="text-xs font-medium text-slate-400">Internal Notes (not included in reports)</h4>
          </div>
          <Textarea
            value={coreData.general_notes}
            onChange={e => setCoreData(p => ({ ...p, general_notes: e.target.value }))}
            placeholder="Internal notes, observations (not exported to VR reports)..."
            className="resize-none min-h-[64px] text-sm bg-slate-50"
          />
        </div>

        {/* ── Completion indicator ── */}
        {reportableFields.length > 0 && (
          <CompletionBar
            reportableFields={reportableFields}
            answers={answers}
          />
        )}

        {/* ── Actions ── */}
        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={resetForm} className="flex-none">
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={() => save(true)}
            disabled={saving}
            className="flex-1 border-amber-200 text-amber-700 hover:bg-amber-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Draft
          </Button>
          <Button
            onClick={() => save(false)}
            disabled={saving}
            className="flex-1"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Submit Entry
          </Button>
        </div>
      </Card>
    );
  }

  return null;
}

// ─── Completion Bar ───────────────────────────────────────────────────────────

function CompletionBar({ reportableFields, answers }) {
  const required  = reportableFields.filter(f => f.is_required);
  const completed = required.filter(f => {
    const v = answers[f.field_key];
    return v !== undefined && v !== null && v !== "";
  });
  const pct = required.length === 0 ? 100 : Math.round((completed.length / required.length) * 100);
  const missing = required.filter(f => {
    const v = answers[f.field_key];
    return v === undefined || v === null || v === "";
  });

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>Required fields: {completed.length}/{required.length}</span>
        <span className={cn(pct === 100 ? "text-green-600 font-medium" : "text-amber-600")}>{pct}%</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", pct === 100 ? "bg-green-500" : "bg-amber-400")}
          style={{ width: `${pct}%` }}
        />
      </div>
      {missing.length > 0 && pct < 100 && (
        <p className="text-xs text-amber-600">
          Missing: {missing.map(f => f.label).join(", ")}
        </p>
      )}
    </div>
  );
}

// ─── Loading Card ─────────────────────────────────────────────────────────────

function LoadingCard({ label }) {
  return (
    <Card className="p-6 flex items-center justify-center min-h-40">
      <div className="text-center">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-400" />
        <p className="text-sm text-slate-500">{label}</p>
      </div>
    </Card>
  );
}

// ─── Field Input ──────────────────────────────────────────────────────────────

function FieldInput({ field, value, error, onChange }) {
  const inputClass = error ? "border-red-500" : "";

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">
        {field.label}
        {field.is_required && <span className="text-red-500 ml-1">*</span>}
      </Label>

      {(field.field_type === "text" || !field.field_type) && (
        <Input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={inputClass}
        />
      )}

      {field.field_type === "number" && (
        <Input
          type="number"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={inputClass}
        />
      )}

      {field.field_type === "date" && (
        <Input
          type="date"
          value={value}
          onChange={e => onChange(e.target.value)}
          className={inputClass}
        />
      )}

      {field.field_type === "time" && (
        <Input
          type="time"
          value={value}
          onChange={e => onChange(e.target.value)}
          className={inputClass}
        />
      )}

      {field.field_type === "textarea" && (
        <Textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={cn("resize-none min-h-[80px]", inputClass)}
        />
      )}

      {field.field_type === "boolean" && (
        <div className="flex items-center gap-2">
          <Checkbox checked={!!value} onCheckedChange={onChange} />
          <span className="text-xs text-slate-600">{field.placeholder || field.label}</span>
        </div>
      )}

      {field.field_type === "select" && (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className={inputClass}>
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            {(field.options || []).map(opt => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {field.field_type === "multiselect" && (
        <Select value={Array.isArray(value) ? value[0] : value} onValueChange={onChange}>
          <SelectTrigger className={inputClass}>
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            {(field.options || []).map(opt => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {field.help_text && <p className="text-xs text-slate-400">{field.help_text}</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}