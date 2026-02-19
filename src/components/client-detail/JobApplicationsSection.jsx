import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, ExternalLink, Building2, Calendar, MapPin } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const statusConfig = {
  saved: { color: "bg-slate-100 text-slate-600", label: "Saved" },
  applied: { color: "bg-blue-100 text-blue-700", label: "Applied" },
  phone_screen: { color: "bg-cyan-100 text-cyan-700", label: "Phone Screen" },
  interview: { color: "bg-violet-100 text-violet-700", label: "Interview" },
  final_round: { color: "bg-amber-100 text-amber-700", label: "Final Round" },
  offer: { color: "bg-emerald-100 text-emerald-700", label: "Offer" },
  rejected: { color: "bg-red-100 text-red-700", label: "Rejected" },
  accepted: { color: "bg-green-100 text-green-700", label: "Accepted" },
  withdrawn: { color: "bg-gray-100 text-gray-500", label: "Withdrawn" }
};

export default function JobApplicationsSection({ clientId, applications, onRefresh }) {
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);

  const openNew = () => {
    setForm({ company: "", position: "", status: "saved", applied_date: "", job_url: "", salary_range: "", location: "", work_type: "", contact_name: "", contact_email: "", notes: "", next_step: "", next_step_date: "" });
    setEditId(null);
    setShowNew(true);
  };

  const openEdit = (app) => {
    setForm({ ...app });
    setEditId(app.id);
    setShowNew(true);
  };

  const handleSave = async () => {
    setSaving(true);
    if (editId) {
      await base44.entities.JobApplication.update(editId, form);
      toast.success("Application updated");
    } else {
      await base44.entities.JobApplication.create({ ...form, client_id: clientId });
      toast.success("Application added");
    }
    setSaving(false);
    setShowNew(false);
    onRefresh();
  };

  const u = (f, v) => setForm(p => ({ ...p, [f]: v }));

  const sorted = [...applications].sort((a, b) => new Date(b.created_date) - new Date(a.created_date));

  return (
    <>
      <Card className="border-0 shadow-sm">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">Job Applications ({applications.length})</h3>
          <Button size="sm" variant="outline" onClick={openNew}><Plus className="w-3.5 h-3.5 mr-1" /> Add</Button>
        </div>
        <div className="divide-y divide-slate-50">
          {sorted.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">No applications yet</div>
          ) : sorted.map(app => (
            <div key={app.id} className="p-4 hover:bg-slate-25 transition-colors cursor-pointer" onClick={() => openEdit(app)}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-slate-800">{app.position}</p>
                    <Badge className={cn("text-[10px] border-0", statusConfig[app.status]?.color)}>{statusConfig[app.status]?.label}</Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                    <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{app.company}</span>
                    {app.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{app.location}</span>}
                    {app.applied_date && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{format(new Date(app.applied_date), "MMM d")}</span>}
                  </div>
                  {app.next_step && <p className="text-xs text-violet-600 mt-1">Next: {app.next_step}</p>}
                </div>
                {app.job_url && (
                  <a href={app.job_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-slate-400 hover:text-blue-600">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Application" : "New Application"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-3">
            <div className="space-y-1"><Label className="text-xs text-slate-500">Company *</Label><Input value={form.company || ""} onChange={e => u("company", e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs text-slate-500">Position *</Label><Input value={form.position || ""} onChange={e => u("position", e.target.value)} /></div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Status</Label>
              <Select value={form.status || "saved"} onValueChange={v => u("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(statusConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label className="text-xs text-slate-500">Applied Date</Label><Input type="date" value={form.applied_date || ""} onChange={e => u("applied_date", e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs text-slate-500">Job URL</Label><Input value={form.job_url || ""} onChange={e => u("job_url", e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs text-slate-500">Salary Range</Label><Input value={form.salary_range || ""} onChange={e => u("salary_range", e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs text-slate-500">Location</Label><Input value={form.location || ""} onChange={e => u("location", e.target.value)} /></div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Work Type</Label>
              <Select value={form.work_type || ""} onValueChange={v => u("work_type", v)}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="remote">Remote</SelectItem>
                  <SelectItem value="hybrid">Hybrid</SelectItem>
                  <SelectItem value="onsite">On-site</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label className="text-xs text-slate-500">Contact Name</Label><Input value={form.contact_name || ""} onChange={e => u("contact_name", e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs text-slate-500">Contact Email</Label><Input value={form.contact_email || ""} onChange={e => u("contact_email", e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs text-slate-500">Next Step</Label><Input value={form.next_step || ""} onChange={e => u("next_step", e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs text-slate-500">Next Step Date</Label><Input type="date" value={form.next_step_date || ""} onChange={e => u("next_step_date", e.target.value)} /></div>
            <div className="col-span-2 space-y-1"><Label className="text-xs text-slate-500">Notes</Label><Textarea value={form.notes || ""} onChange={e => u("notes", e.target.value)} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-slate-900 hover:bg-slate-800 text-white">{saving ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}