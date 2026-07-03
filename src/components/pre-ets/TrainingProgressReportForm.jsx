import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const RATINGS = ["Excellent", "Good", "Average", "Poor"];

const RATING_FIELDS = [
  { key: "quality_of_work", label: "Quality of Work" },
  { key: "rate_of_progress", label: "Rate of Progress" },
  { key: "ability_get_along", label: "Ability to Get Along With Others" },
  { key: "personal_appearance", label: "Personal Appearance & Hygiene" },
  { key: "rate_of_task_completion", label: "Rate of Task Completion" },
  { key: "attitude", label: "Attitude" },
];

const EMPTY_FORM = {
  return_completed_to: "",
  supervisor_name: "",
  supervisor_address: "",
  reporting_period_from: "",
  reporting_period_to: "",
  was_late: false,
  late_how_often: "",
  had_absences: false,
  absences_how_often: "",
  quality_of_work: "",
  rate_of_progress: "",
  ability_get_along: "",
  personal_appearance: "",
  rate_of_task_completion: "",
  attitude: "",
  comments: "",
  training_schedule_changes: false,
  training_schedule_changes_explain: "",
  additional_hours_needed: "",
  supervisor_signature: "",
  signature_date: "",
  supervisor_title: "",
};

export default function TrainingProgressReportForm({
  open,
  onClose,
  client,
  onSubmitted,
}) {
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  // Employer details may be prefilled from the already authorized client
  // summary. The server determines where the completed report is routed.
  useEffect(() => {
    if (!open) {
      return;
    }

    const supervisorName =
      client?.employer_contact_name ||
      client?.employer_name ||
      "";

    const supervisorAddress =
      client?.employer_address ||
      "";

    setForm((current) => ({
      ...current,
      supervisor_name:
        current.supervisor_name || supervisorName,
      supervisor_address:
        current.supervisor_address || supervisorAddress,
    }));
  }, [open, client]);
  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

    const handleSubmit = async () => {
    if (!client?.id) {
      toast.error("Cannot save progress report because no client is selected.");
      return;
    }

    if (!form.reporting_period_from || !form.reporting_period_to) {
      toast.error("Please fill in the reporting period dates.");
      return;
    }

       setSubmitting(true);

    try {
      const response = await base44.functions.invoke(
        "mutateAuthorizedPreEtsProgressReport",
        {
          action: "submit_employer_progress_report",
          client_id: client.id,
          report: form,
        }
      );

      const data = response?.data ?? response ?? {};

      if (!data?.ok) {
        throw new Error(
          data?.error ||
            "The progress report could not be saved."
        );
      }

      toast.success(
        data?.pdf_generated
          ? "Progress report saved and PDF generated."
          : "Progress report saved."
      );

      await onSubmitted?.(data?.report || null);
      onClose();
      setForm({ ...EMPTY_FORM });
    } catch (err) {
      toast.error(
        err?.message ||
          "The progress report could not be saved."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-center">
            <div className="text-xs text-slate-500 mb-1">DWS-USOR 72 | State of Utah — Department of Workforce Services</div>
            ON-THE-JOB / WORK BASED TRAINING PROGRESS REPORT
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2 text-sm">
          {/* Header info */}
          <div className="grid grid-cols-2 gap-3">
                     <div className="col-span-2">
              <Label>Return Completed Form To</Label>
              <Input
                value="Assigned automatically by the Pre-ETS program"
                disabled
                className="bg-slate-50 text-slate-500"
              />
              <p className="mt-1 text-xs text-slate-500">
                The program securely routes the completed report.
              </p>
            </div>
            <div className="col-span-2">
              <Label>Supervisor/Employer Name</Label>
              <Input value={form.supervisor_name} onChange={e => set("supervisor_name", e.target.value)} />
            </div>
            <div className="col-span-2">
              <Label>Supervisor/Employer Address</Label>
              <Input value={form.supervisor_address} onChange={e => set("supervisor_address", e.target.value)} />
            </div>
            <div className="col-span-2">
              <Label>Client/Employee Name</Label>
              <Input value={`${client?.first_name || ""} ${client?.last_name || ""}`} disabled className="bg-slate-50" />
            </div>
            <div>
              <Label>Reporting Period: From</Label>
              <Input type="date" value={form.reporting_period_from} onChange={e => set("reporting_period_from", e.target.value)} />
            </div>
            <div>
              <Label>To</Label>
              <Input type="date" value={form.reporting_period_to} onChange={e => set("reporting_period_to", e.target.value)} />
            </div>
          </div>

          {/* Attendance */}
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p>Was the individual late for scheduled activities in this reporting period?</p>
              <div className="flex gap-4">
                {["Yes", "No"].map(opt => (
                  <label key={opt} className="flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" name="was_late" checked={form.was_late === (opt === "Yes")}
                      onChange={() => set("was_late", opt === "Yes")} />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
            </div>
            {form.was_late && (
              <div>
                <Label>If yes, how often?</Label>
                <Input value={form.late_how_often} onChange={e => set("late_how_often", e.target.value)} />
              </div>
            )}

            <div className="flex items-center justify-between">
              <p>Did the individual have unexcused absences in this reporting period?</p>
              <div className="flex gap-4">
                {["Yes", "No"].map(opt => (
                  <label key={opt} className="flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" name="had_absences" checked={form.had_absences === (opt === "Yes")}
                      onChange={() => set("had_absences", opt === "Yes")} />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
            </div>
            {form.had_absences && (
              <div>
                <Label>If yes, how often?</Label>
                <Input value={form.absences_how_often} onChange={e => set("absences_how_often", e.target.value)} />
              </div>
            )}
          </div>

          {/* Ratings Table */}
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="text-left p-3 font-medium">Category</th>
                  {RATINGS.map(r => (
                    <th key={r} className="p-3 font-medium text-center">{r}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {RATING_FIELDS.map((field, idx) => (
                  <tr key={field.key} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                    <td className="p-3">{field.label}</td>
                    {RATINGS.map(rating => (
                      <td key={rating} className="p-3 text-center">
                        <input
                          type="radio"
                          name={field.key}
                          checked={form[field.key] === rating}
                          onChange={() => set(field.key, rating)}
                          className="cursor-pointer"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Comments */}
          <div>
            <Label>Comments (things done well, issues, or concerns)</Label>
            <Textarea rows={3} value={form.comments} onChange={e => set("comments", e.target.value)} />
          </div>

          {/* Training schedule */}
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p>Are there any changes needed to training schedule?</p>
              <div className="flex gap-4">
                {["Yes", "No"].map(opt => (
                  <label key={opt} className="flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" name="training_schedule_changes"
                      checked={form.training_schedule_changes === (opt === "Yes")}
                      onChange={() => set("training_schedule_changes", opt === "Yes")} />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
            </div>
            {form.training_schedule_changes && (
              <div>
                <Label>If yes, explain</Label>
                <Textarea rows={2} value={form.training_schedule_changes_explain}
                  onChange={e => set("training_schedule_changes_explain", e.target.value)} />
              </div>
            )}
          </div>

          {/* Additional hours */}
          <div>
            <Label>How many additional hours of training do you believe are needed?</Label>
            <Textarea rows={2} value={form.additional_hours_needed}
              onChange={e => set("additional_hours_needed", e.target.value)} />
          </div>

          {/* Signature */}
          <div className="grid grid-cols-2 gap-3 border-t pt-4">
            <div className="col-span-2">
              <Label>Employer/Supervisor Signature (type full name)</Label>
              <Input value={form.supervisor_signature} onChange={e => set("supervisor_signature", e.target.value)} />
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" value={form.signature_date} onChange={e => set("signature_date", e.target.value)} />
            </div>
            <div>
              <Label>Employer/Supervisor Title</Label>
              <Input value={form.supervisor_title} onChange={e => set("supervisor_title", e.target.value)} />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : "Save Progress Report"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
