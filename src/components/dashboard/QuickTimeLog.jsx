import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, Plus, AlertCircle, ArrowRight } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function QuickTimeLog({ clients, onTimeSaved, onRouteToStructuredForm }) {
  const [clientId, setClientId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [description, setDescription] = useState("");
  const [entryTypeCode, setEntryTypeCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [entryTypes, setEntryTypes] = useState([]);
  const [selectedEntryType, setSelectedEntryType] = useState(null);
  const [hasRequiredReportFields, setHasRequiredReportFields] = useState(false);
  const [isBillableOrReportable, setIsBillableOrReportable] = useState(false);

  // Load entry types on mount
  useEffect(() => {
    base44.entities.EntryType.filter({ is_active: true })
      .then(types => setEntryTypes(types))
      .catch(err => console.error('Failed to load entry types:', err));
  }, []);

  // Check for required report fields when entry type changes
  useEffect(() => {
    if (entryTypeCode) {
      const et = entryTypes.find(t => t.code === entryTypeCode);
      setSelectedEntryType(et || null);
      setIsBillableOrReportable((et?.is_billable || et?.report_mode !== "none") ?? false);

      // Check if this entry type has required reporting fields
      if (et?.id) {
        base44.entities.ReportFieldTemplate.filter({
          entry_type_id: et.id,
          is_required: true,
          is_active: true
        })
          .then(fields => setHasRequiredReportFields(fields.length > 0))
          .catch(() => setHasRequiredReportFields(false));
      }
    } else {
      setSelectedEntryType(null);
      setHasRequiredReportFields(false);
      setIsBillableOrReportable(false);
    }
  }, [entryTypeCode, entryTypes]);

  const calculateDuration = () => {
    if (!startTime || !endTime) return 0;
    const [startHour, startMin] = startTime.split(":").map(Number);
    const [endHour, endMin] = endTime.split(":").map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    return endMinutes - startMinutes;
  };

  // Calculate reporting period key (YYYY-MM for monthly)
  const getReportingPeriodKey = () => {
    return date.substring(0, 7); // YYYY-MM
  };

  const handleQuickSave = async (asDraft = false) => {
    if (!clientId || !startTime || !endTime || !entryTypeCode) {
      toast.error("Please fill in all required fields");
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
      const reportingPeriodKey = getReportingPeriodKey();

      // Create time entry
      const entry = await base44.entities.TimeEntry.create({
        client_id: actualClientId,
        employee_id: (await base44.auth.me()).id,
        entry_type_id: selectedEntryType?.id,
        entry_type_code: entryTypeCode,
        date,
        start_time: startTime,
        end_time: endTime,
        duration_minutes: duration,
        reporting_period_key: reportingPeriodKey,
        location: null,
        description: description || "Quick log entry",
        is_billable: selectedEntryType?.is_billable || false,
        is_reportable: selectedEntryType?.report_mode !== "none",
        status: asDraft ? "draft" : "submitted",
        is_payroll_eligible: selectedEntryType?.is_payroll_eligible !== false,
        report_ready: !hasRequiredReportFields && !asDraft
      });

      // Create empty field answers if required
      if (hasRequiredReportFields) {
        await base44.entities.ReportFieldAnswer.create({
          time_entry_id: entry.id,
          entry_type_id: selectedEntryType?.id,
          entry_type_code: entryTypeCode,
          answers: {},
          required_fields_complete: false,
          report_ready: false
        });
      }

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
    setEntryTypeCode("");
  };

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

        {/* Entry Type - required */}
        <Select value={entryTypeCode} onValueChange={setEntryTypeCode}>
          <SelectTrigger className="border-slate-200 text-sm">
            <SelectValue placeholder="Select entry type..." />
          </SelectTrigger>
          <SelectContent>
            {entryTypes.map(et => (
              <SelectItem key={et.code} value={et.code}>
                {et.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Required fields warning */}
        {hasRequiredReportFields && isBillableOrReportable && (
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
            disabled={!clientId || !startTime || !endTime || !entryTypeCode || saving}
          >
            <Clock className="w-4 h-4 mr-2" /> Log Time
          </Button>

          {hasRequiredReportFields && (
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onRouteToStructuredForm?.(clientId, entryTypeCode, { date, startTime, endTime, description })}
              disabled={!clientId || !startTime || !endTime || !entryTypeCode || saving}
            >
              <ArrowRight className="w-4 h-4 mr-1" /> Full Form
            </Button>
          )}

          {hasRequiredReportFields && (
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