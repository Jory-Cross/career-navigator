import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, CheckCircle2, UserCheck } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { SECTION_STATUS_COLORS, SECTION_STATUS_LABELS } from "@/lib/intakeSections";
import { cn } from "@/lib/utils";
import BarriersAIClarify from "@/components/intake/BarriersAIClarify";
import MedicationListField from "@/components/intake/MedicationListField";
import ReleaseOfInformationForm from "@/components/intake/ReleaseOfInformationForm";
import ServicesAgreementForm from "@/components/intake/ServicesAgreementForm";

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

export default function IntakeSectionForm({ sectionDef, sectionRecord, clientId, orgId, currentUser, client, readOnly = false, onSaved }) {
  const [answers, setAnswers] = useState({});
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [exitSaveStatus, setExitSaveStatus] = useState(null); // null | 'saving' | 'saved' | 'error'

  // Always-current refs so async save-on-exit reads latest values
  const answersRef = useRef(answers);
  useEffect(() => { answersRef.current = answers; }, [answers]);

  const sectionRecordRef = useRef(sectionRecord);
  useEffect(() => { sectionRecordRef.current = sectionRecord; }, [sectionRecord]);

  const isDirtyRef = useRef(false);
  useEffect(() => { isDirtyRef.current = isDirty; }, [isDirty]);

  // Reset on section switch
  useEffect(() => {
    setIsDirty(false);
    setExitSaveStatus(null);
    setAnswers(sectionRecord?.answers ?? {});
  }, [sectionRecord?.id]);

  const setField = (key, val) => {
    setIsDirty(true);
    setAnswers((prev) => ({ ...prev, [key]: val }));
  };

  // Core save function — used by exit save, manual save, and unmount
  const doSave = useCallback(async (latestAnswers, markComplete = false) => {
    if (readOnly) return;
    const rec = sectionRecordRef.current;
    const nonEmpty = Object.fromEntries(
      Object.entries(latestAnswers).filter(([, v]) => v !== null && v !== undefined && v !== "")
    );
    const currentStatus = rec?.status || "not_started";
    const nextStatus = markComplete
      ? "completed"
      : (currentStatus === "not_started" || currentStatus === "assigned") ? "in_progress" : currentStatus;

    const payload = {
      client_id: clientId,
      org_id: orgId,
      section_key: sectionDef.key,
      section_label: sectionDef.label,
      answers: nonEmpty,
      status: nextStatus,
      ...(markComplete ? { completed_at: new Date().toISOString() } : {}),
    };

    if (rec?.id) {
      await base44.entities.IntakeSection.update(rec.id, payload);
    } else {
      await base44.entities.IntakeSection.create(payload);
    }
    if (onSaved) onSaved();
  }, [readOnly, clientId, orgId, sectionDef.key, sectionDef.label, onSaved]);

  // Save-on-exit: fires when component unmounts (section switch or page close)
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Best-effort sync-style beacon on page unload — just fire and forget
      if (isDirtyRef.current) {
        doSave(answersRef.current).catch(() => {});
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      // Save on unmount (section switch)
      if (isDirtyRef.current && !readOnly) {
        doSave(answersRef.current).catch(() => {});
      }
    };
  }, [doSave, readOnly]);

  const hasAnswers = () => Object.values(answers).some((v) => v !== null && v !== undefined && v !== "");

  const handleSave = async (markComplete = false) => {
    setSaving(true);
    try {
      await doSave(answers, markComplete);
      setIsDirty(false);
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2500);
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

      {/* Custom section renderers */}
      {sectionDef.customRenderer === "roi" && (
        <ReleaseOfInformationForm
          answers={answers}
          setField={setField}
          readOnly={readOnly}
          client={client}
        />
      )}

      {sectionDef.customRenderer === "services_agreement" && (
        <ServicesAgreementForm
          answers={answers}
          setField={setField}
          readOnly={readOnly}
          client={client}
        />
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

          if (field.type === "medication_list") {
            return (
              <div key={field.key} className="space-y-2">
                <Label className="text-sm font-medium">{field.label}</Label>
                <MedicationListField
                  value={answers[field.key] ?? []}
                  onChange={(v) => setField(field.key, v)}
                  readOnly={readOnly}
                />
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

      {/* AI Clarify — barriers_support section only */}
      {sectionDef.key === "barriers_support" && (
        <BarriersAIClarify
          answers={answers}
          onAccept={(aiFields) => {
            setIsDirty(true);
            setAnswers((prev) => ({ ...prev, ...aiFields }));
          }}
        />
      )}

      {/* Unsaved changes indicator */}
      {isDirty && (
        <p className="text-xs text-amber-600 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
          Unsaved changes — will save when you leave this section
        </p>
      )}

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