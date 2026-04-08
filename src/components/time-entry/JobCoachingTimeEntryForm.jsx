import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { submitTimeEntryWithDualWrite } from "@/lib/dualWriteTimeEntry";
import { serviceCodeCache } from "@/lib/serviceCodeCache";

/**
 * JobCoachingTimeEntryForm - Dedicated Job Coaching Time Entry
 * 
 * Single source for Job Coaching entries. Renders exactly 5 fields:
 * 1. coaching_date (ISO date)
 * 2. hours_of_coaching (decimal hours)
 * 3. job_coach_name (text)
 * 4. primary_service_code (required select)
 * 5. secondary_service_code (optional select)
 */
export default function JobCoachingTimeEntryForm({ clientId, onSuccess, onCancel }) {
   console.log('[DEBUG] JobCoachingTimeEntryForm MOUNTED');
   const [form, setForm] = useState({
    coaching_date: new Date().toISOString().split('T')[0],
    hours_of_coaching: "",
    job_coach_name: "",
    primary_service_code: "",
    secondary_service_code: ""
  });

  const [serviceCodes, setServiceCodes] = useState([]);
  const [loadingCodes, setLoadingCodes] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  // Load service codes fresh on mount (no cached data)
   useEffect(() => {
     serviceCodeCache.fetchServiceCodes(true)
       .then(codes => {
         console.log('[JobCoachingTimeEntryForm] Loaded service codes:', codes.length);
         setServiceCodes(codes);
         // Validate consistency
         const options = codes.map(c => c.display_label);
         serviceCodeCache.validateConsistency(options);
       })
       .catch(err => {
         console.error('[JobCoachingTimeEntryForm] Failed to load service codes:', err);
         toast.error("Failed to load service codes");
         setServiceCodes([]);
       })
       .finally(() => setLoadingCodes(false));
   }, []);



  function validate() {
    const errs = {};
    if (!form.coaching_date) errs.coaching_date = "Date is required";
    if (!form.hours_of_coaching || Number(form.hours_of_coaching) <= 0) {
      errs.hours_of_coaching = "Hours must be greater than 0";
    }
    if (!form.job_coach_name?.trim()) {
      errs.job_coach_name = "Job coach name is required";
    }
    if (!form.primary_service_code) {
      errs.primary_service_code = "Primary service code is required";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;

    setSaving(true);
    try {
      const durationMinutes = Math.round(Number(form.hours_of_coaching) * 60);

      const fieldAnswers = {
        coaching_date: form.coaching_date,
        hours_of_coaching: form.hours_of_coaching,
        job_coach_name: form.job_coach_name,
        primary_service_code: form.primary_service_code,
        ...(form.secondary_service_code && { secondary_service_code: form.secondary_service_code })
      };

      // Get the entry type record
      const entryTypes = await base44.entities.EntryType.filter({
        code: "job_coaching",
        is_active: true
      });
      const entryType = entryTypes[0];

      if (!entryType) {
        toast.error("Job Coaching entry type not found");
        return;
      }

      await submitTimeEntryWithDualWrite({
        clientId,
        entryTypeId: entryType.id,
        entryTypeCode: "job_coaching",
        date: form.coaching_date,
        startTime: null,
        endTime: null,
        durationMinutes,
        location: null,
        description: `Job Coaching - ${form.primary_service_code}`,
        serviceAuthorizationId: null,
        fieldAnswers,
        asDraft: false
      });

      toast.success("Job coaching entry saved");
      // Invalidate cache so next form fetch is fresh
      serviceCodeCache.invalidate();
      onSuccess?.();
    } catch (err) {
      toast.error("Failed to save: " + err.message);
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  // Show all 15 USOR service codes in both dropdowns
  const allCodes = serviceCodes;

  if (loadingCodes) {
    return (
      <Card className="p-6 flex items-center justify-center min-h-40">
        <div className="text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-400" />
          <p className="text-sm text-slate-500">Loading service codes...</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 space-y-5">
      <div>
        <h3 className="font-semibold text-base">Job Coaching Time Entry</h3>
        <p className="text-xs text-slate-500 mt-1">Record a single coaching service event</p>
      </div>

      {/* Coaching Date */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">
          Coaching Date <span className="text-red-500">*</span>
        </Label>
        <Input
          type="date"
          value={form.coaching_date}
          onChange={e => setForm(p => ({ ...p, coaching_date: e.target.value }))}
          className={errors.coaching_date ? "border-red-500" : ""}
        />
        {errors.coaching_date && <p className="text-xs text-red-500">{errors.coaching_date}</p>}
      </div>

      {/* Hours of Coaching */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">
          Hours of Coaching <span className="text-red-500">*</span>
        </Label>
        <Input
          type="number"
          step="0.25"
          min="0"
          placeholder="e.g. 2.5"
          value={form.hours_of_coaching}
          onChange={e => setForm(p => ({ ...p, hours_of_coaching: e.target.value }))}
          className={errors.hours_of_coaching ? "border-red-500" : ""}
        />
        {errors.hours_of_coaching && <p className="text-xs text-red-500">{errors.hours_of_coaching}</p>}
      </div>

      {/* Job Coach Name */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">
          Job Coach Name <span className="text-red-500">*</span>
        </Label>
        <Input
          type="text"
          placeholder="Enter your name or coach name"
          value={form.job_coach_name}
          onChange={e => setForm(p => ({ ...p, job_coach_name: e.target.value }))}
          className={errors.job_coach_name ? "border-red-500" : ""}
        />
        {errors.job_coach_name && <p className="text-xs text-red-500">{errors.job_coach_name}</p>}
      </div>

      {/* Primary Service Code */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">
          Primary Service Code <span className="text-red-500">*</span>
        </Label>
        <Select
          value={form.primary_service_code}
          onValueChange={val => setForm(p => ({ ...p, primary_service_code: val }))}
        >
          <SelectTrigger className={errors.primary_service_code ? "border-red-500" : ""}>
            <SelectValue placeholder={allCodes.length > 0 ? "Select service code..." : "Loading codes..."} />
          </SelectTrigger>
          <SelectContent>
             {allCodes.length > 0 ? (
               allCodes.map(code => (
                 <SelectItem key={code.id} value={code.code}>
                   {code.display_label}
                 </SelectItem>
               ))
             ) : (
               <div className="p-2 text-xs text-slate-500">No service codes available</div>
             )}
           </SelectContent>
        </Select>
        <p className="text-xs text-slate-400">Select the primary service provided ({allCodes.length} available)</p>
        {errors.primary_service_code && (
          <p className="text-xs text-red-500">{errors.primary_service_code}</p>
        )}
      </div>

      {/* Secondary Service Code (Optional) */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Secondary Service Code (Optional)</Label>
        <Select
          value={form.secondary_service_code}
          onValueChange={val => setForm(p => ({ ...p, secondary_service_code: val }))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select if applicable..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={null}>None</SelectItem>
            {allCodes.map(code => (
              <SelectItem key={code.id} value={code.code}>
                {code.display_label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Info box */}
      <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 flex gap-2">
        <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-800">
          <p className="font-medium">Minimal form design</p>
          <p className="mt-0.5">Client name, authorization details, and reporting period are populated automatically.</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2 border-t border-slate-200">
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving} className="flex-1">
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Saving...
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Save Entry
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}