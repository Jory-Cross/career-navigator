import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { submitTimeEntryWithDualWrite } from "@/lib/dualWriteTimeEntry";
import { serviceCodeCache } from "@/lib/serviceCodeCache";

async function loadAuthorizedJobCoachingEntryType() {
  const response = await base44.functions.invoke(
    "getAuthorizedTimeEntryConfig",
    { action: "list_entry_types" }
  );
  const payload = response?.data ?? response ?? {};

  if (!payload?.ok || !Array.isArray(payload?.entry_types)) {
    throw new Error(
      payload?.error || "Unable to load the Job Coaching service type."
    );
  }

  const matches = payload.entry_types.filter(
    (entryType) => entryType?.code === "job_coaching"
  );
  const ownOrganizationEntryType = matches.find((entryType) => entryType?.org_id);

  return ownOrganizationEntryType || matches[0] || null;
}

/**
 * Dedicated Job Coaching TimeEntry form.
 *
 * Service-code configuration remains cached locally, while EntryType discovery
 * is loaded from the authorized TimeEntry configuration route.
 */
export default function JobCoachingTimeEntryForm({
  clientId,
  onSuccess,
  onCancel,
}) {
  const [form, setForm] = useState({
    coaching_date: new Date().toISOString().split("T")[0],
    hours_of_coaching: "",
    job_coach_name: "",
    primary_service_code: "",
    secondary_service_code: "",
  });
  const [serviceCodes, setServiceCodes] = useState([]);
  const [loadingCodes, setLoadingCodes] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    let cancelled = false;

    serviceCodeCache
      .fetchServiceCodes(true)
      .then((codes) => {
        if (cancelled) return;
        setServiceCodes(Array.isArray(codes) ? codes : []);
        serviceCodeCache.validateConsistency(
          (Array.isArray(codes) ? codes : []).map((code) => code.display_label)
        );
      })
      .catch((error) => {
        console.error(
          "[JobCoachingTimeEntryForm] Failed to load service codes:",
          error
        );
        if (!cancelled) {
          toast.error("Service codes could not be loaded.");
          setServiceCodes([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingCodes(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function validate() {
    const nextErrors = {};

    if (!form.coaching_date) {
      nextErrors.coaching_date = "Date is required.";
    }
    if (!form.hours_of_coaching || Number(form.hours_of_coaching) <= 0) {
      nextErrors.hours_of_coaching = "Hours must be greater than zero.";
    }
    if (!form.job_coach_name?.trim()) {
      nextErrors.job_coach_name = "Job coach name is required.";
    }
    if (!form.primary_service_code) {
      nextErrors.primary_service_code = "Primary service code is required.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;

    setSaving(true);

    try {
      const durationMinutes = Math.round(Number(form.hours_of_coaching) * 60);
      const entryType = await loadAuthorizedJobCoachingEntryType();

      if (!entryType?.id) {
        throw new Error("The Job Coaching service type is unavailable.");
      }

      const fieldAnswers = {
        jc_date: form.coaching_date,
        jc_hours: form.hours_of_coaching,
        jc_job_coach_name: form.job_coach_name.trim(),
        jc_primary_service_code: form.primary_service_code,
        ...(form.secondary_service_code
          ? { jc_secondary_service_code: form.secondary_service_code }
          : {}),
      };

      await submitTimeEntryWithDualWrite({
        clientId,
        entryTypeId: entryType.id,
        entryTypeCode: entryType.code,
        date: form.coaching_date,
        startTime: null,
        endTime: null,
        durationMinutes,
        location: null,
        description: `Job Coaching - ${form.primary_service_code}`,
        serviceAuthorizationId: null,
        fieldAnswers,
        asDraft: false,
      });

      toast.success("Job Coaching entry saved.");
      serviceCodeCache.invalidate();
      onSuccess?.();
    } catch (error) {
      console.error("[JobCoachingTimeEntryForm] Save failed:", error);
      toast.error(error?.message || "Job Coaching entry could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  if (loadingCodes) {
    return (
      <Card className="flex min-h-40 items-center justify-center p-6">
        <div className="text-center">
          <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-slate-400" />
          <p className="text-sm text-slate-500">Loading service codes…</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="space-y-5 p-6">
      <div>
        <h3 className="text-base font-semibold">Job Coaching Time Entry</h3>
        <p className="mt-1 text-xs text-slate-500">
          Record a single Job Coaching service event.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-medium">
          Coaching Date <span className="text-red-500">*</span>
        </Label>
        <Input
          type="date"
          value={form.coaching_date}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              coaching_date: event.target.value,
            }))
          }
          className={errors.coaching_date ? "border-red-500" : ""}
        />
        {errors.coaching_date && (
          <p className="text-xs text-red-500">{errors.coaching_date}</p>
        )}
      </div>

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
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              hours_of_coaching: event.target.value,
            }))
          }
          className={errors.hours_of_coaching ? "border-red-500" : ""}
        />
        {errors.hours_of_coaching && (
          <p className="text-xs text-red-500">{errors.hours_of_coaching}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-medium">
          Job Coach Name <span className="text-red-500">*</span>
        </Label>
        <Input
          type="text"
          placeholder="Enter your name or coach name"
          value={form.job_coach_name}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              job_coach_name: event.target.value,
            }))
          }
          className={errors.job_coach_name ? "border-red-500" : ""}
        />
        {errors.job_coach_name && (
          <p className="text-xs text-red-500">{errors.job_coach_name}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-medium">
          Primary Service Code <span className="text-red-500">*</span>
        </Label>
        <Select
          value={form.primary_service_code}
          onValueChange={(value) =>
            setForm((current) => ({ ...current, primary_service_code: value }))
          }
        >
          <SelectTrigger
            className={errors.primary_service_code ? "border-red-500" : ""}
          >
            <SelectValue
              placeholder={
                serviceCodes.length > 0
                  ? "Select service code…"
                  : "No service codes available"
              }
            />
          </SelectTrigger>
          <SelectContent>
            {serviceCodes.length > 0 ? (
              serviceCodes.map((serviceCode) => (
                <SelectItem key={serviceCode.id} value={serviceCode.code}>
                  {serviceCode.display_label}
                </SelectItem>
              ))
            ) : (
              <div className="p-2 text-xs text-slate-500">
                No service codes are available.
              </div>
            )}
          </SelectContent>
        </Select>
        <p className="text-xs text-slate-400">
          Select the primary service provided ({serviceCodes.length} available).
        </p>
        {errors.primary_service_code && (
          <p className="text-xs text-red-500">{errors.primary_service_code}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-medium">
          Secondary Service Code (Optional)
        </Label>
        <Select
          value={form.secondary_service_code || "none"}
          onValueChange={(value) =>
            setForm((current) => ({
              ...current,
              secondary_service_code: value === "none" ? "" : value,
            }))
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select if applicable…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {serviceCodes.map((serviceCode) => (
              <SelectItem key={serviceCode.id} value={serviceCode.code}>
                {serviceCode.display_label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
        <div className="text-xs text-blue-800">
          <p className="font-medium">Minimal form design</p>
          <p className="mt-0.5">
            Client name, authorization details, and reporting period are populated by the authorized server workflow.
          </p>
        </div>
      </div>

      {Object.keys(errors).length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Correct the highlighted fields before saving.</span>
        </div>
      )}

      <div className="flex gap-2 border-t border-slate-200 pt-2">
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving} className="flex-1">
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Save Entry
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}
