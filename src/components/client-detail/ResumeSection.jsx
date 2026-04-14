import React, { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  FileText,
  Star,
  Trash2,
  GraduationCap,
  Briefcase,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { base44 } from "@/api/base44Client";
import { cn } from "@/lib/utils";
import ImportFromLinkedInDialog from "@/components/client-detail/ImportFromLinkedInDialog";
import AIResumeBuilder from "@/components/client-detail/AIResumeBuilder";

const resumeApi = {
  async list(clientId) {
    if (!clientId) return [];
    const result = await base44.entities.Resume.filter({ client_id: clientId });
    return Array.isArray(result) ? result : [];
  },

  async create(clientId, payload) {
    return await base44.entities.Resume.create({
      ...payload,
      client_id: clientId,
    });
  },

  async update(id, payload) {
    return await base44.entities.Resume.update(id, payload);
  },

  async remove(id) {
    return await base44.entities.Resume.delete(id);
  },
};

function emptyResume() {
  return {
    title: "",
    summary: "",
    experience: [],
    education: [],
    skills: [],
    certifications: [],
    is_primary: false,
  };
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function sortResumes(items) {
  return [...normalizeArray(items)].sort((a, b) => {
    if (a?.is_primary && !b?.is_primary) return -1;
    if (!a?.is_primary && b?.is_primary) return 1;

    const aTime = new Date(a?.updated_date || a?.created_date || 0).getTime();
    const bTime = new Date(b?.updated_date || b?.created_date || 0).getTime();

    return bTime - aTime;
  });
}

export default function ResumeSection({ clientId, client }) {
  const [resumes, setResumes] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const [showLinkedInImport, setShowLinkedInImport] = useState(false);
  const [showAIBuilder, setShowAIBuilder] = useState(false);
  const [showEditor, setShowEditor] = useState(false);

  const [form, setForm] = useState(emptyResume());
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newSkill, setNewSkill] = useState("");

  const sortedResumes = useMemo(() => sortResumes(resumes), [resumes]);

  const loadResumes = async () => {
    if (!clientId) {
      setResumes([]);
      setLoaded(true);
      return;
    }

    try {
      setLoading(true);
      const rows = await resumeApi.list(clientId);
      setResumes(sortResumes(rows));
    } catch (error) {
      console.error("[ResumeSection] Failed to load resumes:", error);
      toast.error("Failed to load resumes");
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  };

  React.useEffect(() => {
    loadResumes();
  }, [clientId]);

  const u = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const openNew = () => {
    setForm(emptyResume());
    setEditId(null);
    setNewSkill("");
    setShowEditor(true);
  };

  const openEdit = (resume) => {
    setForm({
      ...emptyResume(),
      ...resume,
      experience: normalizeArray(resume?.experience),
      education: normalizeArray(resume?.education),
      skills: normalizeArray(resume?.skills),
      certifications: normalizeArray(resume?.certifications),
    });
    setEditId(resume.id);
    setNewSkill("");
    setShowEditor(true);
  };

  const handleSave = async () => {
    if (!clientId) {
      toast.error("Missing client id");
      return;
    }

    if (!String(form.title || "").trim()) {
      toast.error("Resume title is required");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        ...form,
        title: String(form.title || "").trim(),
        summary: String(form.summary || "").trim(),
        experience: normalizeArray(form.experience),
        education: normalizeArray(form.education),
        skills: normalizeArray(form.skills),
        certifications: normalizeArray(form.certifications),
        is_primary: !!form.is_primary,
      };

      if (editId) {
        await resumeApi.update(editId, payload);
        toast.success("Resume updated");
      } else {
        await resumeApi.create(clientId, payload);
        toast.success("Resume created");
      }

      setShowEditor(false);
      setEditId(null);
      await loadResumes();
    } catch (error) {
      console.error("[ResumeSection] Failed to save resume:", error);
      toast.error("Failed to save resume");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (resume) => {
    if (!resume?.id) return;
    if (!window.confirm("Delete this resume?")) return;

    try {
      await resumeApi.remove(resume.id);
      toast.success("Resume deleted");
      await loadResumes();
    } catch (error) {
      console.error("[ResumeSection] Failed to delete resume:", error);
      toast.error("Failed to delete resume");
    }
  };

  const addExperience = () => {
    u("experience", [
      ...normalizeArray(form.experience),
      {
        company: "",
        role: "",
        start_date: "",
        end_date: "",
        description: "",
        current: false,
      },
    ]);
  };

  const updateExperience = (index, field, value) => {
    const next = [...normalizeArray(form.experience)];
    next[index] = { ...next[index], [field]: value };
    u("experience", next);
  };

  const removeExperience = (index) => {
    u(
      "experience",
      normalizeArray(form.experience).filter((_, idx) => idx !== index)
    );
  };

  const addEducation = () => {
    u("education", [
      ...normalizeArray(form.education),
      {
        institution: "",
        degree: "",
        field: "",
        graduation_year: "",
      },
    ]);
  };

  const updateEducation = (index, field, value) => {
    const next = [...normalizeArray(form.education)];
    next[index] = { ...next[index], [field]: value };
    u("education", next);
  };

  const removeEducation = (index) => {
    u(
      "education",
      normalizeArray(form.education).filter((_, idx) => idx !== index)
    );
  };

  const addSkill = () => {
    const value = String(newSkill || "").trim();
    if (!value) return;

    u("skills", [...normalizeArray(form.skills), value]);
    setNewSkill("");
  };

  const removeSkill = (index) => {
    u(
      "skills",
      normalizeArray(form.skills).filter((_, idx) => idx !== index)
    );
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h3 className="text-lg font-semibold">
            Resumes ({sortedResumes.length})
          </h3>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => setShowAIBuilder(true)}
              className="text-purple-600 border-purple-200 hover:bg-purple-50"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              AI Builder
            </Button>

            <Button
              variant="outline"
              onClick={() => setShowLinkedInImport(true)}
            >
              Import LinkedIn
            </Button>

            <Button onClick={openNew}>
              <Plus className="w-4 h-4 mr-2" />
              New Version
            </Button>
          </div>
        </div>

        {!loaded || loading ? (
          <Card className="p-6 text-sm text-muted-foreground">Loading resumes...</Card>
        ) : sortedResumes.length === 0 ? (
          <Card className="p-6 text-sm text-muted-foreground">No resumes yet</Card>
        ) : (
          <div className="grid gap-3">
            {sortedResumes.map((resume) => (
              <Card
                key={resume.id}
                className={cn(
                  "p-4 cursor-pointer transition hover:shadow-sm",
                  resume.is_primary && "border-amber-300 bg-amber-50/40"
                )}
                onClick={() => openEdit(resume)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <FileText className="w-4 h-4 text-slate-500" />
                      <div className="font-medium truncate">
                        {resume.title || "Untitled Resume"}
                      </div>
                      {resume.is_primary ? (
                        <Badge className="bg-amber-500 hover:bg-amber-500">
                          <Star className="w-3 h-3 mr-1" />
                          Primary
                        </Badge>
                      ) : null}
                    </div>

                    <div className="mt-2 text-sm text-muted-foreground">
                      {normalizeArray(resume.skills).length} skills ·{" "}
                      {normalizeArray(resume.experience).length} positions ·{" "}
                      {normalizeArray(resume.education).length} education
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(resume);
                    }}
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <AIResumeBuilder
        open={showAIBuilder}
        onClose={() => setShowAIBuilder(false)}
        client={client}
        clientId={clientId}
        onSaved={async () => {
          setShowAIBuilder(false);
          await loadResumes();
        }}
      />

      <ImportFromLinkedInDialog
        open={showLinkedInImport}
        onClose={() => setShowLinkedInImport(false)}
        clientId={clientId}
        onImported={async () => {
          setShowLinkedInImport(false);
          await loadResumes();
        }}
      />

      <Dialog open={showEditor} onOpenChange={setShowEditor}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Resume" : "New Resume"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <div>
              <Label>Version Title *</Label>
              <Input
                value={form.title || ""}
                onChange={(e) => u("title", e.target.value)}
                placeholder="e.g. Marketing Resume v2"
              />
            </div>

            <div className="flex justify-start">
              <Button
                type="button"
                variant={form.is_primary ? "default" : "outline"}
                onClick={() => u("is_primary", !form.is_primary)}
                className={form.is_primary ? "bg-amber-500 hover:bg-amber-600" : ""}
              >
                <Star className="w-4 h-4 mr-2" />
                {form.is_primary ? "Primary" : "Set as Primary"}
              </Button>
            </div>

            <div>
              <Label>Professional Summary</Label>
              <Textarea
                value={form.summary || ""}
                onChange={(e) => u("summary", e.target.value)}
                rows={3}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs text-slate-500 flex items-center gap-1">
                  <Briefcase className="w-3 h-3" />
                  Experience
                </Label>
                <Button size="sm" variant="ghost" onClick={addExperience}>
                  <Plus className="w-3 h-3 mr-1" />
                  Add
                </Button>
              </div>

              <div className="space-y-3">
                {normalizeArray(form.experience).map((exp, index) => (
                  <div key={index} className="border border-slate-100 rounded-lg p-3 space-y-2">
                    <div className="flex justify-between items-start gap-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 flex-1">
                        <Input
                          placeholder="Company"
                          value={exp.company || ""}
                          onChange={(e) =>
                            updateExperience(index, "company", e.target.value)
                          }
                        />
                        <Input
                          placeholder="Role"
                          value={exp.role || ""}
                          onChange={(e) =>
                            updateExperience(index, "role", e.target.value)
                          }
                        />
                        <Input
                          placeholder="Start (e.g. Jan 2020)"
                          value={exp.start_date || ""}
                          onChange={(e) =>
                            updateExperience(index, "start_date", e.target.value)
                          }
                        />
                        <Input
                          placeholder="End (or Present)"
                          value={exp.end_date || ""}
                          onChange={(e) =>
                            updateExperience(index, "end_date", e.target.value)
                          }
                        />
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeExperience(index)}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      </Button>
                    </div>

                    <Textarea
                      placeholder="Description..."
                      value={exp.description || ""}
                      onChange={(e) =>
                        updateExperience(index, "description", e.target.value)
                      }
                      rows={2}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs text-slate-500 flex items-center gap-1">
                  <GraduationCap className="w-3 h-3" />
                  Education
                </Label>
                <Button size="sm" variant="ghost" onClick={addEducation}>
                  <Plus className="w-3 h-3 mr-1" />
                  Add
                </Button>
              </div>

              <div className="space-y-3">
                {normalizeArray(form.education).map((edu, index) => (
                  <div key={index} className="border border-slate-100 rounded-lg p-3 flex gap-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 flex-1">
                      <Input
                        placeholder="Institution"
                        value={edu.institution || ""}
                        onChange={(e) =>
                          updateEducation(index, "institution", e.target.value)
                        }
                      />
                      <Input
                        placeholder="Degree"
                        value={edu.degree || ""}
                        onChange={(e) =>
                          updateEducation(index, "degree", e.target.value)
                        }
                      />
                      <Input
                        placeholder="Field"
                        value={edu.field || ""}
                        onChange={(e) =>
                          updateEducation(index, "field", e.target.value)
                        }
                      />
                      <Input
                        placeholder="Year"
                        value={edu.graduation_year || ""}
                        onChange={(e) =>
                          updateEducation(index, "graduation_year", e.target.value)
                        }
                      />
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeEducation(index)}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs text-slate-500 mb-2 block">Skills</Label>

              <div className="flex flex-wrap gap-1.5 mb-2">
                {normalizeArray(form.skills).map((skill, index) => (
                  <Badge
                    key={`${skill}-${index}`}
                    className="bg-slate-100 text-slate-700 border-0 cursor-pointer hover:bg-red-100 hover:text-red-700"
                    onClick={() => removeSkill(index)}
                  >
                    {skill} ×
                  </Badge>
                ))}
              </div>

              <div className="flex gap-2">
                <Input
                  placeholder="Add skill..."
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addSkill();
                    }
                  }}
                />
                <Button variant="outline" size="sm" onClick={addSkill}>
                  Add
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditor(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-slate-900 hover:bg-slate-800 text-white"
            >
              {saving ? "Saving..." : "Save Resume"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
