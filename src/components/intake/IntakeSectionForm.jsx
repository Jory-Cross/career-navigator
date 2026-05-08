import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, CheckCircle2, UserCheck } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { SECTION_STATUS_COLORS, SECTION_STATUS_LABELS } from "@/lib/intakeSections";
import { cn } from "@/lib/utils";

function RatingField({ label, value, onChange, readOnly }) {
  const levels = [1, 2, 3, 4, 5];
  return (
    <div className="space-y-1">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="flex gap-2">
        {levels.map((n) => (
          <button
            key={n}
            type="button"
            disabled={readOnly}
            onClick={() => !readOnly && onChange(n === Number(value) ? null : n)}
            className={cn(
              "w-9 h-9 rounded-lg border text-sm font-semibold transition-all",
              Number(value) === n
                ? "bg-indigo-600 text-white border-indigo-600 shadow"
                : "border-slate-200 hover:border-indigo-400 hover:bg-indigo-50",
              readOnly && "cursor-default"
            )}
          >
            {n}
          </button>
        ))}
        {value && (
          <span className="text-xs text-slate-500 self-center ml-1">
            {value === 1 ? "Needs work" : value === 3 ? "Average" : value === 5 ? "Excellent" : ""}
          </span>
        )}
      </div>
    </div>
  );
}

function YesNoField({ label, value, onChange, readOnly }) {
  return (
    <div className="space-y-1">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="flex gap-2">
        {["Yes", "No"].map((opt) => (
          <button
            key={opt}
            type="button"
            disabled={readOnly}
            onClick={() => !readOnly && onChange(value === opt ? null : opt)}
            className={cn(
              "px-4 py-1.5 rounded-lg border text-sm font-medium transition-all",
              value === opt
                ? opt === "Yes"
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-red-500 text-white border-red-500"
                : "border-slate-200 hover:bg-slate-50",
              readOnly && "cursor-default"
            )}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function IntakeSectionForm({ sectionDef, sectionRecord, clientId, orgId, currentUser, readOnly = false, onSaved }) {
  const [answers, setAnswers] = useState({});
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    if (sectionRecord?.answers) {
      setAnswers(sectionRecord.answers);
    } else {
      setAnswers({});
    }
  }, [sectionRecord?.id]);

  const setField = (key, val) => {
    setAnswers((prev) => ({ ...prev, [key]: val }));
  };

  const hasAnswers = () => Object.values(answers).some((v) => v !== null && v !== undefined && v !== "");

  const handleSave = async (markComplete = false) => {
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const nonEmpty = Object.fromEntries(
        Object.entries(answers).filter(([, v]) => v !== null && v !== undefined && v !== "")
      );

      const payload = {
        client_id: clientId,
        org_id: orgId,
        section_key: sectionDef.key,
        section_label: sectionDef.label,
        answers: nonEmpty,
      };

      if (markComplete) {
        payload.status = "completed";
        payload.completed_at = now;
      } else {
        payload.status = sectionRecord?.status === "not_started" ? "in_progress" : (sectionRecord?.status || "in_progress");
      }

      if (sectionRecord?.id) {
        await base44.entities.IntakeSection.update(sectionRecord.id, payload);
      } else {
        await base44.entities.IntakeSection.create(payload);
      }

      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2500);
      if (onSaved) onSaved();
    } finally {
      setSaving(false);
    }
  };

  const handleAssignToClient = async () => {
    setAssigning(true);
    try {
      const now = new Date().toISOString();
      const payload = {
        assigned_to_client: true,
        assigned_by: currentUser?.email,
        assigned_at: now,
        status: "assigned",
      };
      if (sectionRecord?.id) {
        await base44.entities.IntakeSection.update(sectionRecord.id, payload);
      } else {
        await base44.entities.IntakeSection.create({
          client_id: clientId,
          org_id: orgId,
          section_key: sectionDef.key,
          section_label: sectionDef.label,
          answers: {},
          status: "assigned",
          assigned_to_client: true,
          assigned_by: currentUser?.email,
          assigned_at: now,
        });
      }
      if (onSaved) onSaved();
    } finally {
      setAssigning(false);
    }
  };

  const isAssigned = sectionRecord?.assigned_to_client;
  const status = sectionRecord?.status || "not_started";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{sectionDef.emoji}</span>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{sectionDef.label}</h3>
            {sectionDef.description && (
              <p className="text-xs text-slate-500">{sectionDef.description}</p>
            )}
          </div>
        </div>
        <span className={cn("text-xs px-2.5 py-1 rounded-full font-medium", SECTION_STATUS_COLORS[status])}>
          {SECTION_STATUS_LABELS[status]}
        </span>
      </div>

      {sectionRecord?.assigned_by && (
        <div className="text-xs text-slate-500 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Assigned by {sectionRecord.assigned_by}
        </div>
      )}

      {/* Fields */}
      <div className="space-y-4">
        {sectionDef.fields.map((field) => {
          const val = answers[field.key] ?? "";

          if (field.type === "rating") {
            return (
              <RatingField key={field.key} label={field.label} value={val} onChange={(v) => setField(field.key, v)} readOnly={readOnly} />
            );
          }

          if (field.type === "yesno") {
            return (
              <YesNoField key={field.key} label={field.label} value={val} onChange={(v) => setField(field.key, v)} readOnly={readOnly} />
            );
          }

          if (field.type === "select") {
            return (
              <div key={field.key} className="space-y-1">
                <Label className="text-sm font-medium">{field.label}</Label>
                <Select value={val} onValueChange={(v) => setField(field.key, v)} disabled={readOnly}>
                  <SelectTrigger className="w-full max-w-sm">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {field.options.map((opt) => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          }

          if (field.type === "textarea") {
            return (
              <div key={field.key} className="space-y-1">
                <Label className="text-sm font-medium">{field.label}</Label>
                <Textarea
                  value={val}
                  onChange={(e) => setField(field.key, e.target.value)}
                  placeholder={`Enter ${field.label.toLowerCase()}...`}
                  className="min-h-[80px]"
                  readOnly={readOnly}
                />
              </div>
            );
          }

          // text / date / default
          return (
            <div key={field.key} className="space-y-1">
              <Label className="text-sm font-medium">{field.label}</Label>
              <Input
                type={field.type === "date" ? "date" : "text"}
                value={val}
                onChange={(e) => setField(field.key, e.target.value)}
                placeholder={field.type !== "date" ? `Enter ${field.label.toLowerCase()}...` : undefined}
                readOnly={readOnly}
                className="max-w-sm"
              />
            </div>
          );
        })}
      </div>

      {/* Actions */}
      {!readOnly && (
        <div className="flex flex-wrap gap-3 pt-4 border-t border-slate-100">
          <Button onClick={() => handleSave(false)} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
            Save Progress
          </Button>
          <Button variant="outline" onClick={() => handleSave(true)} disabled={saving || !hasAnswers()}>
            <CheckCircle2 className="w-4 h-4 mr-1" />
            Mark Complete
          </Button>
          <Button
            variant="outline"
            onClick={handleAssignToClient}
            disabled={assigning || isAssigned}
            className={isAssigned ? "text-emerald-700 border-emerald-300 bg-emerald-50" : ""}
          >
            <UserCheck className="w-4 h-4 mr-1" />
            {isAssigned ? "Assigned to Client" : "Assign to Client"}
          </Button>
          {savedMsg && (
            <span className="text-emerald-600 text-sm flex items-center gap-1 self-center">
              <CheckCircle2 className="w-4 h-4" /> Saved
            </span>
          )}
        </div>
      )}
    </div>
  );
}