import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, FileText, Star, Trash2, GraduationCap, Briefcase } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import ImportFromLinkedInDialog from "@/components/client-detail/ImportFromLinkedInDialog";

export default function ResumeSection({ clientId, resumes, onRefresh }) {
  const [showLinkedInImport, setShowLinkedInImport] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [form, setForm] = useState({});
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [newSkill, setNewSkill] = useState("");

  const openNew = () => {
    setForm({ title: "", summary: "", experience: [], education: [], skills: [], certifications: [], is_primary: false });
    setEditId(null);
    setShowEditor(true);
  };

  const openEdit = (resume) => {
    setForm({ ...resume });
    setEditId(resume.id);
    setShowEditor(true);
  };

  const handleSave = async () => {
    setSaving(true);
    if (editId) {
      await base44.entities.Resume.update(editId, form);
      toast.success("Resume updated");
    } else {
      await base44.entities.Resume.create({ ...form, client_id: clientId });
      toast.success("Resume created");
    }
    setSaving(false);
    setShowEditor(false);
    onRefresh();
  };

  const u = (f, v) => setForm(p => ({ ...p, [f]: v }));

  const addExperience = () => {
    u("experience", [...(form.experience || []), { company: "", role: "", start_date: "", end_date: "", description: "", current: false }]);
  };

  const updateExperience = (i, f, v) => {
    const exp = [...(form.experience || [])];
    exp[i] = { ...exp[i], [f]: v };
    u("experience", exp);
  };

  const removeExperience = (i) => {
    u("experience", form.experience.filter((_, idx) => idx !== i));
  };

  const addEducation = () => {
    u("education", [...(form.education || []), { institution: "", degree: "", field: "", graduation_year: "" }]);
  };

  const updateEducation = (i, f, v) => {
    const edu = [...(form.education || [])];
    edu[i] = { ...edu[i], [f]: v };
    u("education", edu);
  };

  const removeEducation = (i) => {
    u("education", form.education.filter((_, idx) => idx !== i));
  };

  const addSkill = () => {
    if (!newSkill.trim()) return;
    u("skills", [...(form.skills || []), newSkill.trim()]);
    setNewSkill("");
  };

  const removeSkill = (i) => {
    u("skills", form.skills.filter((_, idx) => idx !== i));
  };

  return (
    <>
      <Card className="border-0 shadow-sm">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">Resumes ({resumes.length})</h3>
          <Button size="sm" variant="outline" onClick={openNew}><Plus className="w-3.5 h-3.5 mr-1" /> New Version</Button>
        </div>
        <div className="divide-y divide-slate-50">
          {resumes.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">No resumes yet</div>
          ) : resumes.map(r => (
            <div key={r.id} className="p-4 flex items-center gap-3 hover:bg-slate-25 cursor-pointer" onClick={() => openEdit(r)}>
              <div className="p-2 bg-slate-50 rounded-lg"><FileText className="w-4 h-4 text-slate-500" /></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-slate-800">{r.title}</p>
                  {r.is_primary && <Badge className="text-[10px] bg-amber-100 text-amber-700 border-0">Primary</Badge>}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {r.skills?.length || 0} skills · {r.experience?.length || 0} positions · {r.education?.length || 0} education
                </p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Dialog open={showEditor} onOpenChange={setShowEditor}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? "Edit Resume" : "New Resume"}</DialogTitle></DialogHeader>
          <div className="space-y-6 py-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs text-slate-500">Version Title *</Label><Input value={form.title || ""} onChange={e => u("title", e.target.value)} placeholder="e.g. Marketing Resume v2" /></div>
              <div className="flex items-end">
                <Button variant={form.is_primary ? "default" : "outline"} size="sm" onClick={() => u("is_primary", !form.is_primary)} className={form.is_primary ? "bg-amber-500 hover:bg-amber-600" : ""}>
                  <Star className="w-3.5 h-3.5 mr-1" /> {form.is_primary ? "Primary" : "Set as Primary"}
                </Button>
              </div>
            </div>
            <div className="space-y-1"><Label className="text-xs text-slate-500">Professional Summary</Label><Textarea value={form.summary || ""} onChange={e => u("summary", e.target.value)} rows={3} /></div>

            {/* Experience */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs text-slate-500 flex items-center gap-1"><Briefcase className="w-3 h-3" /> Experience</Label>
                <Button size="sm" variant="ghost" onClick={addExperience}><Plus className="w-3 h-3 mr-1" /> Add</Button>
              </div>
              <div className="space-y-3">
                {(form.experience || []).map((exp, i) => (
                  <div key={i} className="border border-slate-100 rounded-lg p-3 space-y-2">
                    <div className="flex justify-between items-start">
                      <div className="grid grid-cols-2 gap-2 flex-1">
                        <Input placeholder="Company" value={exp.company || ""} onChange={e => updateExperience(i, "company", e.target.value)} className="text-sm" />
                        <Input placeholder="Role" value={exp.role || ""} onChange={e => updateExperience(i, "role", e.target.value)} className="text-sm" />
                        <Input placeholder="Start (e.g. Jan 2020)" value={exp.start_date || ""} onChange={e => updateExperience(i, "start_date", e.target.value)} className="text-sm" />
                        <Input placeholder="End (or Present)" value={exp.end_date || ""} onChange={e => updateExperience(i, "end_date", e.target.value)} className="text-sm" />
                      </div>
                      <Button variant="ghost" size="icon" className="shrink-0 ml-2" onClick={() => removeExperience(i)}><Trash2 className="w-3.5 h-3.5 text-red-400" /></Button>
                    </div>
                    <Textarea placeholder="Description..." value={exp.description || ""} onChange={e => updateExperience(i, "description", e.target.value)} rows={2} className="text-sm" />
                  </div>
                ))}
              </div>
            </div>

            {/* Education */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs text-slate-500 flex items-center gap-1"><GraduationCap className="w-3 h-3" /> Education</Label>
                <Button size="sm" variant="ghost" onClick={addEducation}><Plus className="w-3 h-3 mr-1" /> Add</Button>
              </div>
              <div className="space-y-3">
                {(form.education || []).map((edu, i) => (
                  <div key={i} className="border border-slate-100 rounded-lg p-3 flex gap-2">
                    <div className="grid grid-cols-2 gap-2 flex-1">
                      <Input placeholder="Institution" value={edu.institution || ""} onChange={e => updateEducation(i, "institution", e.target.value)} className="text-sm" />
                      <Input placeholder="Degree" value={edu.degree || ""} onChange={e => updateEducation(i, "degree", e.target.value)} className="text-sm" />
                      <Input placeholder="Field" value={edu.field || ""} onChange={e => updateEducation(i, "field", e.target.value)} className="text-sm" />
                      <Input placeholder="Year" value={edu.graduation_year || ""} onChange={e => updateEducation(i, "graduation_year", e.target.value)} className="text-sm" />
                    </div>
                    <Button variant="ghost" size="icon" className="shrink-0" onClick={() => removeEducation(i)}><Trash2 className="w-3.5 h-3.5 text-red-400" /></Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Skills */}
            <div>
              <Label className="text-xs text-slate-500 mb-2 block">Skills</Label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {(form.skills || []).map((s, i) => (
                  <Badge key={i} className="bg-slate-100 text-slate-700 border-0 cursor-pointer hover:bg-red-100 hover:text-red-700" onClick={() => removeSkill(i)}>{s} ×</Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input placeholder="Add skill..." value={newSkill} onChange={e => setNewSkill(e.target.value)} onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addSkill())} className="text-sm" />
                <Button variant="outline" size="sm" onClick={addSkill}>Add</Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditor(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-slate-900 hover:bg-slate-800 text-white">{saving ? "Saving..." : "Save Resume"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}