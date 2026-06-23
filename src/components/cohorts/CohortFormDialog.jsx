import React, { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const COHORT_TYPES = [
  { value: "testing", label: "Testing" },
  { value: "training", label: "Training" },
  { value: "production", label: "Production" },
];

const STATUSES = [
  { value: "planned", label: "Planned" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
];

function emptyForm() {
  return {
    name: "",
    code: "",
    description: "",
    course_name: "",
    course_version: "",
    instructor_notes: "",
    cohort_type: "testing",
    status: "planned",
    start_date: "",
    end_date: "",
  };
}

/**
 * CohortFormDialog — Phase 6A
 *
 * Shared create + edit form for CETrainingCohort. Admin-only; the caller is
 * responsible for gating the trigger. Saves via the useCohorts hook through a
 * `onSubmit(payload)` callback (create) or `onSubmit({ id, patch })` (edit);
 * the parent decides which mutation to call so it owns the resulting toast UX.
 */
export default function CohortFormDialog({ open, onOpenChange, cohort, onSubmit, saving }) {
  const isEdit = !!cohort?.id;
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setError("");
      if (cohort) {
        setForm({
          name: cohort.name || "",
          code: cohort.code || "",
          description: cohort.description || "",
          course_name: cohort.course_name || "",
          course_version: cohort.course_version || "",
          instructor_notes: cohort.instructor_notes || "",
          cohort_type: cohort.cohort_type || "testing",
          status: cohort.status || "planned",
          start_date: cohort.start_date || "",
          end_date: cohort.end_date || "",
        });
      } else {
        setForm(emptyForm());
      }
    }
  }, [open, cohort]);

  const handleField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name?.trim()) {
      setError("Cohort name is required");
      return;
    }
    try {
      if (isEdit) {
        await onSubmit({ id: cohort.id, patch: form });
      } else {
        await onSubmit(form);
      }
      onOpenChange(false);
    } catch (err) {
      setError(err?.message || "Save failed");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Cohort" : "New Cohort"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1 sm:col-span-2">
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => handleField("name", e.target.value)}
                placeholder="e.g. CE Certification — Spring 2026 Cohort A"
              />
            </div>
            <div className="space-y-1">
              <Label>Code</Label>
              <Input
                value={form.code}
                onChange={(e) => handleField("code", e.target.value)}
                placeholder="e.g. CE-2026-SPA"
              />
            </div>
            <div className="space-y-1">
              <Label>Course Version</Label>
              <Input
                value={form.course_version}
                onChange={(e) => handleField("course_version", e.target.value)}
                placeholder="e.g. v2026.1"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Course Name</Label>
              <Input
                value={form.course_name}
                onChange={(e) => handleField("course_name", e.target.value)}
                placeholder="e.g. CE Discovery Foundations"
              />
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={form.cohort_type} onValueChange={(v) => handleField("cohort_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COHORT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => handleField("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Start Date</Label>
              <Input type="date" value={form.start_date} onChange={(e) => handleField("start_date", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>End Date</Label>
              <Input type="date" value={form.end_date} onChange={(e) => handleField("end_date", e.target.value)} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Description</Label>
              <Textarea
                rows={2}
                value={form.description}
                onChange={(e) => handleField("description", e.target.value)}
                placeholder="Short description visible to cohort managers and members"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Instructor Notes</Label>
              <Textarea
                rows={2}
                value={form.instructor_notes}
                onChange={(e) => handleField("instructor_notes", e.target.value)}
                placeholder="Internal notes — visible to admins only"
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Saving..." : isEdit ? "Save Changes" : "Create Cohort"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}