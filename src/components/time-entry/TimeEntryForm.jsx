import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ChevronRight, ChevronLeft, Check, Clock, User, Calendar, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

const STEPS = [
  { id: "basics", label: "Basics", icon: Calendar },
  { id: "type",   label: "Entry Type", icon: FileText },
  { id: "details", label: "Details", icon: Clock },
];

function StepIndicator({ steps, currentStep }) {
  return (
    <div className="flex items-center gap-1 mb-6">
      {steps.map((step, idx) => {
        const currentIdx = steps.findIndex(s => s.id === currentStep);
        const done = idx < currentIdx;
        const active = idx === currentIdx;
        return (
          <React.Fragment key={step.id}>
            <div className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
              done   ? "bg-emerald-100 text-emerald-700" :
              active ? "bg-blue-600 text-white shadow-md shadow-blue-400/30" :
                       "bg-slate-100 text-slate-400"
            )}>
              {done ? <Check className="w-3 h-3" /> : <step.icon className="w-3 h-3" />}
              {step.label}
            </div>
            {idx < steps.length - 1 && <div className={cn("flex-1 h-px", done ? "bg-emerald-200" : "bg-slate-200")} />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function FieldRenderer({ field, value, onChange }) {
  const handleChange = (val) => onChange(field.field_key, val);

  switch (field.field_type) {
    case "textarea":
      return (
        <textarea
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none h-24"
          placeholder={field.placeholder || ""}
          value={value || ""}
          onChange={e => handleChange(e.target.value)}
        />
      );
    case "number":
      return (
        <Input
          type="number"
          placeholder={field.placeholder || ""}
          value={value || ""}
          onChange={e => handleChange(e.target.value)}
        />
      );
    case "date":
      return (
        <Input
          type="date"
          value={value || ""}
          onChange={e => handleChange(e.target.value)}
        />
      );
    case "time":
      return (
        <Input
          type="time"
          value={value || ""}
          onChange={e => handleChange(e.target.value)}
        />
      );
    case "boolean":
    case "checkbox":
      return (
        <div className="flex items-center gap-2">
          <Checkbox
            id={field.field_key}
            checked={!!value}
            onCheckedChange={handleChange}
          />
          <Label htmlFor={field.field_key} className="text-sm font-normal text-slate-600">
            {field.placeholder || "Yes"}
          </Label>
        </div>
      );
    case "select":
      return (
        <Select value={value || ""} onValueChange={handleChange}>
          <SelectTrigger><SelectValue placeholder={field.placeholder || "Select..."} /></SelectTrigger>
          <SelectContent>
            {(field.options || []).map(opt => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "multiselect":
      return (
        <div className="flex flex-wrap gap-2">
          {(field.options || []).map(opt => {
            const selected = Array.isArray(value) ? value.includes(opt) : false;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  const arr = Array.isArray(value) ? [...value] : [];
                  handleChange(selected ? arr.filter(v => v !== opt) : [...arr, opt]);
                }}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs border transition-all",
                  selected
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-slate-600 border-slate-200 hover:border-blue-400"
                )}
              >
                {opt}
              </button>
            );
          })}
        </div>
      );
    default:
      return (
        <Input
          placeholder={field.placeholder || ""}
          value={value || ""}
          onChange={e => handleChange(e.target.value)}
        />
      );
  }
}

export default function TimeEntryForm({ clients, onSaved, onCancel }) {
  const [step, setStep] = useState("basics");
  const [saving, setSaving] = useState(false);

  // Step 1: core fields
  const [clientId, setClientId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [description, setDescription] = useState("");

  // Step 2: entry type
  const [entryTypes, setEntryTypes] = useState([]);
  const [selectedEntryType, setSelectedEntryType] = useState(null);
  const [loadingTypes, setLoadingTypes] = useState(true);

  // Step 3: dynamic fields
  const [fieldTemplates, setFieldTemplates] = useState([]);
  const [loadingFields, setLoadingFields] = useState(false);
  const [answers, setAnswers] = useState({});

  useEffect(() => {
    base44.entities.EntryType.filter({ is_active: true }, "name")
      .then(types => setEntryTypes(types))
      .catch(() => setEntryTypes([]))
      .finally(() => setLoadingTypes(false));
  }, []);

  useEffect(() => {
    if (!selectedEntryType) { setFieldTemplates([]); return; }
    setLoadingFields(true);
    base44.entities.ReportFieldTemplate.filter(
      { entry_type_id: selectedEntryType.id, is_active: true },
      "order"
    )
      .then(fields => setFieldTemplates(fields))
      .catch(() => setFieldTemplates([]))
      .finally(() => setLoadingFields(false));
  }, [selectedEntryType?.id]);

  const duration = useMemo(() => {
    if (!startTime || !endTime) return 0;
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    return (eh * 60 + em) - (sh * 60 + sm);
  }, [startTime, endTime]);

  const handleAnswerChange = (key, val) => setAnswers(prev => ({ ...prev, [key]: val }));

  // Validate current step
  const canProceed = useMemo(() => {
    if (step === "basics") return clientId && date && startTime && endTime && duration > 0;
    if (step === "type")   return !!selectedEntryType;
    return true;
  }, [step, clientId, date, startTime, endTime, duration, selectedEntryType]);

  // Validate required dynamic fields
  const missingRequired = useMemo(() => {
    return fieldTemplates.filter(f => f.is_required && !answers[f.field_key] && answers[f.field_key] !== false);
  }, [fieldTemplates, answers]);

  // Group fields by section
  const fieldsBySection = useMemo(() => {
    const groups = {};
    fieldTemplates.forEach(f => {
      const sec = f.section || "";
      if (!groups[sec]) groups[sec] = [];
      groups[sec].push(f);
    });
    return groups;
  }, [fieldTemplates]);

  const handleSave = async () => {
    if (missingRequired.length > 0) {
      toast.error(`Please fill in: ${missingRequired.map(f => f.label).join(", ")}`);
      return;
    }
    setSaving(true);
    const actualClientId = clientId?.startsWith("self:") ? null : clientId;

    const timeEntry = await base44.entities.TimeEntry.create({
      client_id: actualClientId,
      date,
      start_time: startTime,
      end_time: endTime,
      duration_minutes: duration,
      description: description || selectedEntryType?.name || "Session",
      category: selectedEntryType?.code || "other",
      entry_type_id: selectedEntryType?.id,
    });

    // Save dynamic field answers
    if (Object.keys(answers).length > 0 && selectedEntryType) {
      await base44.entities.ReportFieldAnswer.create({
        time_entry_id: timeEntry.id,
        entry_type_id: selectedEntryType.id,
        entry_type_code: selectedEntryType.code,
        answers,
        is_complete: missingRequired.length === 0,
        submitted_at: new Date().toISOString(),
      });
    }

    // Also create matching meeting
    await base44.entities.Meeting.create({
      client_id: actualClientId,
      title: description || selectedEntryType?.name || "Session",
      meeting_type: selectedEntryType?.code || "other",
      start_datetime: `${date}T${startTime}`,
      end_datetime: `${date}T${endTime}`,
      status: "completed",
    });

    toast.success("Time entry saved");
    setSaving(false);
    if (onSaved) onSaved();
  };

  const goNext = () => {
    if (step === "basics") setStep("type");
    else if (step === "type") setStep("details");
  };

  const goBack = () => {
    if (step === "type") setStep("basics");
    else if (step === "details") setStep("type");
  };

  return (
    <div className="space-y-4">
      <StepIndicator steps={STEPS} currentStep={step} />

      {/* STEP 1: Basics */}
      {step === "basics" && (
        <div className="space-y-4">
          <div>
            <Label className="text-xs text-slate-500 mb-1 block">Client <span className="text-red-400">*</span></Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger><SelectValue placeholder="Select client..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="self:true">👤 Myself (no client)</SelectItem>
                {clients.filter(c => c.status === "active" && !c.is_archived).map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs text-slate-500 mb-1 block">Date <span className="text-red-400">*</span></Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-slate-500 mb-1 block">Start Time <span className="text-red-400">*</span></Label>
              <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-slate-500 mb-1 block">End Time <span className="text-red-400">*</span></Label>
              <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
            </div>
          </div>

          {duration > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg text-sm text-blue-700">
              <Clock className="w-4 h-4" />
              <span className="font-medium">{duration} minutes</span>
              <span className="text-blue-500">({Math.round(duration / 60 * 10) / 10} hrs)</span>
            </div>
          )}
          {duration < 0 && (
            <p className="text-xs text-red-500">End time must be after start time</p>
          )}

          <div>
            <Label className="text-xs text-slate-500 mb-1 block">Notes (optional)</Label>
            <Input
              placeholder="Brief description..."
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* STEP 2: Entry Type */}
      {step === "type" && (
        <div className="space-y-3">
          <p className="text-sm text-slate-500">What type of service was provided?</p>
          {loadingTypes ? (
            <div className="flex items-center gap-2 text-sm text-slate-400 py-4">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading types...
            </div>
          ) : entryTypes.length === 0 ? (
            <div className="p-4 bg-amber-50 rounded-lg text-sm text-amber-700">
              No entry types configured yet. Please add Entry Types in the database first.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {entryTypes.map(et => (
                <button
                  key={et.id}
                  type="button"
                  onClick={() => setSelectedEntryType(et)}
                  className={cn(
                    "w-full text-left px-4 py-3 rounded-xl border-2 transition-all",
                    selectedEntryType?.id === et.id
                      ? "border-blue-500 bg-blue-50 text-blue-800"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: et.color || "#64748b" }}
                    />
                    <div>
                      <p className="text-sm font-semibold">{et.name}</p>
                      {et.description && <p className="text-xs text-slate-500 mt-0.5">{et.description}</p>}
                    </div>
                    {selectedEntryType?.id === et.id && (
                      <Check className="w-4 h-4 text-blue-600 ml-auto" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* STEP 3: Dynamic Details */}
      {step === "details" && (
        <div className="space-y-5">
          {loadingFields ? (
            <div className="flex items-center gap-2 text-sm text-slate-400 py-4">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading questions...
            </div>
          ) : fieldTemplates.length === 0 ? (
            <div className="p-4 bg-slate-50 rounded-lg text-sm text-slate-500 text-center">
              No additional fields required for <strong>{selectedEntryType?.name}</strong>. Ready to save.
            </div>
          ) : (
            Object.entries(fieldsBySection).map(([section, fields]) => (
              <div key={section} className="space-y-3">
                {section && (
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1">
                    {section}
                  </p>
                )}
                {fields.map(field => (
                  <div key={field.field_key} className="space-y-1">
                    <Label className="text-sm text-slate-700">
                      {field.label}
                      {field.is_required && <span className="text-red-400 ml-1">*</span>}
                    </Label>
                    {field.help_text && (
                      <p className="text-xs text-slate-400">{field.help_text}</p>
                    )}
                    <FieldRenderer
                      field={field}
                      value={answers[field.field_key]}
                      onChange={handleAnswerChange}
                    />
                  </div>
                ))}
              </div>
            ))
          )}

          {/* Summary banner */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-500 space-y-1">
            <p className="font-medium text-slate-600">Entry Summary</p>
            <p>Type: <span className="text-slate-800 font-medium">{selectedEntryType?.name}</span></p>
            <p>Duration: <span className="text-slate-800 font-medium">{duration} min</span> on <span className="text-slate-800 font-medium">{date}</span></p>
            <p>Time: <span className="text-slate-800 font-medium">{startTime} – {endTime}</span></p>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-4 border-t border-slate-100">
        {step !== "basics" ? (
          <Button variant="outline" size="sm" onClick={goBack}>
            <ChevronLeft className="w-4 h-4 mr-1" /> Back
          </Button>
        ) : (
          <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        )}

        {step !== "details" ? (
          <Button size="sm" onClick={goNext} disabled={!canProceed}>
            Next <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        ) : (
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
            {saving ? "Saving..." : "Save Entry"}
          </Button>
        )}
      </div>
    </div>
  );
}