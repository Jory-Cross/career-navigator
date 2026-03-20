import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { Loader2, Briefcase, GraduationCap, Zap, CheckCircle2, ChevronDown, ChevronUp, Bell } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ImportFromLinkedInDialog({ open, onClose, clientId, onImported }) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [parsed, setParsed] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleFetch = async () => {
    if (!url.trim()) {
      toast.error("Please enter a LinkedIn profile URL");
      return;
    }
    setLoading(true);
    setParsed(null);
    try {
      const res = await base44.functions.invoke('importFromLinkedIn', { profileUrl: url.trim() });
      const data = res.data;
      if (data.error) {
        toast.error(data.error);
        return;
      }
      if (!data.full_name && !data.experience?.length && !data.education?.length) {
        toast.warning("Couldn't extract profile data. Make sure the profile is public.");
        return;
      }
      setParsed(data);
    } catch (err) {
      toast.error("Failed to import: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    setSaving(true);
    try {
      const title = parsed.full_name
        ? `${parsed.full_name} — LinkedIn Import`
        : "LinkedIn Import";

      await base44.entities.Resume.create({
        client_id: clientId,
        title,
        summary: parsed.summary || parsed.headline || "",
        experience: parsed.experience || [],
        education: parsed.education || [],
        skills: parsed.skills || [],
        certifications: parsed.certifications || [],
        is_primary: false,
      });

      toast.success("Resume imported from LinkedIn!");
      onImported();
      handleClose();
    } catch (err) {
      toast.error("Failed to save resume");
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setUrl("");
    setParsed(null);
    setLoading(false);
    setSaving(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="#0077b5"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
            Import from LinkedIn
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700 space-y-1">
            <strong>How to get your public LinkedIn URL:</strong>
            <ol className="list-decimal list-inside space-y-0.5 mt-1">
              <li>Go to your <a href="https://www.linkedin.com/in/" target="_blank" rel="noopener noreferrer" className="underline font-medium">LinkedIn profile</a></li>
              <li>Click <strong>"More" → "View Profile"</strong> to see your public URL</li>
              <li>Make sure your profile is set to <strong>public</strong></li>
              <li>Copy the URL (e.g. linkedin.com/in/yourname) and paste below</li>
            </ol>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-slate-500">LinkedIn Profile URL</Label>
            <div className="flex gap-2">
              <Input
                placeholder="https://www.linkedin.com/in/yourname"
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !loading && handleFetch()}
                disabled={loading || !!parsed}
              />
              {!parsed && (
                <Button onClick={handleFetch} disabled={loading || !url.trim()} className="shrink-0">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Fetch"}
                </Button>
              )}
            </div>
          </div>

          {loading && (
            <div className="flex flex-col items-center py-8 gap-2 text-sm text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              Scanning LinkedIn profile...
            </div>
          )}

          {parsed && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-green-800">{parsed.full_name || "Profile found"}</p>
                  {parsed.headline && <p className="text-xs text-green-700">{parsed.headline}</p>}
                </div>
              </div>

              {parsed.summary && (
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs font-semibold text-slate-600 mb-1">Summary</p>
                  <p className="text-xs text-slate-700 line-clamp-3">{parsed.summary}</p>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 bg-slate-50 rounded-lg">
                  <Briefcase className="w-4 h-4 text-slate-500 mx-auto mb-1" />
                  <p className="text-lg font-bold text-slate-800">{parsed.experience?.length || 0}</p>
                  <p className="text-xs text-slate-500">Positions</p>
                </div>
                <div className="p-2 bg-slate-50 rounded-lg">
                  <GraduationCap className="w-4 h-4 text-slate-500 mx-auto mb-1" />
                  <p className="text-lg font-bold text-slate-800">{parsed.education?.length || 0}</p>
                  <p className="text-xs text-slate-500">Education</p>
                </div>
                <div className="p-2 bg-slate-50 rounded-lg">
                  <Zap className="w-4 h-4 text-slate-500 mx-auto mb-1" />
                  <p className="text-lg font-bold text-slate-800">{parsed.skills?.length || 0}</p>
                  <p className="text-xs text-slate-500">Skills</p>
                </div>
              </div>

              {parsed.skills?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-600 mb-1.5">Skills Preview</p>
                  <div className="flex flex-wrap gap-1">
                    {parsed.skills.slice(0, 12).map((s, i) => (
                      <Badge key={i} className="text-[10px] bg-slate-100 text-slate-600 border-0">{s}</Badge>
                    ))}
                    {parsed.skills.length > 12 && (
                      <Badge className="text-[10px] bg-slate-100 text-slate-500 border-0">+{parsed.skills.length - 12} more</Badge>
                    )}
                  </div>
                </div>
              )}

              <button
                className="text-xs text-slate-400 hover:underline"
                onClick={() => { setParsed(null); setUrl(""); }}
              >
                Try a different URL
              </button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          {parsed && (
            <Button onClick={handleImport} disabled={saving} className="bg-[#0077b5] hover:bg-[#005885] text-white">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Import as Resume
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}