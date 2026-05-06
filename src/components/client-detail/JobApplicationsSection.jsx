import React, { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus,
  ExternalLink,
  Building2,
  Calendar,
  MapPin,
  Search,
  Trash2,
  StickyNote,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

import { cn } from "@/lib/utils";
import {
  createApplication,
  updateApplication,
} from "@/lib/api/clientPortalApi";
import LiveJobSearch from "@/components/shared/LiveJobSearch";

const statusConfig = {
  saved: { color: "bg-slate-100 text-slate-600", label: "Saved" },
  applied: { color: "bg-blue-100 text-blue-700", label: "Applied" },
  phone_screen: { color: "bg-cyan-100 text-cyan-700", label: "Phone Screen" },
  interview: { color: "bg-violet-100 text-violet-700", label: "Interview" },
  final_round: { color: "bg-amber-100 text-amber-700", label: "Final Round" },
  offer: { color: "bg-emerald-100 text-emerald-700", label: "Offer" },
  rejected: { color: "bg-red-100 text-red-700", label: "Rejected" },
  accepted: { color: "bg-green-100 text-green-700", label: "Accepted" },
  withdrawn: { color: "bg-gray-100 text-gray-500", label: "Withdrawn" },
};

function emptyForm() {
  return {
    company: "",
    position: "",
    status: "saved",
    applied_date: "",
    follow_up_date: "",
    job_url: "",
    salary_range: "",
    location: "",
    work_type: "",
    contact_name: "",
    contact_title: "",
    contact_email: "",
    contact_phone: "",
    notes: "",
    note_entries: [],
    next_step: "",
    next_step_date: "",
  };
}

function safeFormatDate(value, formatString = "MMM d") {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return format(date, formatString);
}

export default function JobApplicationsSection({
  clientId,
  applications = [],
  onRefresh,
  client,
}) {
  const [activeTab, setActiveTab] = useState("applications");
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);
  const [newNote, setNewNote] = useState("");

  const sortedApplications = useMemo(() => {
    return [...applications].sort((a, b) => {
      const aTime = new Date(a?.created_date || 0).getTime();
      const bTime = new Date(b?.created_date || 0).getTime();
      return bTime - aTime;
    });
  }, [applications]);

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const openNew = () => {
    setEditId(null);
    setForm(emptyForm());
    setNewNote("");
    setShowDialog(true);
  };

  const openEdit = (app) => {
    setEditId(app.id);
    setForm({
      company: app.company || "",
      position: app.position || "",
      status: app.status || "saved",
      applied_date: app.applied_date || "",
      follow_up_date: app.follow_up_date || "",
      job_url: app.job_url || "",
      salary_range: app.salary_range || "",
      location: app.location || "",
      work_type: app.work_type || "",
      contact_name: app.contact_name || "",
      contact_title: app.contact_title || "",
      contact_email: app.contact_email || "",
      contact_phone: app.contact_phone || "",
      notes: app.notes || "",
      note_entries: Array.isArray(app.note_entries) ? app.note_entries : [],
      next_step: app.next_step || "",
      next_step_date: app.next_step_date || "",
    });
    setNewNote("");
    setShowDialog(true);
  };

  const closeDialog = () => {
    if (saving) return;
    setShowDialog(false);
    setEditId(null);
    setForm(emptyForm());
    setNewNote("");
  };

  const addNote = () => {
    const text = newNote.trim();
    if (!text) return;

    const entry = {
      text,
      created_at: new Date().toISOString(),
      created_by: "",
    };

    setForm((prev) => ({
      ...prev,
      note_entries: [...(prev.note_entries || []), entry],
    }));
    setNewNote("");
  };

  const removeNote = (index) => {
    setForm((prev) => ({
      ...prev,
      note_entries: (prev.note_entries || []).filter((_, i) => i !== index),
    }));
  };

     const handleSave = async () => {
    if (!clientId) {
      toast.error("Client id is required");
      return;
    }

    if (!form.company?.trim() || !form.position?.trim()) {
      toast.error("Company and position are required");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        company: form.company,
        position: form.position,
        status: form.status,
        notes: form.notes,
        running_notes: form.running_notes,
        client_id: clientId,

        // preserved extra fields for forward compatibility
        applied_date: form.applied_date || null,
        follow_up_date: form.follow_up_date || null,
        job_url: form.job_url || "",
        salary_range: form.salary_range || "",
        location: form.location || "",
        work_type: form.work_type || "",
        contact_name: form.contact_name || "",
        contact_title: form.contact_title || "",
        contact_email: form.contact_email || "",
        contact_phone: form.contact_phone || "",
        note_entries: Array.isArray(form.note_entries) ? form.note_entries : [],
        next_step: form.next_step || "",
        next_step_date: form.next_step_date || "",
      };

      if (editId) {
        await updateApplication(editId, payload);
        toast.success("Application updated");
      } else {
        await createApplication(payload);
        toast.success("Application added");
      }

            await onRefresh?.();
      setShowDialog(false);
      setEditId(null);
      setForm(emptyForm());
      setNewNote("");
    } catch (error) {
      console.error("Failed to save application:", error);
      toast.error("Failed to save application");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="inline-flex rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setActiveTab("applications")}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              activeTab === "applications"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            Applications ({applications.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("search")}
            className={cn(
              "flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              activeTab === "search"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            <Search className="h-3.5 w-3.5" />
            Live Job Search
          </button>
        </div>

        {activeTab === "applications" && (
          <Button onClick={openNew}>
            <Plus className="mr-2 h-4 w-4" />
            Add
          </Button>
        )}
      </div>

      {activeTab === "search" && (
        <Card className="border-slate-100 p-4">
          <LiveJobSearch client={client} />
        </Card>
      )}

      {activeTab === "applications" && (
        <div className="space-y-3">
          {sortedApplications.length === 0 ? (
            <Card className="border-slate-100 p-8 text-center text-sm text-slate-400">
              No applications yet
            </Card>
          ) : (
            sortedApplications.map((app) => (
              <Card
                key={app.id}
                className="cursor-pointer border-slate-100 p-4 transition-shadow hover:shadow-sm"
                onClick={() => openEdit(app)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-slate-900">
                        {app.position || "Untitled position"}
                      </h3>

                      <Badge
                        className={cn(
                          "border-0",
                          statusConfig[app.status]?.color ||
                            "bg-slate-100 text-slate-600"
                        )}
                      >
                        {statusConfig[app.status]?.label || app.status || "Unknown"}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
                      {app.company ? (
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3.5 w-3.5" />
                          {app.company}
                        </span>
                      ) : null}

                      {app.location ? (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {app.location}
                        </span>
                      ) : null}

                      {app.applied_date ? (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          Applied {safeFormatDate(app.applied_date)}
                        </span>
                      ) : null}
                    </div>

                    {app.contact_name ? (
                      <div className="mt-2 text-sm text-slate-500">
                        {app.contact_name}
                        {app.contact_title ? ` · ${app.contact_title}` : ""}
                      </div>
                    ) : null}

                    {app.next_step ? (
                      <div className="mt-2 text-sm text-slate-600">
                        <span className="font-medium">Next:</span> {app.next_step}
                      </div>
                    ) : null}

                    {app.notes ? (
                      <div className="mt-2 line-clamp-3 text-sm text-slate-500">
                        {app.notes}
                      </div>
                    ) : null}
                  </div>

                  {app.job_url ? (
                    <a
                      href={app.job_url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-slate-400 transition-colors hover:text-blue-600"
                      title="Open job posting"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  ) : null}
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={(open) => (!open ? closeDialog() : null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Application" : "New Application"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Company *</Label>
                <Input
                  value={form.company}
                  onChange={(e) => updateField("company", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Position *</Label>
                <Input
                  value={form.position}
                  onChange={(e) => updateField("position", e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={form.status || "saved"}
                  onValueChange={(value) => updateField("status", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusConfig).map(([key, value]) => (
                      <SelectItem key={key} value={key}>
                        {value.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Work Type</Label>
                <Select
                  value={form.work_type || ""}
                  onValueChange={(value) => updateField("work_type", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select work type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="remote">Remote</SelectItem>
                    <SelectItem value="hybrid">Hybrid</SelectItem>
                    <SelectItem value="on_site">On-site</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Applied Date</Label>
                <Input
                  type="date"
                  value={form.applied_date || ""}
                  onChange={(e) => updateField("applied_date", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Follow-up Date</Label>
                <Input
                  type="date"
                  value={form.follow_up_date || ""}
                  onChange={(e) => updateField("follow_up_date", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Next Step Date</Label>
                <Input
                  type="date"
                  value={form.next_step_date || ""}
                  onChange={(e) => updateField("next_step_date", e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Salary Range</Label>
                <Input
                  value={form.salary_range || ""}
                  onChange={(e) => updateField("salary_range", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Location</Label>
                <Input
                  value={form.location || ""}
                  onChange={(e) => updateField("location", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Job URL</Label>
                <Input
                  value={form.job_url || ""}
                  onChange={(e) => updateField("job_url", e.target.value)}
                />
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 p-4">
              <div className="mb-3 text-sm font-medium text-slate-900">
                Employer Contact
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Contact Name</Label>
                  <Input
                    value={form.contact_name || ""}
                    onChange={(e) => updateField("contact_name", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Contact Title</Label>
                  <Input
                    value={form.contact_title || ""}
                    onChange={(e) => updateField("contact_title", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Contact Email</Label>
                  <Input
                    value={form.contact_email || ""}
                    onChange={(e) => updateField("contact_email", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Contact Phone</Label>
                  <Input
                    value={form.contact_phone || ""}
                    onChange={(e) => updateField("contact_phone", e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Next Step</Label>
              <Input
                value={form.next_step || ""}
                onChange={(e) => updateField("next_step", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={form.notes || ""}
                onChange={(e) => updateField("notes", e.target.value)}
                rows={4}
              />
            </div>

            <div className="rounded-lg border border-slate-200 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-900">
                <StickyNote className="h-4 w-4" />
                Note Entries
              </div>

              <div className="space-y-3">
                {(form.note_entries || []).length === 0 ? (
                  <div className="text-sm text-slate-400">No notes yet</div>
                ) : (
                  (form.note_entries || []).map((entry, index) => (
                    <div
                      key={`${entry?.created_at || "note"}-${index}`}
                      className="flex items-start justify-between gap-3 rounded-md bg-slate-50 p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-slate-700">{entry?.text || ""}</div>
                        <div className="mt-1 text-xs text-slate-400">
                          {entry?.created_at
                            ? safeFormatDate(entry.created_at, "MMM d, yyyy h:mm a")
                            : ""}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeNote(index)}
                        className="shrink-0 text-slate-300 transition-colors hover:text-red-400"
                      >
                        <Trash2 className="mt-0.5 h-4 w-4" />
                      </button>
                    </div>
                  ))
                )}

                <div className="flex gap-2">
                  <Input
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Add a note entry"
                  />
                  <Button type="button" variant="outline" onClick={addNote}>
                    Add Note
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={closeDialog} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editId ? "Save Changes" : "Create Application"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
