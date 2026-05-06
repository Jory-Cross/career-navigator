import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { Clock, Plus, AlertCircle, ArrowRight } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import EntryTypePicker from "@/components/time-entry/EntryTypePicker";
import JobCoachingTimeEntryForm from "@/components/time-entry/JobCoachingTimeEntryForm";
import { submitTimeEntryWithDualWrite } from "@/lib/dualWriteTimeEntry";

// Simple entry types that are always quick-loggable (no required reporting fields)
const SIMPLE_ENTRY_TYPES = [
  "admin_time",
  "miscellaneous",
  "end_of_month_reporting",
  "pre_ets_training",
  "wsa",
  "work_based_learning",
];

// Structured entry types that may require full form
const STRUCTURED_ENTRY_TYPES = [
  "job_coaching",
  "job_development",
  "usor96",
  "life_skills",
  "csb_hours",
];

/**
 * 🚫 DEPRECATED - Use FormEngine instead
 * 
 * This component provided "quick log" vs "structured form" branching logic.
 * FormEngine now handles all entry types dynamically based on schema.
 * No more branching logic needed.
 */
export default function QuickTimeLog() {
  console.warn('[QuickTimeLog] DEPRECATED - Use FormEngine instead');
  return null;
}

/*
  // Load entry types (deduplicated)
  useEffect(() => {
    setLoadingEntryTypes(true);
    base44.entities.EntryType.filter({ is_active: true })
      .then(types => {
        // Deduplicate by code, keeping first occurrence
        const uniqueEntryTypes = Array.from(
          new Map(types.map(t => [t.code, t])).values()
        ).sort((a, b) => a.name.localeCompare(b.name));
        setEntryTypes(uniqueEntryTypes);
      })
      .catch(err => {
        console.error("Failed to load entry types:", err);
        setEntryTypes([]);
      })
      .finally(() => setLoadingEntryTypes(false));
  }, []);

  // Route to Job Coaching form if selected
  useEffect(() => {
    if (selectedEntryType?.code === "job_coaching") {
      setShowJobCoachingForm(true);
    }
  }, [selectedEntryType?.code]);

  // Check for required report fields when entry type changes
  useEffect(() => {
    if (!selectedEntryType?.id) {
      setHasRequiredReportFields(false);
      setIsBillableOrReportable(false);
      return;
    }

    // Simple entry types never require structured fields
    if (isSimpleEntryType(selectedEntryType.code)) {
      setHasRequiredReportFields(false);
      setIsBillableOrReportable(false);
      return;
    }

    // For structured types, check billable/reportable and required fields
    if (selectedEntryType.code !== "job_coaching") {
      setIsBillableOrReportable((selectedEntryType?.is_billable || selectedEntryType?.report_mode !== "none") ?? false);

      // Check if this entry type has required reporting fields
      base44.entities.ReportFieldTemplate.filter({
        entry_type_id: selectedEntryType.id,
        is_required: true,
        is_active: true
      })
        .then(fields => setHasRequiredReportFields(fields.length > 0))
        .catch(() => setHasRequiredReportFields(false));
    } else {
      setHasRequiredReportFields(false);
      setIsBillableOrReportable(false);
    }
  }, [selectedEntryType?.id, selectedEntryType?.code]);

  const calculateDuration = () => {
    if (!startTime || !endTime) return 0;
    const [startHour, startMin] = startTime.split(":").map(Number);
    const [endHour, endMin] = endTime.split(":").map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    const duration = endMinutes - startMinutes;
    return duration;
  };

  const isSimpleEntryType = (code) => SIMPLE_ENTRY_TYPES.includes(code);

  const isStructuredEntryType = (code) => STRUCTURED_ENTRY_TYPES.includes(code);

  // Calculate reporting period key (YYYY-MM for monthly)
  const getReportingPeriodKey = () => {
    return date.substring(0, 7); // YYYY-MM
  };

  const handleQuickSave = async (asDraft = false) => {
    if (!clientId || !startTime || !endTime || !selectedEntryType) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (!description?.trim()) {
      toast.error("Description is required");
      return;
    }

    const duration = calculateDuration();
    if (duration <= 0) {
      toast.error("End time must be after start time");
      return;
    }

    // Block finalized billable/reportable entries without required fields
    if (!asDraft && isBillableOrReportable && hasRequiredReportFields) {
      toast.error("This service type requires structured fields. Save as draft or use the full entry form.");
      return;
    }

    setSaving(true);
    try {
      const actualClientId = clientId?.startsWith('self:') ? null : clientId;

      // DUAL-WRITE: Use standardized submission function
      const result = await submitTimeEntryWithDualWrite({
        clientId: actualClientId,
        entryTypeId: selectedEntryType?.id,
        entryTypeCode: selectedEntryType?.code,
        date,
        startTime,
        endTime,
        durationMinutes: duration,
        location: null,
        description: description || "Quick log entry",
        serviceAuthorizationId: null,
        fieldAnswers: {},
        asDraft
      });

      toast.success(asDraft ? "Entry saved as draft" : "Time logged");
      resetForm();
      if (onTimeSaved) onTimeSaved();
    } catch (error) {
      console.error("Failed to save time entry:", error);
      toast.error("Failed to save time entry");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setClientId("");
    setDate(new Date().toISOString().split("T")[0]);
    setStartTime("");
    setEndTime("");
    setDescription("");
    setSelectedEntryType(null);
  };

  if (showJobCoachingForm && clientId) {
    return (
      <Card className="border-0 shadow-sm">
        <div className="h-1 w-full bg-violet-50" />
        <div className="p-5">
          <div className="mb-4">
            <button
              className="text-sm text-slate-500 hover:text-slate-700"
              onClick={() => {
                setShowJobCoachingForm(false);
                setSelectedEntryType(null);
                resetForm();
              }}
            >
              ← Back
            </button>
          </div>
          <JobCoachingTimeEntryForm
            clientId={clientId}
            onSuccess={() => {
              setShowJobCoachingForm(false);
              setSelectedEntryType(null);
              resetForm();
              onTimeSaved();
            }}
            onCancel={() => {
              setShowJobCoachingForm(false);
              setSelectedEntryType(null);
              resetForm();
            }}
          />
        </div>
        </Card>
        );
        }
        */
        // END DEPRECATED

