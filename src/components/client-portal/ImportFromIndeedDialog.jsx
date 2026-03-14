import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { Loader2, Building2, MapPin, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ImportFromIndeedDialog({ open, onClose, clientId, onImported }) {
  const [pastedText, setPastedText] = useState("");
  const [loading, setLoading] = useState(false);
  const [parsed, setParsed] = useState(null);
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);

  const handleParse = async () => {
    if (!pastedText.trim()) {
      toast.error("Please paste your Indeed jobs text first");
      return;
    }
    setLoading(true);
    setParsed(null);
    setSelected([]);
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
      setParsed(data);
      setSelected(data.applications.map((_, i) => i));
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
          notes: "Imported from Indeed"
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
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700 space-y-1">
            <strong>How to import your Indeed applications:</strong>
            <ol className="list-decimal list-inside space-y-0.5 mt-1">
              <li>Go to <a href="https://my.indeed.com/jobs?applied=1" target="_blank" rel="noopener noreferrer" className="underline font-medium">indeed.com → My Jobs → Applied</a></li>
              <li>Select all text on the page (<strong>Ctrl+A</strong> or <strong>Cmd+A</strong>)</li>
              <li>Copy it (<strong>Ctrl+C</strong> or <strong>Cmd+C</strong>)</li>
              <li>Paste it in the box below and click <strong>Parse</strong></li>
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

          {parsed && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-800">
                  {parsed.applications.length} application{parsed.applications.length !== 1 ? 's' : ''} found
                </p>
                <div className="flex gap-3">
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
                  <button
                    className="text-xs text-slate-400 hover:underline"
                    onClick={() => { setParsed(null); setPastedText(""); setSelected([]); }}
                  >
                    Start over
                  </button>
                </div>
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