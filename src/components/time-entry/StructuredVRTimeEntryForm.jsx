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
 * StructuredVRTimeEntryForm - Primary Structured VR Entry Experience
 *
 * 4-Step database-driven workflow:
 *   Step 1: Select entry type
 *   Step 2: Core time entry fields (date, times, client, employee, authorization)
 *   Step 3: Dynamic reportable fields for that entry type
 *   Step 4: Review + save (draft or final submit)
 *
 * Features:
 * - Database-driven (EntryType, ReportFieldTemplate)
 * - Separate reportable fields from internal-only notes
 * - Show whether entry is billable, payroll-eligible, report-ready
 * - Support Save Draft (no validation) and Final Submit (full validation)
 * - Create ReportFieldAnswer with schema snapshot metadata
 *
 * Props:
 *   clientId     - required
 *   clients      - array of Client records for selection
 *   onSuccess(timeEntry, isDraft) - called after save
 */
export default function StructuredVRTimeEntryForm({ clientId, clients = [], onSuccess }) {
  const [step, setStep] = useState("select_type");

  // Selected entry type
  const [entryType, setEntryType]   = useState(null); // full DB record
  const [entryTypes, setEntryTypes] = useState([]);
  const [loadingTypes, setLoadingTypes] = useState(true);

  // Field templates from DB
  const [templates, setTemplates]   = useState([]);
  const [loadingFields, setLoadingFields] = useState(false);

  // Core time entry fields (always present, not from templates)
  const [coreData, setCoreData] = useState({
    date: "",
    start_time: "",
    end_time: "",
    duration_hours: "",
    employee_id: "",
    location: "",
    service_authorization_id: entryType?.requires_authorization ? "" : null,
    employer_name: "",
    general_notes: ""
  });
  const [coreErrors, setCoreErrors] = useState({});
  const [employees, setEmployees] = useState([]);
  const [authorizations, setAuthorizations] = useState([]);

  // Dynamic reportable field answers
  const [answers, setAnswers] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});

  const [saving, setSaving] = useState(false);

  // ── Load entry types and employees ────────────────────────────────────────

  useEffect(() => {
    // Load entry types
    base44.entities.EntryType.filter({ is_active: true })
      .then(setEntryTypes)
      .catch(() => toast.error("Failed to load entry types"))
      .finally(() => setLoadingTypes(false));

    // Load employees (staff)
    base44.entities.User.filter({ role: "employee" })
      .then(setEmployees)
      .catch(() => setEmployees([]));
  }, []);

  useEffect(() => {
    if (!entryType) return;
    setLoadingFields(true);
    setTemplates([]);
    setAnswers({});
    setFieldErrors({});
    
    // Load field templates
    base44.entities.ReportFieldTemplate.filter({ entry_type_id: entryType.id, is_active: true })
      .then(t => setTemplates(t.sort((a, b) => (a.order || 0) - (b.order || 0))))
      .catch(() => toast.error("Failed to load form fields"))
      .finally(() => setLoadingFields(false));

    // Load available service authorizations for this entry type
    if (entryType.requires_authorization && clientId) {
      base44.entities.ServiceAuthorization.filter({
        client_id: clientId,
        entry_type_code: entryType.code,
        status: "active"
      })
        .then(setAuthorizations)
        .catch(() => setAuthorizations([]));
    }
  }, [entryType?.id, clientId]);

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
    if (!coreData.employee_id) errs.employee_id = "Employee is required";
    if (!coreData.start_time && !coreData.duration_hours) errs.time = "Either duration or start/end times required";
    if (coreData.duration_hours) {
      if (isNaN(Number(coreData.duration_hours)) || Number(coreData.duration_hours) <= 0)
        errs.duration_hours = "Duration must be a positive number";
    }
    if (entryType?.requires_authorization && !coreData.service_authorization_id) {
      errs.service_authorization_id = "Service authorization required for this entry type";
    }
    if (entryType?.requires_employer && !coreData.employer_name) {
      errs.employer_name = "Employer name required for this entry type";
    }
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
      const durationMinutes = coreData.start_time && coreData.end_time
        ? Math.round(((new Date(`2000-01-01T${coreData.end_time}`) - new Date(`2000-01-01T${coreData.start_time}`)) / 1000) / 60)
        : Math.round(Number(coreData.duration_hours) * 60);

      const timeEntry = await base44.entities.TimeEntry.create({
        // ── Legacy fields ──
        client_id:        clientId,
        date:             coreData.date,
        start_time:       coreData.start_time || null,
        end_time:         coreData.end_time || null,
        duration_minutes: durationMinutes,
        location:         coreData.location || null,
        employee_id:      coreData.employee_id,
        service_authorization_id: coreData.service_authorization_id || null,
        employer_name:    coreData.employer_name || null,
        description:      coreData.general_notes || "",
        // ── New schema fields ──
        entry_type_id:       entryType.id,
        entry_type_code:     entryType.code,
        reporting_period_key: reportingPeriodKey,
        status:              isDraft ? "draft" : "submitted",
        is_reportable:       entryType.report_mode !== "none",
        is_billable:         entryType.is_billable ?? false,
        is_payroll_eligible: entryType.is_payroll_eligible ?? true,
        report_ready:        false
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
    setCoreData({
      date: "",
      start_time: "",
      end_time: "",
      duration_hours: "",
      employee_id: "",
      location: "",
      service_authorization_id: null,
      employer_name: "",
      general_notes: ""
    });
    setCoreErrors({});
    setAnswers({});
    setFieldErrors({});
    setEmployees([]);
    setAuthorizations([]);
  }

  // ── STEP 1: Select entry type ─────────────────────────────────────────────

  if (step === "select_type") {
    if (loadingTypes) return <LoadingCard label="Loading entry types..." />;
    return (
      <Card className="p-6 space-y-4">
        <div>
          <h3 className="font-semibold text-base">Step 1 of 4: Select Entry Type</h3>
          <p className="text-xs text-slate-500 mt-1">What type of service was provided?</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {entryTypes.map(et => (
            <button
              key={et.id}
              onClick={() => { setEntryType(et); setStep("core_fields"); }}
              className="p-4 text-left rounded-lg border-2 border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-all"
              style={{ borderColor: et.color ? et.color + "80" : undefined }}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-sm">{et.name}</p>
                  {et.description && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{et.description}</p>}
                  <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
                    {et.is_billable && <Badge className="bg-blue-100 text-blue-700">Billable</Badge>}
                    {et.is_payroll_eligible && <Badge className="bg-emerald-100 text-emerald-700">Payroll</Badge>}
                  </div>
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

  // ── STEP 2: Core fields ───────────────────────────────────────────────────

  if (step === "core_fields") {
    return (
      <Card className="p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-base">Step 2 of 4: Time Entry Details</h3>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
              <span className="font-medium">{entryType.name}</span>
              {entryType.color && (
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entryType.color }} />
              )}
            </p>
          </div>
          <button
            onClick={() => { setEntryType(null); setStep("select_type"); }}
            className="text-xs text-slate-500 hover:text-slate-800 underline"
          >
            Change Type
          </button>
        </div>

        {/* Client (always shown) */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">Client <span className="text-red-500">*</span></Label>
          <div className="p-2.5 bg-slate-50 rounded-lg text-sm text-slate-600">
            {clients.find(c => c.id === clientId)?.first_name} {clients.find(c => c.id === clientId)?.last_name}
          </div>
        </div>

        {/* Employee */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Employee <span className="text-red-500">*</span></Label>
          <Select value={coreData.employee_id} onValueChange={val => setCoreData(p => ({ ...p, employee_id: val }))}>
            <SelectTrigger className={coreErrors.employee_id ? "border-red-500" : ""}>
              <SelectValue placeholder="Select employee..." />
            </SelectTrigger>
            <SelectContent>
              {employees.map(emp => (
                <SelectItem key={emp.id} value={emp.id}>{emp.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {coreErrors.employee_id && <p className="text-xs text-red-500">{coreErrors.employee_id}</p>}
        </div>

        {/* Service Authorization (if required) */}
        {entryType?.requires_authorization && (
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Service Authorization <span className="text-red-500">*</span></Label>
            <Select value={coreData.service_authorization_id || ""} onValueChange={val => setCoreData(p => ({ ...p, service_authorization_id: val }))}>
              <SelectTrigger className={coreErrors.service_authorization_id ? "border-red-500" : ""}>
                <SelectValue placeholder="Select authorization..." />
              </SelectTrigger>
              <SelectContent>
                {authorizations.map(auth => (
                  <SelectItem key={auth.id} value={auth.id}>
                    {auth.authorization_number} - {auth.job_goal}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {coreErrors.service_authorization_id && <p className="text-xs text-red-500">{coreErrors.service_authorization_id}</p>}
          </div>
        )}

        {/* Date, Start Time, End Time, Location */}
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
            <Label className="text-xs font-medium">Location</Label>
            <Input
              value={coreData.location}
              onChange={e => setCoreData(p => ({ ...p, location: e.target.value }))}
              placeholder="e.g. Client's workplace"
            />
          </div>
        </div>

        {/* Duration: Start/End Time OR Hours */}
        <div className="space-y-2 p-3 bg-slate-50 rounded-lg">
          <p className="text-xs font-medium text-slate-600">Duration</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-slate-600">Start Time</Label>
              <Input
                type="time"
                value={coreData.start_time}
                onChange={e => setCoreData(p => ({ ...p, start_time: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-600">End Time</Label>
              <Input
                type="time"
                value={coreData.end_time}
                onChange={e => setCoreData(p => ({ ...p, end_time: e.target.value }))}
              />
            </div>
          </div>
          <p className="text-xs text-slate-400">OR</p>
          <div className="space-y-1">
            <Label className="text-xs text-slate-600">Duration (hours)</Label>
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

        {/* Employer (if required) */}
        {entryType?.requires_employer && (
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Employer <span className="text-red-500">*</span></Label>
            <Input
              value={coreData.employer_name}
              onChange={e => setCoreData(p => ({ ...p, employer_name: e.target.value }))}
              placeholder="Employer name"
              className={coreErrors.employer_name ? "border-red-500" : ""}
            />
            {coreErrors.employer_name && <p className="text-xs text-red-500">{coreErrors.employer_name}</p>}
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-2 pt-2 border-t border-slate-200">
          <Button variant="outline" onClick={() => { setEntryType(null); setStep("select_type"); }} className="flex-none">
            Back
          </Button>
          <Button
            onClick={() => {
              if (validateCore()) setStep("dynamic_fields");
            }}
            className="flex-1"
          >
            Next <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </Card>
    );
  }

  // ── STEP 3: Dynamic reportable fields ────────────────────────────────────

  if (step === "dynamic_fields") {
    if (loadingFields) return <LoadingCard label="Loading form fields..." />;
    return (
      <Card className="p-6 space-y-5">
        <div>
          <h3 className="font-semibold text-base">Step 3 of 4: Service Details</h3>
          <p className="text-xs text-slate-500 mt-1">Complete any additional required fields for this service type</p>
        </div>

        {/* Reportable Fields (from ReportFieldTemplate, grouped by section) */}
        {reportableFields.length === 0 ? (
          <div className="p-4 bg-slate-50 rounded-lg text-sm text-slate-600 text-center">
            No additional fields required for <strong>{entryType.name}</strong>
          </div>
        ) : (
          Object.entries(groupedReportable).map(([section, sectionFields]) => (
            <div key={section} className="space-y-3 pb-3 border-b border-slate-100 last:border-0">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{section}</h4>
                <span className="text-xs text-slate-400">
                  {sectionFields.filter(f => f.is_required).length > 0 && "(includes required fields)"}
                </span>
              </div>
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
          ))
        )}

        {/* Internal Notes (not in report) */}
        <div className="space-y-2 pt-2">
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

        {/* Completion indicator */}
        {reportableFields.length > 0 && (
          <CompletionBar
            reportableFields={reportableFields}
            answers={answers}
          />
        )}

        {/* Navigation */}
        <div className="flex gap-2 pt-2 border-t border-slate-200">
          <Button variant="outline" onClick={() => setStep("core_fields")} className="flex-none">
            Back
          </Button>
          <Button
            onClick={() => setStep("review")}
            className="flex-1"
          >
            Review <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </Card>
    );
  }

  // ── STEP 4: Review + Save ─────────────────────────────────────────────────

  if (step === "review") {
    const reportable = reportableFields.filter(f => !INTERNAL_KEYS.has(f.field_key));
    const requiredFields = reportable.filter(f => f.is_required);
    const completedRequired = requiredFields.filter(f => answers[f.field_key]);
    const reportReady = completedRequired.length === requiredFields.length;

    return (
      <Card className="p-6 space-y-5">
        <div>
          <h3 className="font-semibold text-base">Step 4 of 4: Review & Submit</h3>
          <p className="text-xs text-slate-500 mt-1">Verify your entry before submitting</p>
        </div>

        {/* Entry Status Summary */}
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-blue-900">{entryType.name}</span>
            <div className="flex gap-1">
              {entryType.is_billable && <Badge className="bg-blue-600 text-white text-xs">Billable</Badge>}
              {entryType.is_payroll_eligible && <Badge className="bg-emerald-600 text-white text-xs">Payroll</Badge>}
              {entryType.report_mode !== "none" && <Badge className="bg-purple-600 text-white text-xs">Reportable</Badge>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-blue-800">
            <div>
              <p className="font-medium">Date</p>
              <p>{coreData.date}</p>
            </div>
            <div>
              <p className="font-medium">Duration</p>
              <p>
                {coreData.start_time && coreData.end_time
                  ? `${coreData.start_time} - ${coreData.end_time}`
                  : `${coreData.duration_hours} hours`
                }
              </p>
            </div>
            {coreData.location && (
              <div className="col-span-2">
                <p className="font-medium">Location</p>
                <p>{coreData.location}</p>
              </div>
            )}
          </div>
        </div>

        {/* Fields Summary */}
        {reportable.length > 0 && (
          <div className="space-y-3 border-t pt-4">
            <h4 className="text-xs font-semibold text-slate-600">Submitted Fields</h4>
            <div className="space-y-2">
              {reportable.filter(f => answers[f.field_key]).map(f => (
                <div key={f.id} className="flex justify-between text-xs py-1.5 px-2 bg-slate-50 rounded">
                  <span className="font-medium text-slate-700">{f.label}</span>
                  <span className="text-slate-600 text-right max-w-xs truncate">{String(answers[f.field_key])}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Report Ready Status */}
        <div className={cn("p-3 rounded-lg border", reportReady ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200")}>
          <div className="flex items-start gap-2">
            {reportReady ? (
              <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            )}
            <div>
              <p className={cn("text-sm font-medium", reportReady ? "text-green-800" : "text-amber-800")}>
                {reportReady ? "Report Ready" : "Not Yet Report Ready"}
              </p>
              {!reportReady && requiredFields.length > 0 && (
                <p className="text-xs text-amber-700 mt-1">
                  Missing: {requiredFields.filter(f => !answers[f.field_key]).map(f => f.label).join(", ")}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t border-slate-200">
          <Button variant="outline" onClick={() => setStep("dynamic_fields")} className="flex-none">
            Back
          </Button>
          <Button
            variant="outline"
            onClick={() => save(true)}
            disabled={saving}
            className="flex-1 border-amber-200 text-amber-700 hover:bg-amber-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
            Save Draft
          </Button>
          <Button
            onClick={() => save(false)}
            disabled={saving || (reportable.length > 0 && !reportReady)}
            className="flex-1"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
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