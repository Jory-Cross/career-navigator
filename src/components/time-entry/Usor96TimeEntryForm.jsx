import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { submitTimeEntryWithDualWrite } from "@/lib/dualWriteTimeEntry";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Check } from "lucide-react";
import { toast } from "sonner";

export default function Usor96TimeEntryForm({ clientId, onSuccess, onCancel }) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [entryType, setEntryType] = useState(null);
  const [errors, setErrors] = useState({});

  const [formData, setFormData] = useState({
    usor96_day: "",
    usor96_hours: "",
    usor96_jd_activity: "",
    usor96_outcome: "",
    usor96_next_steps: ""
  });

  // Fetch entry type on mount
  useEffect(() => {
    const fetchEntryType = async () => {
      try {
        setLoading(true);
        const results = await base44.entities.EntryType.filter({ code: 'usor96' });
        if (results.length > 0) {
          setEntryType(results[0]);
        } else {
          toast.error("USOR96 entry type not found");
        }
      } catch (error) {
        console.error("Error fetching entry type:", error);
        toast.error("Failed to load form");
      } finally {
        setLoading(false);
      }
    };

    fetchEntryType();
  }, []);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.usor96_day) newErrors.usor96_day = "Day is required";
    if (!formData.usor96_hours) newErrors.usor96_hours = "Hours is required";
    if (!formData.usor96_jd_activity?.trim()) newErrors.usor96_jd_activity = "Job Development Activity is required";
    if (!formData.usor96_outcome?.trim()) newErrors.usor96_outcome = "Outcome is required";
    if (!formData.usor96_next_steps?.trim()) newErrors.usor96_next_steps = "Next Steps is required";

    // Validate hours is a positive number
    if (formData.usor96_hours) {
      const hours = parseFloat(formData.usor96_hours);
      if (isNaN(hours) || hours <= 0) {
        newErrors.usor96_hours = "Hours must be a positive number";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error("Please fix the errors below");
      return;
    }

    if (!entryType) {
      toast.error("Entry type not available");
      return;
    }

    try {
      setSubmitting(true);

      // Calculate duration from hours
      const hours = parseFloat(formData.usor96_hours);
      const durationMinutes = Math.round(hours * 60);

      // Prepare field answers
      const fieldAnswers = {
        usor96_day: formData.usor96_day,
        usor96_hours: formData.usor96_hours,
        usor96_jd_activity: formData.usor96_jd_activity,
        usor96_outcome: formData.usor96_outcome,
        usor96_next_steps: formData.usor96_next_steps
      };

      // Submit using dual-write pattern
      const result = await submitTimeEntryWithDualWrite({
        clientId,
        entryTypeId: entryType.id,
        entryTypeCode: entryType.code,
        date: formData.usor96_day,
        durationMinutes,
        location: "Job Development",
        description: `USOR96 - ${formData.usor96_jd_activity.substring(0, 50)}`,
        fieldAnswers,
        asDraft: false
      });

      toast.success("USOR96 entry saved successfully");
      
      if (onSuccess) {
        onSuccess(result);
      }
    } catch (error) {
      console.error("Error submitting entry:", error);
      toast.error(error.message || "Failed to save entry");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Card className="bg-white border-slate-200">
        <CardContent className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-3 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white border-slate-200 max-w-2xl">
      <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200">
        <CardTitle className="text-slate-900">Job Development Entry (USOR96)</CardTitle>
        <CardDescription className="text-slate-600">
          Record a Job Development (USOR96) activity, outcome, and next steps
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-6 pt-6">
          {/* Day */}
          <div className="space-y-2">
            <Label htmlFor="day" className="font-medium text-slate-700">
              Day *
            </Label>
            <Input
              id="day"
              type="date"
              value={formData.usor96_day}
              onChange={(e) => {
                setFormData(p => ({ ...p, usor96_day: e.target.value }));
                if (errors.usor96_day) setErrors(p => ({ ...p, usor96_day: "" }));
              }}
              className={errors.usor96_day ? "border-red-500" : ""}
            />
            {errors.usor96_day && (
              <p className="text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> {errors.usor96_day}
              </p>
            )}
          </div>

          {/* Hours */}
          <div className="space-y-2">
            <Label htmlFor="hours" className="font-medium text-slate-700">
              Hours *
            </Label>
            <Input
              id="hours"
              type="number"
              step="0.25"
              min="0"
              placeholder="e.g., 2.5"
              value={formData.usor96_hours}
              onChange={(e) => {
                setFormData(p => ({ ...p, usor96_hours: e.target.value }));
                if (errors.usor96_hours) setErrors(p => ({ ...p, usor96_hours: "" }));
              }}
              className={errors.usor96_hours ? "border-red-500" : ""}
            />
            {errors.usor96_hours && (
              <p className="text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> {errors.usor96_hours}
              </p>
            )}
          </div>

          {/* JD Activity */}
          <div className="space-y-2">
            <Label htmlFor="jd_activity" className="font-medium text-slate-700">
              Job Development Activity *
            </Label>
            <Textarea
              id="jd_activity"
              placeholder="Describe the job development activity..."
              value={formData.usor96_jd_activity}
              onChange={(e) => {
                setFormData(p => ({ ...p, usor96_jd_activity: e.target.value }));
                if (errors.usor96_jd_activity) setErrors(p => ({ ...p, usor96_jd_activity: "" }));
              }}
              className={`min-h-24 ${errors.usor96_jd_activity ? "border-red-500" : ""}`}
            />
            {errors.usor96_jd_activity && (
              <p className="text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> {errors.usor96_jd_activity}
              </p>
            )}
          </div>

          {/* Outcome */}
          <div className="space-y-2">
            <Label htmlFor="outcome" className="font-medium text-slate-700">
              Outcome *
            </Label>
            <Textarea
              id="outcome"
              placeholder="Describe the outcome of the activity..."
              value={formData.usor96_outcome}
              onChange={(e) => {
                setFormData(p => ({ ...p, usor96_outcome: e.target.value }));
                if (errors.usor96_outcome) setErrors(p => ({ ...p, usor96_outcome: "" }));
              }}
              className={`min-h-24 ${errors.usor96_outcome ? "border-red-500" : ""}`}
            />
            {errors.usor96_outcome && (
              <p className="text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> {errors.usor96_outcome}
              </p>
            )}
          </div>

          {/* Next Steps */}
          <div className="space-y-2">
            <Label htmlFor="next_steps" className="font-medium text-slate-700">
              Next Steps *
            </Label>
            <Textarea
              id="next_steps"
              placeholder="Describe the next steps..."
              value={formData.usor96_next_steps}
              onChange={(e) => {
                setFormData(p => ({ ...p, usor96_next_steps: e.target.value }));
                if (errors.usor96_next_steps) setErrors(p => ({ ...p, usor96_next_steps: "" }));
              }}
              className={`min-h-24 ${errors.usor96_next_steps ? "border-red-500" : ""}`}
            />
            {errors.usor96_next_steps && (
              <p className="text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> {errors.usor96_next_steps}
              </p>
            )}
          </div>

          <Alert className="border-amber-200 bg-amber-50">
            <Check className="h-4 w-4 text-amber-700" />
            <AlertDescription className="text-amber-700 text-sm">
              All fields are required. Your entry will be marked as report-ready upon submission.
            </AlertDescription>
          </Alert>
        </CardContent>

        <div className="flex gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-xl">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={submitting || loading}
            className="ml-auto bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700"
          >
            {submitting ? "Saving..." : "Save USOR96 Entry"}
          </Button>
        </div>
      </form>
    </Card>
  );
}