import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ArrowRight, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function VRTimeEntryForm({ clientId, onSuccess }) {
  const [step, setStep] = useState("entry_type"); // entry_type | core_fields | type_fields | review
  const [entryType, setEntryType] = useState(null);
  const [entryTypes, setEntryTypes] = useState([]);
  const [templateFields, setTemplateFields] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form data
  const [coreData, setCoreData] = useState({
    employee_id: "",
    date_of_service: new Date().toISOString().split("T")[0],
    start_time: "",
    end_time: "",
    location_of_service: "",
    general_notes: "",
  });

  const [typeData, setTypeData] = useState({});
  const [errors, setErrors] = useState({});

  // Load entry types on mount
  useEffect(() => {
    async function load() {
      try {
        const types = await base44.entities.EntryType.list();
        setEntryTypes(types.filter(t => t.is_active));
      } catch (e) {
        toast.error("Failed to load entry types");
      }
    }
    load();
  }, []);

  // Load template fields when entry type selected
  useEffect(() => {
    if (!entryType) return;

    async function load() {
      setLoading(true);
      try {
        const fields = await base44.entities.ReportFieldTemplate.filter({
          entry_type_code: entryType.code,
        });
        // Sort by section, then order
        fields.sort((a, b) => {
          if (a.section !== b.section) return (a.section || "").localeCompare(b.section || "");
          return (a.order || 0) - (b.order || 0);
        });
        setTemplateFields(fields);
        setTypeData({});
        setErrors({});
      } catch (e) {
        toast.error("Failed to load fields");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [entryType]);

  // Calculate duration in hours
  const calculateDuration = () => {
    if (!coreData.start_time || !coreData.end_time) return 0;
    const [startH, startM] = coreData.start_time.split(":").map(Number);
    const [endH, endM] = coreData.end_time.split(":").map(Number);
    const startMins = startH * 60 + startM;
    const endMins = endH * 60 + endM;
    return Math.max(0, (endMins - startMins) / 60);
  };

  // Validate required fields in current step
  const validateStep = () => {
    const newErrors = {};

    if (step === "core_fields") {
      if (!coreData.employee_id.trim()) newErrors.employee_id = "Required";
      if (!coreData.date_of_service) newErrors.date_of_service = "Required";
      if (!coreData.start_time) newErrors.start_time = "Required";
      if (!coreData.end_time) newErrors.end_time = "Required";
      if (!coreData.location_of_service.trim()) newErrors.location_of_service = "Required";
    }

    if (step === "type_fields") {
      templateFields.forEach((field) => {
        if (field.is_required && !typeData[field.field_key]) {
          newErrors[field.field_key] = "Required";
        }
      });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCoreChange = (key, value) => {
    setCoreData(p => ({ ...p, [key]: value }));
    if (errors[key]) setErrors(p => ({ ...p, [key]: null }));
  };

  const handleTypeDataChange = (fieldKey, value) => {
    setTypeData(p => ({ ...p, [fieldKey]: value }));
    if (errors[fieldKey]) setErrors(p => ({ ...p, [fieldKey]: null }));
  };

  const handleNextStep = () => {
    if (!validateStep()) return;

    if (step === "entry_type") {
      setStep("core_fields");
    } else if (step === "core_fields") {
      setStep("type_fields");
    } else if (step === "type_fields") {
      setStep("review");
    }
  };

  const handleSubmit = async () => {
    if (!validateStep()) return;

    setSubmitting(true);
    try {
      // Create ReportFieldAnswer for structured fields
      const fieldAnswers = templateFields.reduce((acc, f) => {
        if (typeData[f.field_key] !== undefined) {
          acc[f.field_key] = typeData[f.field_key];
        }
        return acc;
      }, {});

      // Create TimeEntry — dual-write legacy + new schema fields
      const duration = calculateDuration();
      const durationMinutes = Math.round(duration * 60);
      const reportingPeriodKey = coreData.date_of_service ? coreData.date_of_service.slice(0, 7) : null;
      
      const timeEntry = await base44.entities.TimeEntry.create({
        // ── Legacy fields (preserve existing reads) ──
        org_id: null,
        client_id: clientId || null,
        date: coreData.date_of_service,
        start_time: coreData.start_time,
        end_time: coreData.end_time,
        duration_minutes: durationMinutes,
        description: coreData.location_of_service,
        category: entryType.code,
        legacy_category: entryType.code,
        ...(coreData.general_notes && { general_notes: coreData.general_notes }),
        // ── New schema fields (dual-write) ──
        entry_type_id: entryType.id,
        entry_type_code: entryType.code,
        reporting_period_key: reportingPeriodKey,
        status: "submitted",
        is_reportable: entryType.report_mode !== "none",
        is_billable: entryType.is_billable ?? false,
        is_payroll_eligible: entryType.is_payroll_eligible ?? true,
        report_ready: false,
      });

      // Create ReportFieldAnswer
      await base44.entities.ReportFieldAnswer.create({
        org_id: null,
        time_entry_id: timeEntry.id,
        entry_type_id: entryType.id,
        entry_type_code: entryType.code,
        answers: fieldAnswers,
        is_complete: true,
        submitted_at: new Date().toISOString(),
      });

      toast.success(`${entryType.name} entry saved successfully`);
      if (onSuccess) onSuccess(timeEntry);

      // Reset form
      setStep("entry_type");
      setEntryType(null);
      setCoreData({
        employee_id: "",
        date_of_service: new Date().toISOString().split("T")[0],
        start_time: "",
        end_time: "",
        location_of_service: "",
        general_notes: "",
      });
      setTypeData({});
    } catch (e) {
      toast.error("Failed to save entry: " + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const duration = calculateDuration();

  // ── STEP 1: SELECT ENTRY TYPE ──
  if (step === "entry_type") {
    return (
      <Card className="p-6 space-y-4">
        <h3 className="text-lg font-semibold">Step 1: Select Entry Type</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {entryTypes.map((type) => (
            <button
              key={type.id}
              onClick={() => setEntryType(type)}
              className={cn(
                "p-4 text-left rounded-lg border-2 transition-all",
                "hover:border-blue-500 hover:bg-blue-50",
                entryType?.id === type.id ? "border-blue-600 bg-blue-50" : "border-slate-200"
              )}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-sm">{type.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{type.description}</p>
                </div>
                <div
                  className="w-3 h-3 rounded-full border-2 shrink-0 mt-1"
                  style={{
                    borderColor: type.color,
                    backgroundColor: entryType?.id === type.id ? type.color : "transparent",
                  }}
                />
              </div>
            </button>
          ))}
        </div>
        <Button onClick={handleNextStep} disabled={!entryType} className="w-full">
          Continue to Core Fields <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </Card>
    );
  }

  // ── STEP 2: CORE FIELDS ──
  if (step === "core_fields") {
    return (
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Step 2: Core Information</h3>
          <button
            onClick={() => setStep("entry_type")}
            className="text-xs text-slate-500 hover:text-slate-700 underline"
          >
            Change Type
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Employee ID *</Label>
            <Input
              value={coreData.employee_id}
              onChange={(e) => handleCoreChange("employee_id", e.target.value)}
              placeholder="Your employee/staff ID"
              className={errors.employee_id ? "border-red-500" : ""}
            />
            {errors.employee_id && <p className="text-xs text-red-500">{errors.employee_id}</p>}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Date of Service *</Label>
            <Input
              type="date"
              value={coreData.date_of_service}
              onChange={(e) => handleCoreChange("date_of_service", e.target.value)}
              className={errors.date_of_service ? "border-red-500" : ""}
            />
            {errors.date_of_service && <p className="text-xs text-red-500">{errors.date_of_service}</p>}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Start Time *</Label>
            <Input
              type="time"
              value={coreData.start_time}
              onChange={(e) => handleCoreChange("start_time", e.target.value)}
              className={errors.start_time ? "border-red-500" : ""}
            />
            {errors.start_time && <p className="text-xs text-red-500">{errors.start_time}</p>}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">End Time *</Label>
            <Input
              type="time"
              value={coreData.end_time}
              onChange={(e) => handleCoreChange("end_time", e.target.value)}
              className={errors.end_time ? "border-red-500" : ""}
            />
            {errors.end_time && <p className="text-xs text-red-500">{errors.end_time}</p>}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Location of Service *</Label>
            <Input
              value={coreData.location_of_service}
              onChange={(e) => handleCoreChange("location_of_service", e.target.value)}
              placeholder="Where service was delivered"
              className={errors.location_of_service ? "border-red-500" : ""}
            />
            {errors.location_of_service && <p className="text-xs text-red-500">{errors.location_of_service}</p>}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Duration</Label>
            <div className="flex items-center h-9 px-3 border border-slate-300 rounded-md bg-slate-50 text-sm">
              {duration.toFixed(2)} hours
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">General Notes (optional)</Label>
          <Textarea
            value={coreData.general_notes}
            onChange={(e) => handleCoreChange("general_notes", e.target.value)}
            placeholder="Non-reportable notes about this entry"
            className="min-h-[80px] resize-none"
          />
          <p className="text-xs text-slate-400">Note: This field is for internal reference only and will not appear in VR reports</p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setStep("entry_type")} className="flex-1">
            Back
          </Button>
          <Button onClick={handleNextStep} className="flex-1">
            Continue to {entryType?.name} Fields <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </Card>
    );
  }

  // ── STEP 3: TYPE-SPECIFIC FIELDS ──
  if (step === "type_fields") {
    // Group fields by section
    const sections = {};
    templateFields.forEach((f) => {
      const section = f.section || "Other";
      if (!sections[section]) sections[section] = [];
      sections[section].push(f);
    });

    return (
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Step 3: {entryType?.name} Details</h3>
          <button
            onClick={() => setStep("core_fields")}
            className="text-xs text-slate-500 hover:text-slate-700 underline"
          >
            Edit Core Fields
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        ) : templateFields.length === 0 ? (
          <div className="flex items-center gap-2 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-800">No additional fields required for this entry type</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(sections).map(([section, fields]) => (
              <div key={section} className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{section}</h4>
                <div className="space-y-3">
                  {fields.map((field) => (
                    <FieldInput
                      key={field.id}
                      field={field}
                      value={typeData[field.field_key] || ""}
                      error={errors[field.field_key]}
                      onChange={(val) => handleTypeDataChange(field.field_key, val)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setStep("core_fields")} className="flex-1">
            Back
          </Button>
          <Button onClick={handleNextStep} className="flex-1">
            Review & Submit <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </Card>
    );
  }

  // ── STEP 4: REVIEW ──
  if (step === "review") {
    return (
      <Card className="p-6 space-y-4">
        <h3 className="text-lg font-semibold">Review & Submit</h3>

        <div className="space-y-4 bg-slate-50 rounded-lg p-4">
          <div>
            <p className="text-xs font-semibold text-slate-600 uppercase">Entry Type</p>
            <p className="text-sm font-medium">{entryType?.name}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-slate-600 uppercase">Date</p>
              <p className="text-sm">{coreData.date_of_service}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-600 uppercase">Duration</p>
              <p className="text-sm">{duration.toFixed(2)} hours</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-600 uppercase">Time</p>
              <p className="text-sm">{coreData.start_time} - {coreData.end_time}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-600 uppercase">Location</p>
              <p className="text-sm">{coreData.location_of_service}</p>
            </div>
          </div>
        </div>

        {Object.keys(typeData).length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-600 uppercase">Captured Fields</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              {Object.entries(typeData).map(([key, value]) => {
                const field = templateFields.find(f => f.field_key === key);
                return (
                  <div key={key} className="flex items-start gap-2 p-2 bg-slate-100 rounded">
                    <span className="shrink-0 text-slate-500">✓</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-700">{field?.label}</p>
                      <p className="text-slate-600 break-words line-clamp-2">
                        {Array.isArray(value) ? value.join(", ") : String(value)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setStep("type_fields")} className="flex-1">
            Back
          </Button>
          <Button onClick={handleSubmit} disabled={submitting} className="flex-1">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Submit Entry
          </Button>
        </div>
      </Card>
    );
  }
}

// ── FIELD INPUT COMPONENT ──
function FieldInput({ field, value, error, onChange }) {
  const isRequired = field.is_required;

  if (field.field_type === "text") {
    return (
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">
          {field.label}
          {isRequired && <span className="text-red-500 ml-1">*</span>}
        </Label>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={error ? "border-red-500" : ""}
        />
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    );
  }

  if (field.field_type === "number") {
    return (
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">
          {field.label}
          {isRequired && <span className="text-red-500 ml-1">*</span>}
        </Label>
        <Input
          type="number"
          step="0.01"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={error ? "border-red-500" : ""}
        />
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    );
  }

  if (field.field_type === "textarea") {
    return (
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">
          {field.label}
          {isRequired && <span className="text-red-500 ml-1">*</span>}
        </Label>
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={`resize-none min-h-[80px] ${error ? "border-red-500" : ""}`}
        />
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    );
  }

  if (field.field_type === "select") {
    return (
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">
          {field.label}
          {isRequired && <span className="text-red-500 ml-1">*</span>}
        </Label>
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className={error ? "border-red-500" : ""}>
            <SelectValue placeholder="Select an option" />
          </SelectTrigger>
          <SelectContent>
            {(field.options || []).map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    );
  }

  if (field.field_type === "multiselect") {
    const selected = Array.isArray(value) ? value : [];
    return (
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">
          {field.label}
          {isRequired && <span className="text-red-500 ml-1">*</span>}
        </Label>
        <div className="space-y-2 p-3 border border-slate-300 rounded-md bg-white">
          {(field.options || []).map((opt) => (
            <label key={opt} className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={selected.includes(opt)}
                onCheckedChange={(checked) => {
                  const newVal = checked ? [...selected, opt] : selected.filter(s => s !== opt);
                  onChange(newVal);
                }}
              />
              <span className="text-sm">{opt}</span>
            </label>
          ))}
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    );
  }

  if (field.field_type === "boolean") {
    return (
      <div className="flex items-center gap-2">
        <Checkbox
          checked={!!value}
          onCheckedChange={(checked) => onChange(checked)}
        />
        <Label className="text-xs font-medium cursor-pointer">
          {field.label}
          {isRequired && <span className="text-red-500 ml-1">*</span>}
        </Label>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    );
  }

  if (field.field_type === "date") {
    return (
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">
          {field.label}
          {isRequired && <span className="text-red-500 ml-1">*</span>}
        </Label>
        <Input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={error ? "border-red-500" : ""}
        />
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    );
  }

  if (field.field_type === "time") {
    return (
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">
          {field.label}
          {isRequired && <span className="text-red-500 ml-1">*</span>}
        </Label>
        <Input
          type="time"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={error ? "border-red-500" : ""}
        />
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    );
  }

  return null;
}