import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { Sparkles, Loader2, CheckCircle2, Briefcase, GraduationCap, Zap, ChevronDown, ChevronUp } from "lucide-react";

export default function AIResumeBuilder({ open, onClose, client, clientId, onSaved }) {
  const [step, setStep] = useState("input"); // input | generating | preview
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatedResume, setGeneratedResume] = useState(null);
  const [expandedSection, setExpandedSection] = useState("experience");

  // Input form
  const [targetRole, setTargetRole] = useState(client?.target_role || "");
  const [targetIndustry, setTargetIndustry] = useState(client?.industry || "");
  const [extraContext, setExtraContext] = useState("");

  const handleGenerate = async () => {
    if (!targetRole.trim()) {
      toast.error("Please enter a target role");
      return;
    }
    setGenerating(true);
    setStep("generating");

    const clientContext = [
      client?.notes ? `Client notes: ${client.notes}` : "",
      targetRole ? `Target role: ${targetRole}` : "",
      targetIndustry ? `Target industry: ${targetIndustry}` : "",
      client?.location ? `Location: ${client.location}` : "",
      extraContext ? `Additional context: ${extraContext}` : "",
    ].filter(Boolean).join("\n");

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are an expert resume writer and career coach. Build a complete, professional resume for a job seeker with the following profile:

${clientContext}

Create a compelling, ATS-optimized resume. Be realistic and professional. If specific experience details aren't provided, generate plausible, realistic examples that fit the target role and industry. The resume should be ready to use.

Generate:
- A strong professional summary (3-4 sentences, tailored to the target role)
- 2-3 relevant work experience entries (with detailed bullet-point descriptions highlighting achievements and impact)
- 1-2 education entries appropriate for the role
- 10-15 relevant hard and soft skills
- 1-2 certifications if relevant to the role

Make everything specific, quantified where possible, and highly tailored to the target role.`,
      response_json_schema: {
        type: "object",
        properties: {
          title: { type: "string", description: "Resume version title like 'Software Engineer Resume'" },
          summary: { type: "string" },
          experience: {
            type: "array",
            items: {
              type: "object",
              properties: {
                company: { type: "string" },
                role: { type: "string" },
                start_date: { type: "string" },
                end_date: { type: "string" },
                description: { type: "string" },
                current: { type: "boolean" }
              }
            }
          },
          education: {
            type: "array",
            items: {
              type: "object",
              properties: {
                institution: { type: "string" },
                degree: { type: "string" },
                field: { type: "string" },
                graduation_year: { type: "string" }
              }
            }
          },
          skills: { type: "array", items: { type: "string" } },
          certifications: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                issuer: { type: "string" },
                year: { type: "string" }
              }
            }
          }
        }
      }
    });

    setGeneratedResume(result);
    setGenerating(false);
    setStep("preview");
  };

  const handleSave = async () => {
    setSaving(true);
    await base44.entities.Resume.create({
      client_id: clientId,
      title: generatedResume.title || `${targetRole} Resume (AI)`,
      summary: generatedResume.summary || "",
      experience: generatedResume.experience || [],
      education: generatedResume.education || [],
      skills: generatedResume.skills || [],
      certifications: generatedResume.certifications || [],
      is_primary: false,
    });
    toast.success("AI resume saved!");
    setSaving(false);
    onSaved();
    handleClose();
  };

  const handleClose = () => {
    setStep("input");
    setGeneratedResume(null);
    setGenerating(false);
    setSaving(false);
    setExtraContext("");
    onClose();
  };

  const toggle = (s) => setExpandedSection(expandedSection === s ? null : s);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            AI Resume Builder
          </DialogTitle>
        </DialogHeader>

        {/* Step 1: Input */}
        {step === "input" && (
          <div className="space-y-5 py-2">
            <div className="p-4 bg-purple-50 border border-purple-100 rounded-xl text-sm text-purple-700">
              AI will generate a complete, professional resume tailored to the client's target role and profile. You can review and edit it before saving.
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Target Role *</Label>
                <Input
                  placeholder="e.g. Marketing Manager"
                  value={targetRole}
                  onChange={e => setTargetRole(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Target Industry</Label>
                <Input
                  placeholder="e.g. Healthcare"
                  value={targetIndustry}
                  onChange={e => setTargetIndustry(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Additional Context (optional)</Label>
              <Textarea
                placeholder="e.g. Client has 5 years in retail, wants to transition to management. Has a degree in Business Administration..."
                value={extraContext}
                onChange={e => setExtraContext(e.target.value)}
                rows={4}
              />
            </div>

            {client?.notes && (
              <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-600">
                <span className="font-semibold">Client notes will be used:</span> {client.notes.slice(0, 200)}{client.notes.length > 200 ? "..." : ""}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Generating */}
        {step === "generating" && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-lg">
              <Sparkles className="w-7 h-7 text-white animate-pulse" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-slate-800">Building your resume...</p>
              <p className="text-sm text-slate-400 mt-1">Crafting a tailored resume for {targetRole}</p>
            </div>
            <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
          </div>
        )}

        {/* Step 3: Preview */}
        {step === "preview" && generatedResume && (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
              <p className="text-sm text-green-800 font-medium">Resume generated! Review the content below before saving.</p>
            </div>

            {/* Title */}
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Resume Title</Label>
              <Input
                value={generatedResume.title || ""}
                onChange={e => setGeneratedResume(r => ({ ...r, title: e.target.value }))}
              />
            </div>

            {/* Summary */}
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Professional Summary</Label>
              <Textarea
                value={generatedResume.summary || ""}
                onChange={e => setGeneratedResume(r => ({ ...r, summary: e.target.value }))}
                rows={4}
              />
            </div>

            {/* Experience */}
            <CollapsibleSection
              icon={<Briefcase className="w-4 h-4" />}
              label={`Experience (${generatedResume.experience?.length || 0})`}
              expanded={expandedSection === "experience"}
              onToggle={() => toggle("experience")}
            >
              <div className="space-y-3">
                {(generatedResume.experience || []).map((exp, i) => (
                  <div key={i} className="border border-slate-100 rounded-lg p-3 space-y-2 bg-white">
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="Company"
                        value={exp.company || ""}
                        onChange={e => {
                          const updated = [...generatedResume.experience];
                          updated[i] = { ...updated[i], company: e.target.value };
                          setGeneratedResume(r => ({ ...r, experience: updated }));
                        }}
                        className="text-sm"
                      />
                      <Input
                        placeholder="Role"
                        value={exp.role || ""}
                        onChange={e => {
                          const updated = [...generatedResume.experience];
                          updated[i] = { ...updated[i], role: e.target.value };
                          setGeneratedResume(r => ({ ...r, experience: updated }));
                        }}
                        className="text-sm"
                      />
                      <Input placeholder="Start" value={exp.start_date || ""} onChange={e => { const u = [...generatedResume.experience]; u[i] = { ...u[i], start_date: e.target.value }; setGeneratedResume(r => ({ ...r, experience: u })); }} className="text-sm" />
                      <Input placeholder="End" value={exp.end_date || ""} onChange={e => { const u = [...generatedResume.experience]; u[i] = { ...u[i], end_date: e.target.value }; setGeneratedResume(r => ({ ...r, experience: u })); }} className="text-sm" />
                    </div>
                    <Textarea
                      value={exp.description || ""}
                      onChange={e => { const u = [...generatedResume.experience]; u[i] = { ...u[i], description: e.target.value }; setGeneratedResume(r => ({ ...r, experience: u })); }}
                      rows={3}
                      className="text-sm"
                    />
                  </div>
                ))}
              </div>
            </CollapsibleSection>

            {/* Education */}
            <CollapsibleSection
              icon={<GraduationCap className="w-4 h-4" />}
              label={`Education (${generatedResume.education?.length || 0})`}
              expanded={expandedSection === "education"}
              onToggle={() => toggle("education")}
            >
              <div className="space-y-3">
                {(generatedResume.education || []).map((edu, i) => (
                  <div key={i} className="border border-slate-100 rounded-lg p-3 bg-white">
                    <div className="grid grid-cols-2 gap-2">
                      <Input placeholder="Institution" value={edu.institution || ""} onChange={e => { const u = [...generatedResume.education]; u[i] = { ...u[i], institution: e.target.value }; setGeneratedResume(r => ({ ...r, education: u })); }} className="text-sm" />
                      <Input placeholder="Degree" value={edu.degree || ""} onChange={e => { const u = [...generatedResume.education]; u[i] = { ...u[i], degree: e.target.value }; setGeneratedResume(r => ({ ...r, education: u })); }} className="text-sm" />
                      <Input placeholder="Field" value={edu.field || ""} onChange={e => { const u = [...generatedResume.education]; u[i] = { ...u[i], field: e.target.value }; setGeneratedResume(r => ({ ...r, education: u })); }} className="text-sm" />
                      <Input placeholder="Year" value={edu.graduation_year || ""} onChange={e => { const u = [...generatedResume.education]; u[i] = { ...u[i], graduation_year: e.target.value }; setGeneratedResume(r => ({ ...r, education: u })); }} className="text-sm" />
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleSection>

            {/* Skills */}
            <CollapsibleSection
              icon={<Zap className="w-4 h-4" />}
              label={`Skills (${generatedResume.skills?.length || 0})`}
              expanded={expandedSection === "skills"}
              onToggle={() => toggle("skills")}
            >
              <div className="flex flex-wrap gap-1.5">
                {(generatedResume.skills || []).map((s, i) => (
                  <Badge
                    key={i}
                    className="bg-slate-100 text-slate-700 border-0 cursor-pointer hover:bg-red-100 hover:text-red-700 text-xs"
                    onClick={() => setGeneratedResume(r => ({ ...r, skills: r.skills.filter((_, idx) => idx !== i) }))}
                  >
                    {s} ×
                  </Badge>
                ))}
              </div>
            </CollapsibleSection>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          {step === "input" && (
            <Button onClick={handleGenerate} className="bg-gradient-to-r from-purple-600 to-blue-600 text-white">
              <Sparkles className="w-4 h-4 mr-1.5" /> Generate Resume
            </Button>
          )}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={() => setStep("input")}>Regenerate</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                Save Resume
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CollapsibleSection({ icon, label, expanded, onToggle, children }) {
  return (
    <div className="border border-slate-100 rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
        onClick={onToggle}
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          {icon}{label}
        </span>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>
      {expanded && <div className="p-3 bg-slate-50/50">{children}</div>}
    </div>
  );
}