/* DEPRECATED - dead code below, component returns null above
  return (
     <Card className="border-0 shadow-sm">
       <div className="h-1 w-full bg-violet-50" />
       <div className="p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
          <Plus className="w-4 h-4" />
          <span>Quick Log</span>
        </div>

        {/* Client */}
        <Select value={clientId} onValueChange={setClientId}>
          <SelectTrigger className="border-slate-200 text-sm">
            <SelectValue placeholder="Select client..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="self:true">👤 Myself (no client)</SelectItem>
            {clients.filter(c => c.status === "active" && !c.is_archived).map(c => (
              <SelectItem key={c.id} value={c.id}>
                {c.first_name} {c.last_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Date */}
        <Input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="border-slate-200 text-sm"
        />

        {/* Time */}
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              type="time"
              placeholder="Start time"
              value={startTime}
              onChange={e => setStartTime(e.target.value)}
              className="border-slate-200 text-sm flex-1"
            />
            <Input
              type="time"
              placeholder="End time"
              value={endTime}
              onChange={e => setEndTime(e.target.value)}
              className="border-slate-200 text-sm flex-1"
            />
          </div>
          {startTime && endTime && (
            <p className="text-xs text-slate-500">
              Duration: {calculateDuration()} minutes
            </p>
          )}
        </div>

        {/* Description */}
        <Input
          placeholder="Description..."
          value={description}
          onChange={e => setDescription(e.target.value)}
          className="border-slate-200 text-sm"
        />

        {/* Service Type Dropdown */}
        <div>
          <label className="text-xs font-medium text-slate-700 block mb-2">Service Type *</label>
          {loadingEntryTypes ? (
            <div className="flex items-center justify-center py-2 text-slate-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />
              <span className="text-xs">Loading...</span>
            </div>
          ) : (
            <Select 
              value={selectedEntryType?.id || ""} 
              onValueChange={val => {
                const selected = entryTypes.find(t => t.id === val);
                if (selected) setSelectedEntryType(selected);
              }}
            >
              <SelectTrigger className="border-slate-200 text-sm">
                <SelectValue placeholder="Select a service type..." />
              </SelectTrigger>
              <SelectContent>
                {entryTypes.map(type => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Required fields warning - only for structured types */}
        {hasRequiredReportFields && isBillableOrReportable && isStructuredEntryType(selectedEntryType?.code) && (
          <div className="flex gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-xs text-amber-700 font-medium">Required reporting fields</p>
              <p className="text-xs text-amber-600 mt-0.5">This {isBillableOrReportable ? "billable/reportable" : "entry"} type requires structured questions. Complete them to finalize the entry.</p>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button
            className="flex-1 bg-violet-600 hover:bg-violet-700 text-white"
            onClick={() => handleQuickSave(false)}
            disabled={!clientId || !startTime || !endTime || !selectedEntryType || !description?.trim() || saving}
          >
            <Clock className="w-4 h-4 mr-2" /> Log Time
          </Button>

          {/* Only show Full Form button for structured types with required fields */}
          {hasRequiredReportFields && isStructuredEntryType(selectedEntryType?.code) && (
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onRouteToStructuredForm?.(clientId, selectedEntryType?.code, { date, startTime, endTime, description })}
              disabled={!clientId || !startTime || !endTime || !selectedEntryType || !description?.trim() || saving}
            >
              <ArrowRight className="w-4 h-4 mr-1" /> Full Form
            </Button>
          )}

          {/* Only show Draft button for structured types with required fields */}
          {hasRequiredReportFields && isStructuredEntryType(selectedEntryType?.code) && (
            <Button
              variant="ghost"
              className="px-3"
              onClick={() => handleQuickSave(true)}
              disabled={saving}
              title="Save as draft and complete fields later"
            >
              Draft
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}