import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { Loader2, Building2, MapPin, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ImportFromIndeedDialog({ open, onClose, clientId, onImported }) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [parsed, setParsed] = useState(null); // { applications, profile_name }
  const [selected, setSelected] = useState([]); // selected indices
  const [saving, setSaving] = useState(false);

  const handleFetch = async () => {
    if (!url.trim()) {
      toast.error("Please enter your Indeed profile URL");
      return;
    }
    setLoading(true);
    setParsed(null);
    setSelected([]);
    try {
      const res = await base44.functions.invoke('importFromIndeed', {
        profileUrl: url.trim(),
        clientId
      });
      const data = res.data;
      if (data.error) {
        toast.error(data.error);
        return;
      }
      if (!data.applications || data.applications.length === 0) {
        toast.warning("No job applications found on that profile. Make sure it's a public Indeed profile.");
        return;
      }
      setParsed(data);
      setSelected(data.applications.map((_, i) => i)); // select all by default
    } catch (err) {
      toast.error("Failed to import: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (idx) => {
    setSelected(prev =>
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  };

  const handleImport = async () => {
    if (selected.length === 0) {
      toast.error("Select at least one application to import");
      return;
    }
    setSaving(true);
    try {
      const toImport = selected.map(i => parsed.applications[i]);
      await Promise.all(toImport.map(app =>
        base44.entities.JobApplication.create({
          client_id: clientId,
          company: app.company || "Unknown Company",
          position: app.position || "Unknown Position",
          location: app.location || "",
          applied_date: app.applied_date || "",
          work_type: app.work_type || undefined,
          salary_range: app.salary_range || "",
          status: "applied",
          notes: "Imported from Indeed profile"
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
    setUrl("");
    setParsed(null);
    setSelected([]);
    setLoading(false);
    setSaving(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <img src="https://upload.wikimedia.org/wikipedia/commons/f/fc/Indeed_logo.svg" alt="Indeed" className="h-5" />
            Import from Indeed
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
            <strong>How to get your Indeed profile URL:</strong><br />
            1. Go to <a href="https://my.indeed.com/profile" target="_blank" rel="noopener noreferrer" className="underline">indeed.com</a> and sign in<br />
            2. Click your name → "View public profile"<br />
            3. Copy the URL from your browser and paste it below
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-slate-500">Indeed Profile URL</Label>
            <div className="flex gap-2">
              <Input
                placeholder="https://www.indeed.com/r/..."
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !loading && handleFetch()}
                disabled={loading}
              />
              <Button onClick={handleFetch} disabled={loading || !url.trim()} className="shrink-0">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Fetch"}
              </Button>
            </div>
          </div>

          {loading && (
            <div className="flex flex-col items-center py-8 gap-2 text-sm text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              Scanning your Indeed profile...
            </div>
          )}

          {parsed && (
            <div className="space-y-3">
              {parsed.profile_name && (
                <p className="text-sm font-medium text-slate-700">
                  Found profile: <span className="text-blue-600">{parsed.profile_name}</span>
                </p>
              )}
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-800">
                  {parsed.applications.length} application{parsed.applications.length !== 1 ? 's' : ''} found
                </p>
                <button
                  className="text-xs text-blue-600 hover:underline"
                  onClick={() =>
                    selected.length === parsed.applications.length
                      ? setSelected([])
                      : setSelected(parsed.applications.map((_, i) => i))
                  }
                >
                  {selected.length === parsed.applications.length ? "Deselect all" : "Select all"}
                </button>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {parsed.applications.map((app, idx) => (
                  <div
                    key={idx}
                    onClick={() => toggleSelect(idx)}
                    className={cn(
                      "p-3 border rounded-lg cursor-pointer transition-all",
                      selected.includes(idx)
                        ? "border-blue-400 bg-blue-50"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <div className={cn(
                        "w-4 h-4 rounded border-2 flex items-center justify-center mt-0.5 shrink-0",
                        selected.includes(idx) ? "bg-blue-500 border-blue-500" : "border-slate-300"
                      )}>
                        {selected.includes(idx) && <CheckCircle2 className="w-3 h-3 text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800">{app.position}</p>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 flex-wrap">
                          <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{app.company}</span>
                          {app.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{app.location}</span>}
                          {app.applied_date && <span>{app.applied_date}</span>}
                        </div>
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {app.work_type && app.work_type !== '' && (
                            <Badge className="text-[10px] bg-slate-100 text-slate-600 border-0 capitalize">{app.work_type}</Badge>
                          )}
                          {app.salary_range && (
                            <Badge className="text-[10px] bg-green-50 text-green-700 border-0">{app.salary_range}</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
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