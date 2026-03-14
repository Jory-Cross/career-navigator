import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { Loader2, Building2, MapPin, CheckCircle2, ChevronDown, ChevronUp, Bell } from "lucide-react";
import { cn } from "@/lib/utils";

const statusOptions = [
  { value: "saved", label: "Saved" },
  { value: "applied", label: "Applied" },
  { value: "phone_screen", label: "Phone Screen" },
  { value: "interview", label: "Interview" },
  { value: "final_round", label: "Final Round" },
  { value: "offer", label: "Offer" },
  { value: "rejected", label: "Rejected" },
  { value: "accepted", label: "Accepted" },
  { value: "withdrawn", label: "Withdrawn" },
];

function AppEditRow({ app, selected, onToggle, onChange }) {
  const [expanded, setExpanded] = useState(false);

  const u = (field, value) => onChange({ ...app, [field]: value });

  return (
    <div className={cn(
      "border rounded-lg transition-all",
      selected ? "border-blue-400 bg-blue-50/50" : "border-slate-200 bg-white"
    )}>
      {/* Header row */}
      <div className="flex items-start gap-2 p-3 cursor-pointer" onClick={onToggle}>
        <div className={cn(
          "w-4 h-4 rounded border-2 flex items-center justify-center mt-0.5 shrink-0",
          selected ? "bg-blue-500 border-blue-500" : "border-slate-300"
        )}>
          {selected && <CheckCircle2 className="w-3 h-3 text-white" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-800">{app.position || "Unknown Position"}</p>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 flex-wrap">
            <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{app.company || "Unknown"}</span>
            {app.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{app.location}</span>}
            {app.applied_date && <span>{app.applied_date}</span>}
            {app.work_type && <Badge className="text-[10px] bg-slate-100 text-slate-600 border-0 capitalize">{app.work_type}</Badge>}
          </div>
        </div>
        <button
          onClick={e => { e.stopPropagation(); setExpanded(v => !v); }}
          className="text-slate-400 hover:text-slate-600 ml-1 shrink-0"
          title="Edit details"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Expanded edit fields */}
      {expanded && (
        <div className="px-3 pb-3 border-t border-slate-100 pt-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Company *</Label>
              <Input value={app.company || ""} onChange={e => u("company", e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Position *</Label>
              <Input value={app.position || ""} onChange={e => u("position", e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Status</Label>
              <Select value={app.status || "applied"} onValueChange={v => u("status", v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {statusOptions.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Applied Date</Label>
              <Input type="date" value={app.applied_date || ""} onChange={e => u("applied_date", e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Job URL</Label>
              <Input value={app.job_url || ""} onChange={e => u("job_url", e.target.value)} className="h-8 text-xs" placeholder="https://..." />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Salary Range</Label>
              <Input value={app.salary_range || ""} onChange={e => u("salary_range", e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Location</Label>
              <Input value={app.location || ""} onChange={e => u("location", e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Work Type</Label>
              <Select value={app.work_type || ""} onValueChange={v => u("work_type", v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="remote">Remote</SelectItem>
                  <SelectItem value="hybrid">Hybrid</SelectItem>
                  <SelectItem value="onsite">On-site</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Contact Name</Label>
              <Input value={app.contact_name || ""} onChange={e => u("contact_name", e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Contact Email</Label>
              <Input value={app.contact_email || ""} onChange={e => u("contact_email", e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Next Step</Label>
              <Input value={app.next_step || ""} onChange={e => u("next_step", e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Next Step Date</Label>
              <Input type="date" value={app.next_step_date || ""} onChange={e => u("next_step_date", e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs text-slate-500">Notes</Label>
              <Textarea value={app.notes || ""} onChange={e => u("notes", e.target.value)} rows={2} className="text-xs" />
            </div>
          </div>

          {/* Follow-up */}
          <div className="border-t border-slate-100 pt-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Bell className="w-3.5 h-3.5 text-blue-600" />
              <Label className="text-xs font-semibold">Follow-up Reminders</Label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">Follow-up after (days)</Label>
                <Input
                  type="number"
                  value={app.follow_up_cadence_days || 7}
                  onChange={e => u("follow_up_cadence_days", parseInt(e.target.value))}
                  min="1"
                  className="h-8 text-xs"
                />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={app.follow_up_enabled !== false}
                    onChange={e => u("follow_up_enabled", e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300"
                  />
                  <span className="text-xs text-slate-600">Enable reminders</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ImportFromIndeedDialog({ open, onClose, clientId, onImported }) {
  const [pastedText, setPastedText] = useState("");
  const [loading, setLoading] = useState(false);
  const [applications, setApplications] = useState([]);
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);
  const [parsed, setParsed] = useState(false);

  const handleParse = async () => {
    if (!pastedText.trim()) {
      toast.error("Please paste your Indeed jobs text first");
      return;
    }
    setLoading(true);
    setApplications([]);
    setSelected([]);
    setParsed(false);
    try {
      const res = await base44.functions.invoke('importFromIndeed', {
        pastedText: pastedText.trim(),
        clientId
      });
      const data = res.data;
      if (data.error) {
        toast.error(data.error);
        return;
      }
      if (!data.applications || data.applications.length === 0) {
        toast.warning("No job applications found. Try selecting more text from the Indeed page.");
        return;
      }
      // Enrich with default tracking fields
      const enriched = data.applications.map(app => ({
        ...app,
        status: "applied",
        follow_up_cadence_days: 7,
        follow_up_enabled: true,
        notes: "",
        job_url: "",
        contact_name: "",
        contact_email: "",
        next_step: "",
        next_step_date: "",
      }));
      setApplications(enriched);
      setSelected(enriched.map((_, i) => i));
      setParsed(true);
    } catch (err) {
      toast.error("Failed to parse: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (idx) => {
    setSelected(prev =>
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  };

  const updateApp = (idx, updatedApp) => {
    setApplications(prev => prev.map((a, i) => i === idx ? updatedApp : a));
  };

  const handleImport = async () => {
    if (selected.length === 0) {
      toast.error("Select at least one application to import");
      return;
    }
    setSaving(true);
    try {
      const toImport = selected.map(i => applications[i]);
      await Promise.all(toImport.map(app =>
        base44.entities.JobApplication.create({
          client_id: clientId,
          company: app.company || "Unknown Company",
          position: app.position || "Unknown Position",
          location: app.location || "",
          applied_date: app.applied_date || "",
          work_type: app.work_type || undefined,
          salary_range: app.salary_range || "",
          status: app.status || "applied",
          job_url: app.job_url || "",
          contact_name: app.contact_name || "",
          contact_email: app.contact_email || "",
          notes: app.notes || "Imported from Indeed",
          next_step: app.next_step || "",
          next_step_date: app.next_step_date || "",
          follow_up_cadence_days: app.follow_up_cadence_days || 7,
          follow_up_enabled: app.follow_up_enabled !== false,
        })
      ));
      toast.success(`Imported ${selected.length} application${selected.length > 1 ? 's' : ''}`);
      onImported();
      handleClose();
    } catch (err) {
      toast.error("Failed to save applications");
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setPastedText("");
    setApplications([]);
    setSelected([]);
    setLoading(false);
    setSaving(false);
    setParsed(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <img src="https://upload.wikimedia.org/wikipedia/commons/f/fc/Indeed_logo.svg" alt="Indeed" className="h-5" />
            Import from Indeed
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700 space-y-1">
            <strong>How to import your Indeed applications:</strong>
            <ol className="list-decimal list-inside space-y-0.5 mt-1">
              <li>Go to <a href="https://my.indeed.com/jobs?applied=1" target="_blank" rel="noopener noreferrer" className="underline font-medium">indeed.com → My Jobs → Applied</a></li>
              <li>Select all text on the page (<strong>Ctrl+A</strong> or <strong>Cmd+A</strong>)</li>
              <li>Copy it (<strong>Ctrl+C</strong> or <strong>Cmd+C</strong>)</li>
              <li>Paste it below and click <strong>Parse</strong></li>
            </ol>
          </div>

          {!parsed && (
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Paste Indeed page text here</Label>
              <Textarea
                placeholder="Paste the copied text from your Indeed 'Applied Jobs' page here..."
                value={pastedText}
                onChange={e => setPastedText(e.target.value)}
                className="min-h-[120px] text-xs"
                disabled={loading}
              />
              <Button onClick={handleParse} disabled={loading || !pastedText.trim()} className="w-full mt-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                {loading ? "Parsing..." : "Parse Applications"}
              </Button>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center py-4 gap-2 text-sm text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              Reading your Indeed applications...
            </div>
          )}

          {parsed && applications.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-800">
                  {applications.length} application{applications.length !== 1 ? 's' : ''} found
                </p>
                <div className="flex gap-3">
                  <button
                    className="text-xs text-blue-600 hover:underline"
                    onClick={() =>
                      selected.length === applications.length
                        ? setSelected([])
                        : setSelected(applications.map((_, i) => i))
                    }
                  >
                    {selected.length === applications.length ? "Deselect all" : "Select all"}
                  </button>
                  <button
                    className="text-xs text-slate-400 hover:underline"
                    onClick={() => { setParsed(false); setPastedText(""); setSelected([]); setApplications([]); }}
                  >
                    Start over
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-500">Click the <strong>↓</strong> arrow on any application to edit its details before importing.</p>

              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {applications.map((app, idx) => (
                  <AppEditRow
                    key={idx}
                    app={app}
                    selected={selected.includes(idx)}
                    onToggle={() => toggleSelect(idx)}
                    onChange={(updated) => updateApp(idx, updated)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          {parsed && (
            <Button onClick={handleImport} disabled={saving || selected.length === 0}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Import {selected.length > 0 ? `${selected.length} ` : ''}Application{selected.length !== 1 ? 's' : ''}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}