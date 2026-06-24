import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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

export default function CohortFormDialog({
  open,
  onOpenChange,
  cohort,
  onSubmit,
  saving,
}) {
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

  const handleField = (key, value) => {
    setForm((currentForm) => ({
      ...currentForm,
      [key]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (typeof onSubmit !== "function") {
      setError("Create Cohort is not wired to a save function.");
      return;
    }

    if (!form.name?.trim()) {
      setError("Cohort name is required");
      return;
    }

    try {
      setError("");

      if (isEdit) {
        await onSubmit({
          id: cohort.id,
          patch: form,
        });
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
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit Cohort" : "New Cohort"}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1 sm:col-span-2">
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(event) => handleField("name", event.target.value)}
                placeholder="e.g. CE Certification — Spring 2026 Cohort A"
              />
            </div>

            <div className="space-y-1">
              <Label>Code</Label>
              <Input
                value={form.code}
                onChange={(event) => handleField("code", event.target.value)}
                placeholder="e.g. CE-2026-SPA"
              />
            </div>

            <div className="space-y-1">
              <Label>Course Version</Label>
              <Input
                value={form.course_version}
                onChange={(event) =>
                  handleField("course_version", event.target.value)
                }
                placeholder="e.g. v2026.1"
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <Label>Course Name</Label>
              <Input
                value={form.course_name}
                onChange={(event) =>
                  handleField("course_name", event.target.value)
                }
                placeholder="e.g. CE Discovery Foundations"
              />
            </div>

            <div className="space-y-1">
              <Label>Type</Label>
              <Select
                value={form.cohort_type}
                onValueChange={(value) => handleField("cohort_type", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COHORT_TYPES.map((typeOption) => (
                    <SelectItem key={typeOption.value} value={typeOption.value}>
                      {typeOption.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(value) => handleField("status", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((statusOption) => (
                    <SelectItem
                      key={statusOption.value}
                      value={statusOption.value}
                    >
                      {statusOption.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={form.start_date}
                onChange={(event) =>
                  handleField("start_date", event.target.value)
                }
              />
            </div>

            <div className="space-y-1">
              <Label>End Date</Label>
              <Input
                type="date"
                value={form.end_date}
                onChange={(event) =>
                  handleField("end_date", event.target.value)
                }
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <Label>Description</Label>
              <Textarea
                rows={2}
                value={form.description}
                onChange={(event) =>
                  handleField("description", event.target.value)
                }
                placeholder="Short description visible to cohort managers and members"
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <Label>Instructor Notes</Label>
              <Textarea
                rows={2}
                value={form.instructor_notes}
                onChange={(event) =>
                  handleField("instructor_notes", event.target.value)
                }
                placeholder="Internal notes — visible to admins only"
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>

            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : isEdit ? "Save Changes" : "Create Cohort"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
