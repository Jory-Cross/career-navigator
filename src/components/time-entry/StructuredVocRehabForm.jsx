import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { submitTimeEntryWithDualWrite } from "@/lib/dualWriteTimeEntry";

/**
 * StructuredVocRehabForm
 * 
 * Renders ONLY the field templates for a specific Voc Rehab entry type.
 * Does NOT include generic wrapper fields (Date, Duration, Description).
 * Each entry type determines its own required fields.
 */
export default function StructuredVocRehabForm({
  entryTypeCode,
  clientId,
  entry = null,
  onSuccess,
  onCancel
}) {
  const [entryType, setEntryType] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [fieldAnswers, setFieldAnswers] = useState({});
  const [saving, setSaving] = useState(false);

  // Load entry type and field templates
  useEffect(() => {
    const load = async () => {
      setLoadingQuestions(true);
      try {
        // Get entry type
        const types = await base44.entities.EntryType.filter({ code: entryTypeCode });
        if (types.length > 0) {
          setEntryType(types[0]);
          console.log("[StructuredVocRehabForm] Entry type loaded:", types[0]);
        }

        // Get field templates for this entry type (row-level only)
        const templates = await base44.entities.ReportFieldTemplate.filter({
          entry_type_code: entryTypeCode,
          is_active: true,
          is_internal_only: false,
          pdf_context: 'row'
        });

        console.log("[StructuredVocRehabForm] Raw templates loaded:", templates.length);
        console.log("[StructuredVocRehabForm] Field keys:", templates.map(t => t.field_key));

        // Sort by order
        const sorted = templates.sort((a, b) => (a.order || 0) - (b.order || 0));
        console.log("[StructuredVocRehabForm] Final questions after sort:", sorted.map(q => ({ key: q.field_key, order: q.order })));
        setQuestions(sorted);

        // If editing, populate answers from entry's field answers
        if (entry?.id) {
          const answers = await base44.entities.ReportFieldAnswer.filter({
            time_entry_id: entry.id
          });
          if (answers.length > 0) {
            setFieldAnswers(answers[0].answers || {});
          }
        }
      } catch (err) {
        console.error("Failed to load form:", err);
        toast.error("Failed to load form");
      } finally {
        setLoadingQuestions(false);
      }
    };

    load();
  }, [entryTypeCode, entry?.id]);

  const handleSave = async () => {
    if (!entryType) {
      toast.error("Entry type not loaded");
      return;
    }

    setSaving(true);
    try {
      // Extract duration from field answers (look for hours/duration field), default to 1 hour
      const durationMinutes = (() => {
        const durationField = questions.find(q => 
          q.field_key.toLowerCase().includes('duration') ||
          q.field_key.toLowerCase().includes('hour')
        );
        if (durationField && fieldAnswers[durationField.field_key]) {
          const val = parseFloat(fieldAnswers[durationField.field_key]);
          return isNaN(val) || val <= 0 ? 60 : Math.round(val * 60);
        }
        return 60; // Default 1 hour
      })();

      // Extract date from field answers (look for date field), fall back to today
      const entryDate = (() => {
        const dateField = questions.find(q => 
          q.field_type === 'date' && 
          (q.field_key.toLowerCase().includes('date') || q.field_key.toLowerCase().includes('day'))
        );
        if (dateField && fieldAnswers[dateField.field_key]) {
          return fieldAnswers[dateField.field_key];
        }
        return new Date().toISOString().split("T")[0]; // Fall back to today
      })();

          if (entry?.id) {
        const response = await base44.functions.invoke(
          "mutateAuthorizedTimeEntry",
          {
            action: "update",
            entry_id: entry.id,
            time_entry: {
              date: entryDate,
              duration_minutes: durationMinutes,
              entry_type_id: entryType.id,
              entry_type_code: entryTypeCode,
              field_answers: fieldAnswers,
            },
          }
        );

        const data = response?.data || response || {};

        if (!data.ok || !data.entry?.id) {
          throw new Error(
            data.error || "Secure TimeEntry update failed."
          );
        }

        toast.success("Entry updated");
      } else {
        // For creating: use dual-write to create both TimeEntry and ReportFieldAnswer
        await submitTimeEntryWithDualWrite({
          clientId,
          entryTypeId: entryType.id,
          entryTypeCode: entryTypeCode,
          date: entryDate,
          durationMinutes,
          fieldAnswers: fieldAnswers,
          asDraft: false
        });
        toast.success("Entry created");
      }
      onSuccess?.();
    } catch (err) {
      toast.error("Failed to save");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loadingQuestions) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-4 h-4 animate-spin text-slate-400 mr-2" />
        <span className="text-sm text-slate-400">Loading form...</span>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="text-center py-8 space-y-3">
        <p className="text-sm text-slate-500">
          No fields configured for this entry type yet.
        </p>
        <p className="text-xs text-slate-400">
          Entry Type Code: <code className="bg-slate-100 px-2 py-1 rounded">{entryTypeCode}</code>
        </p>
        {entryType && (
          <p className="text-xs text-slate-400">
            Program Type: <code className="bg-slate-100 px-2 py-1 rounded">{entryType.program_type}</code>
          </p>
        )}
        <div className="flex gap-2 justify-center pt-4 border-t border-slate-200">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Render only the template questions for this entry type */}
      <div className="space-y-3">
        {questions.map(q => (
          <div key={q.field_key} className="space-y-1.5">
            <Label className="text-xs">
              {q.label}
              {q.is_required && <span className="text-red-500 ml-1">*</span>}
            </Label>

            {q.field_type === "textarea" ? (
              <textarea
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none min-h-20"
                value={fieldAnswers[q.field_key] || ""}
                onChange={e => setFieldAnswers(p => ({ ...p, [q.field_key]: e.target.value }))}
                placeholder={q.placeholder || ""}
              />
            ) : q.field_type === "select" ? (
              <Select
                value={fieldAnswers[q.field_key] || ""}
                onValueChange={v => setFieldAnswers(p => ({ ...p, [q.field_key]: v }))}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder={q.placeholder || "Select..."} />
                </SelectTrigger>
                <SelectContent>
                  {q.options?.filter(opt => opt && opt.trim()).map(opt => {
                    const trimmed = opt.trim();
                    return trimmed ? (
                      <SelectItem key={trimmed} value={trimmed}>
                        {trimmed}
                      </SelectItem>
                    ) : null;
                  })}
                </SelectContent>
              </Select>
            ) : q.field_type === "date" ? (
              <Input
                type="date"
                value={fieldAnswers[q.field_key] || ""}
                onChange={e => setFieldAnswers(p => ({ ...p, [q.field_key]: e.target.value }))}
              />
            ) : q.field_type === "time" ? (
              <Input
                type="time"
                value={fieldAnswers[q.field_key] || ""}
                onChange={e => setFieldAnswers(p => ({ ...p, [q.field_key]: e.target.value }))}
              />
            ) : q.field_type === "number" ? (
              <Input
                type="number"
                value={fieldAnswers[q.field_key] || ""}
                onChange={e => setFieldAnswers(p => ({ ...p, [q.field_key]: e.target.value }))}
                placeholder={q.placeholder || ""}
              />
            ) : (
              <Input
                type="text"
                value={fieldAnswers[q.field_key] || ""}
                onChange={e => setFieldAnswers(p => ({ ...p, [q.field_key]: e.target.value }))}
                placeholder={q.placeholder || ""}
              />
            )}

            {q.help_text && (
              <p className="text-xs text-slate-500 italic">{q.help_text}</p>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-2 justify-end pt-2 mt-4 border-t border-slate-200">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
          ) : null}
          {entry ? "Save" : "Add"}
        </Button>
      </div>
    </div>
  );
}
