import InterestProfilerPanel from "@/components/assessments/InterestProfilerPanel";
import React, { useEffect, useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { FileText, Plus, Download, Loader2, Pencil, Upload, Trash2, ChevronRight, CheckCircle2, Clock, Circle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "react-hot-toast";
import { cn } from "@/lib/utils";
import StructuredAssessmentWorkspacePanel from "@/components/assessments/StructuredAssessmentWorkspacePanel";

import {
  WORK_ENVIRONMENT_TOLERANCE_SECTIONS,
  WORK_ENVIRONMENT_TOLERANCE_META,
} from "@/lib/assessments/workEnvironmentToleranceDefinition";

// ── Structured assessment registry ────────────────────────────────────────────

const STRUCTURED_ASSESSMENTS = [
  {
    key: "work_environment_tolerance",
    label: "Work Environment Tolerance",
    emoji: "🏢",
    description: "Physical setting, sensory tolerance, social interaction, pace & stress recovery",
    sections: WORK_ENVIRONMENT_TOLERANCE_SECTIONS,
    meta: WORK_ENVIRONMENT_TOLERANCE_META,
    available: true,
  },
  {
    key: "barriers_to_employment",
    label: "Barriers to Employment",
    emoji: "🚧",
    description: "Identify practical and situational barriers affecting job search",
    sections: [],
    meta: { assessment_type: "barriers_to_employment", label: "Barriers to Employment" },
    available: false,
  },
  {
    key: "transportation",
    label: "Transportation",
    emoji: "🚌",
    description: "Transportation options, reliability, and barriers",
    sections: [],
    meta: { assessment_type: "transportation", label: "Transportation" },
    available: false,
  },
  {
    key: "support_and_accommodation",
    label: "Support & Accommodation",
    emoji: "🤝",
    description: "Workplace accommodation needs and support planning",
    sections: [],
    meta: { assessment_type: "support_and_accommodation", label: "Support & Accommodation" },
    available: false,
  },
  {
    key: "work_values",
    label: "Work Values",
    emoji: "⭐",
    description: "What the client values most in employment",
    sections: [],
    meta: { assessment_type: "work_values", label: "Work Values" },
    available: false,
  },
];

const STRUCTURED_KEYS = STRUCTURED_ASSESSMENTS.map((a) => a.key);

function countTotalQuestions(sections) {
  let total = 0;
  for (const section of sections) {
    for (const q of section.questions) {
      total++;
      if (q.conditionals) total += q.conditionals.length;
    }
  }
  return total;
}

function countAnsweredQuestions(sections, responses) {
  let answered = 0;
  for (const section of sections) {
    for (const q of section.questions) {
      const v = responses[q.id];
      if (v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0)) answered++;
    }
  }
  return answered;
}

// ── Structured Assessment Card (matches IntakeSectionCard style) ───────────────

function StructuredAssessmentCard({ assessment, record, isActive, onClick }) {
  const { label, emoji, description, sections, available } = assessment;

  const totalQ = sections.length > 0 ? countTotalQuestions(sections) : 0;
  const answeredQ = record && sections.length > 0 ? countAnsweredQuestions(sections, record.responses || {}) : 0;
  const pct = totalQ > 0 ? Math.round((answeredQ / totalQ) * 100) : 0;

  const status = !record ? "not_started" : record.status === "completed" ? "completed" : "in_progress";

  const statusConfig = {
    not_started: { label: "Not Started", color: "bg-slate-100 text-slate-500" },
    in_progress:  { label: "In Progress",  color: "bg-amber-100 text-amber-700"  },
    completed:    { label: "Completed",     color: "bg-emerald-100 text-emerald-700" },
  }[status];

  return (
    <button
      type="button"
      disabled={!available}
      onClick={available ? onClick : undefined}
      className={cn(
        "w-full text-left rounded-xl border p-3 transition-all group",
        available ? "hover:shadow-md cursor-pointer" : "opacity-50 cursor-not-allowed",
        isActive
          ? "border-indigo-500 bg-indigo-50 shadow-sm"
          : "border-slate-200 bg-white hover:border-indigo-300"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg shrink-0">{emoji}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-slate-800 truncate">{label}</span>
              {!available && (
                <span className="text-[10px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded-full font-medium shrink-0">
                  Soon
                </span>
              )}
            </div>
            {available && (
              <div className="text-xs text-slate-500 mt-0.5">
                {totalQ > 0 ? `${answeredQ} / ${totalQ} fields` : description}
              </div>
            )}
            {!available && (
              <div className="text-xs text-slate-400 mt-0.5 truncate">{description}</div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {available && (
            <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap", statusConfig.color)}>
              {statusConfig.label}
            </span>
          )}
          <ChevronRight className={cn("w-4 h-4 text-slate-400 transition-transform", isActive && "rotate-90")} />
        </div>
      </div>

      {/* Mini progress bar */}
      {available && totalQ > 0 && (
        <div className="mt-2 h-1 rounded-full bg-slate-100 overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              status === "completed" ? "bg-emerald-500" :
              status === "in_progress" ? "bg-blue-500" : "bg-slate-200"
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </button>
  );
}

// ── Legacy question definitions ────────────────────────────────────────────────

const assessmentQuestions = {
  career_goals: [
    { id: "current_role", label: "Current/Most Recent Role", type: "text" },
    { id: "career_goals", label: "Career Goals (next 1-2 years)", type: "textarea" },
    { id: "target_industries", label: "Target Industries", type: "text" },
    { id: "target_companies", label: "Target Companies", type: "text" },
    { id: "salary_expectations", label: "Salary Expectations", type: "text" },
    { id: "location_preferences", label: "Location Preferences", type: "text" },
    { id: "work_arrangement", label: "Preferred Work Arrangement", type: "select", options: ["Remote", "Hybrid", "On-site", "Flexible"] },
    { id: "challenges", label: "Current Challenges", type: "textarea" },
    { id: "strengths", label: "Key Strengths", type: "textarea" },
    { id: "development_areas", label: "Areas for Development", type: "textarea" },
  ],
  skills_audit: [
    { id: "technical_skills", label: "Technical Skills", type: "textarea" },
    { id: "soft_skills", label: "Soft Skills", type: "textarea" },
    { id: "certifications", label: "Certifications", type: "textarea" },
    { id: "tools_software", label: "Tools & Software Proficiency", type: "textarea" },
    { id: "languages", label: "Languages", type: "text" },
    { id: "skill_gaps", label: "Identified Skill Gaps", type: "textarea" },
  ],
  job_search_readiness: [
    { id: "resume_status", label: "Resume Status", type: "select", options: ["Not Started", "In Progress", "Complete", "Needs Review"] },
    { id: "linkedin_status", label: "LinkedIn Profile Status", type: "select", options: ["Not Set Up", "Basic", "Optimized", "Needs Update"] },
    { id: "portfolio_status", label: "Portfolio/Work Samples", type: "select", options: ["Not Available", "In Progress", "Complete"] },
    { id: "networking_activity", label: "Current Networking Activity", type: "textarea" },
    { id: "applications_sent", label: "Applications Sent (last 30 days)", type: "text" },
    { id: "interview_experience", label: "Recent Interview Experience", type: "textarea" },
  ],
  interview_readiness: [
    { id: "interview_confidence", label: "Interview Confidence Level (1-10)", type: "text" },
    { id: "behavioral_prep", label: "Behavioral Questions Preparation", type: "textarea" },
    { id: "technical_prep", label: "Technical Questions Preparation", type: "textarea" },
    { id: "common_weaknesses", label: "Common Interview Weaknesses", type: "textarea" },
    { id: "questions_for_employer", label: "Questions Prepared for Employers", type: "textarea" },
  ],
  interest_profiler: [],
  work_strategy_assessment: [
    { id: "_section_referral", label: "── COUNSELOR REFERRAL PAGE ──", type: "section" },
    { id: "crp_referring_to", label: "CRP Referring To", type: "text" },
    { id: "guardianship", label: "Guardianship", type: "select", options: ["No", "Yes"] },
    { id: "guardian_name_phone", label: "Parent/Guardian Name & Phone (if applicable)", type: "text" },
    { id: "referral_question", label: "Referral Question", type: "textarea" },
    { id: "extended_services_provider", label: "Extended Services Provider", type: "textarea" },
    { id: "health_insurance", label: "Health Insurance", type: "textarea" },
    { id: "social_security_benefits", label: "Social Security Benefits", type: "textarea" },
    { id: "benefits_planning", label: "Benefits Planning", type: "select", options: ["Completed", "Pending – Date Scheduled", "Not Applicable"] },
    { id: "benefits_planning_date", label: "Benefits Planning Pending Date", type: "text" },
    { id: "benefits_summary_info", label: "Benefits Summary Info", type: "textarea" },
    { id: "other_services_benefits", label: "Other Services/Benefits", type: "textarea" },
    { id: "_section_client_description", label: "── DESCRIBE THE FOLLOWING AS IT APPLIES TO CLIENT ──", type: "section" },
    { id: "current_work_skills", label: "Current Work Skills", type: "textarea" },
    { id: "work_skill_development_needs", label: "Work Skill Development Needs", type: "textarea" },
    { id: "jobs_of_interest", label: "Jobs of Interest", type: "text" },
    { id: "interpersonal_social_skills", label: "Interpersonal/Social Skills", type: "textarea" },
    { id: "assistive_technology_needs", label: "Identified Assistive Technology Needs", type: "textarea" },
    { id: "communication_needs", label: "Communication Needs", type: "textarea" },
    { id: "behavioral_self_regulation", label: "Behavioral/Self-regulation", type: "textarea" },
    { id: "activities_of_daily_living", label: "Activities of Daily Living", type: "textarea" },
    { id: "family_issues_supports", label: "Family Issues/Supports", type: "textarea" },
    { id: "criminal_background", label: "Criminal Background", type: "textarea" },
    { id: "school_academic", label: "School/Academic", type: "textarea" },
    { id: "_section_crp", label: "── CRP OBSERVATION AND REPORT ──", type: "section" },
    { id: "worksite_simulation_location", label: "Worksite Simulation Location", type: "text" },
    { id: "work_assessment_observations", label: "Work Assessment Observations", type: "textarea" },
    { id: "natural_support_observations", label: "Natural Support Assessment Observations", type: "textarea" },
    { id: "life_skills_observations", label: "Life Skills Observations", type: "textarea" },
    { id: "transportation_public", label: "Transportation – Public Options", type: "text" },
    { id: "transportation_private", label: "Transportation – Private Options", type: "text" },
    { id: "transportation_observations", label: "Transportation Assessment Observations", type: "textarea" },
    { id: "computer_skills_other", label: "Computer Skills – Other", type: "text" },
    { id: "computer_skill_observations", label: "Computer Skill Assessment Observations", type: "textarea" },
    { id: "interview_skill_observations", label: "Interview Skill Assessment Observations", type: "textarea" },
    { id: "other_observations", label: "Other Observations", type: "textarea" },
    { id: "_section_recommendations", label: "── RECOMMENDATIONS ──", type: "section" },
    { id: "planned_job_search_hours_week", label: "Planned Job Search Hours/Week", type: "text" },
    { id: "life_skills_needed", label: "Life Skills Needed", type: "textarea" },
    { id: "life_skills_hours_requested", label: "Life Skills Hours Requested", type: "text" },
    { id: "recommended_target_occupations", label: "Recommended Target Occupations", type: "text" },
    { id: "recommended_supports_on_job", label: "Recommended Supports on the Job", type: "textarea" },
    { id: "job_development_supports", label: "Joint VR/CRP Recommendations for Job Development Supports", type: "textarea" },
    { id: "ongoing_supports", label: "Joint VR/CRP Recommendations for Ongoing Supports", type: "textarea" },
    { id: "_section_team", label: "── TEAM SECTION ──", type: "section" },
    { id: "job_goal", label: "Job Goal", type: "text" },
    { id: "industry_targeted_pay_range", label: "Industry Targeted Pay Range", type: "text" },
    { id: "benefits_other", label: "Benefits/Other", type: "textarea" },
    { id: "hours_available_to_work", label: "Hours Available to Work", type: "textarea" },
    { id: "crp_name", label: "Community Rehabilitation Program Name", type: "text" },
    { id: "assigned_employment_specialist", label: "Assigned Employment Specialist/Job Coach", type: "text" },
    { id: "acre_certified", label: "ACRE Certified?", type: "select", options: ["Yes", "No"] },
  ],
};

const WSA_FIELD_IDS = [
  "crp_referring_to","guardianship","guardian_name_phone","referral_question",
  "extended_services_provider","health_insurance","social_security_benefits",
  "benefits_planning","benefits_planning_date","benefits_summary_info","other_services_benefits",
  "current_work_skills","work_skill_development_needs","jobs_of_interest",
  "interpersonal_social_skills","assistive_technology_needs","communication_needs",
  "behavioral_self_regulation","activities_of_daily_living","family_issues_supports",
  "criminal_background","school_academic","worksite_simulation_location",
  "work_assessment_observations","natural_support_observations","life_skills_observations",
  "transportation_public","transportation_private","transportation_observations",
  "computer_skills_other","computer_skill_observations","interview_skill_observations",
  "other_observations","planned_job_search_hours_week","life_skills_needed",
  "life_skills_hours_requested","recommended_target_occupations","recommended_supports_on_job",
  "job_development_supports","ongoing_supports","job_goal","industry_targeted_pay_range",
  "benefits_other","hours_available_to_work","crp_name","assigned_employment_specialist","acre_certified"
];

// ── Main Component ─────────────────────────────────────────────────────────────

export default function AssessmentSection({ clientId, client, openAssessmentType, onOpenAssessmentTypeHandled }) {
  const resolvedClientId = clientId || client?.id || "";

  // Structured assessment panel state (inline, like Intake)
  const [activeStructuredKey, setActiveStructuredKey] = useState(null);
  const [mobileStructuredOpen, setMobileStructuredOpen] = useState(false);
  const formPanelRef = useRef(null);

  // Legacy modal state
  const [showForm, setShowForm] = useState(false);
  const [editingAssessment, setEditingAssessment] = useState(null);
  const [assessmentType, setAssessmentType] = useState("career_goals");
  const [responses, setResponses] = useState({});
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: assessments = [], isLoading } = useQuery({
    queryKey: ["client-assessments", resolvedClientId],
    queryFn: () => base44.entities.Assessment.filter({ client_id: resolvedClientId }),
    enabled: !!resolvedClientId,
  });

  const getStructuredRecord = (key) => assessments.find((a) => a.assessment_type === key) || null;

  const activeStructuredAssessment = STRUCTURED_ASSESSMENTS.find((a) => a.key === activeStructuredKey);
  const activeStructuredRecord = activeStructuredKey ? getStructuredRecord(activeStructuredKey) : null;

  // Legacy assessments = anything not in STRUCTURED_KEYS
  const legacyAssessments = assessments.filter((a) => !STRUCTURED_KEYS.includes(a.assessment_type));

  const openLegacyNew = (type = "career_goals") => {
    setAssessmentType(type);
    setResponses({});
    setNotes("");
    setEditingAssessment(null);
    setShowForm(true);
  };

  const openLegacyEdit = (assessment) => {
    setEditingAssessment(assessment);
    setAssessmentType(assessment.assessment_type);
    setResponses(assessment.responses || {});
    setNotes(assessment.notes || "");
    setShowForm(true);
  };

  const handleDelete = async (assessment) => {
    if (!window.confirm(`Delete this ${assessment.assessment_type.replace(/_/g, " ")} assessment? This cannot be undone.`)) return;
    await base44.entities.Assessment.delete(assessment.id);
    queryClient.invalidateQueries({ queryKey: ["client-assessments"] });
    toast.success("Assessment deleted");
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const user = await base44.auth.me();
      if (editingAssessment) {
        await base44.entities.Assessment.update(editingAssessment.id, { assessment_type: assessmentType, responses, notes });
        toast.success("Assessment updated");
      } else {
        await base44.entities.Assessment.create({
          client_id: resolvedClientId,
          assessment_type: assessmentType,
          responses,
          completed_by: user.email,
          notes,
          pdf_url: responses._uploaded_pdf_url || "",
        });
        toast.success(assessmentType === "work_strategy_assessment" ? "WSA saved" : "Assessment saved");
      }
      await queryClient.invalidateQueries({ queryKey: ["client-assessments", resolvedClientId] });
      setShowForm(false);
      setEditingAssessment(null);
      setResponses({});
      setNotes("");
    } catch (error) {
      console.error("Assessment save failed:", error);
      toast.error("Failed to save: " + (error?.message || "Unknown error"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleWSAUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExtracting(true);
    toast.loading("Extracting data from PDF...", { id: "wsa-extract" });
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setResponses((prev) => ({ ...prev, _uploaded_pdf_url: file_url }));
      const schemaProperties = {};
      WSA_FIELD_IDS.forEach((id) => { schemaProperties[id] = { type: "string" }; });
      const extracted = await base44.integrations.Core.InvokeLLM({
        prompt: `Extract all filled-in fields from this Utah DWS Work Strategy Assessment (WSA) PDF. Return only non-empty values.`,
        file_urls: [file_url],
        response_json_schema: { type: "object", properties: schemaProperties },
      });
      const merged = { ...responses, _uploaded_pdf_url: file_url };
      Object.entries(extracted).forEach(([key, val]) => {
        if (val && val.trim?.() !== "") merged[key] = val;
      });
      setResponses(merged);
      toast.success("WSA data extracted and pre-filled!", { id: "wsa-extract" });
    } catch (err) {
      toast.error("Failed to extract PDF: " + err.message, { id: "wsa-extract" });
    } finally {
      setExtracting(false);
      e.target.value = "";
    }
  };

  // Handle external openAssessmentType (e.g. from AI Job Search → open Interest Profiler)
  useEffect(() => {
    if (!openAssessmentType) return;
    if (STRUCTURED_KEYS.includes(openAssessmentType)) {
      setActiveStructuredKey(openAssessmentType);
    } else {
      openLegacyNew(openAssessmentType);
    }
    onOpenAssessmentTypeHandled?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openAssessmentType]);

  const currentQuestions = assessmentQuestions[assessmentType] || [];

  return (
    <div className="space-y-6">

      {/* ── Structured Assessments Section ─────────────────────────────── */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Structured Assessments</CardTitle>
          <p className="text-xs text-slate-500 mt-0.5">Answers are auto-saved as drafts. Resume anytime.</p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />)}
            </div>
          ) : (
            <>
              {/* Mobile: card list → bottom sheet */}
              <div className="block lg:hidden space-y-2">
                {STRUCTURED_ASSESSMENTS.map((assessment) => (
                  <StructuredAssessmentCard
                    key={assessment.key}
                    assessment={assessment}
                    record={getStructuredRecord(assessment.key)}
                    isActive={activeStructuredKey === assessment.key}
                    onClick={() => {
                      setActiveStructuredKey(assessment.key);
                      setMobileStructuredOpen(true);
                    }}
                  />
                ))}
                <Sheet open={mobileStructuredOpen} onOpenChange={setMobileStructuredOpen}>
                  <SheetContent side="bottom" className="h-[92vh] overflow-y-auto">
                    <SheetHeader className="mb-4">
                      <SheetTitle>{activeStructuredAssessment?.label || ""}</SheetTitle>
                    </SheetHeader>
                    {activeStructuredAssessment?.available && (
                      <StructuredAssessmentWorkspacePanel
                        key={activeStructuredKey + (activeStructuredRecord?.id || "new")}
                        clientId={resolvedClientId}
                        assessment={activeStructuredAssessment}
                        existingRecord={activeStructuredRecord}
                        onSaved={() => {
                          queryClient.invalidateQueries({ queryKey: ["client-assessments", resolvedClientId] });
                          setMobileStructuredOpen(false);
                        }}
                      />
                    )}
                  </SheetContent>
                </Sheet>
              </div>

              {/* Desktop: two-panel layout (exactly like Intake) */}
              <div className="hidden lg:flex gap-5" style={{ height: "calc(100vh - 320px)", minHeight: "480px" }}>
                {/* Left nav */}
                <div className="w-[280px] shrink-0 overflow-y-auto space-y-2 pr-1">
                  {STRUCTURED_ASSESSMENTS.map((assessment) => (
                    <StructuredAssessmentCard
                      key={assessment.key}
                      assessment={assessment}
                      record={getStructuredRecord(assessment.key)}
                      isActive={activeStructuredKey === assessment.key}
                      onClick={() => {
                        setActiveStructuredKey(activeStructuredKey === assessment.key ? null : assessment.key);
                        if (formPanelRef.current) formPanelRef.current.scrollTop = 0;
                      }}
                    />
                  ))}
                </div>

                {/* Right form panel */}
                <div ref={formPanelRef} className="flex-1 overflow-y-auto">
                  {activeStructuredAssessment?.available ? (
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                      <StructuredAssessmentWorkspacePanel
                        key={activeStructuredKey + (activeStructuredRecord?.id || "new")}
                        clientId={resolvedClientId}
                        assessment={activeStructuredAssessment}
                        existingRecord={activeStructuredRecord}
                        onSaved={() => queryClient.invalidateQueries({ queryKey: ["client-assessments", resolvedClientId] })}
                      />
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-12 text-center h-full flex items-center justify-center">
                      <p className="text-slate-400 text-sm">← Select an assessment to begin</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Other Assessments (legacy) ──────────────────────────────────── */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base">Other Assessments</CardTitle>
            <Button size="sm" onClick={() => openLegacyNew("career_goals")}>
              <Plus className="w-3.5 h-3.5 mr-1" /> New Assessment
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : legacyAssessments.length === 0 ? (
            <div className="text-center py-8 text-sm text-slate-400">
              No other assessments yet
            </div>
          ) : (
            <div className="space-y-3">
              {legacyAssessments.map((assessment) => (
                <div key={assessment.id} className="p-4 bg-slate-50 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <FileText className="w-4 h-4 text-slate-500 mt-1" />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-slate-800 capitalize">
                            {assessment.assessment_type.replace(/_/g, " ")}
                          </p>
                          {assessment.status === "in_progress" && (
                            <span className="text-[10px] bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full font-medium">
                              Draft
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {assessment.status === "in_progress" ? "Last saved" : "Completed"}{" "}
                          {format(new Date(assessment.updated_date || assessment.created_date), "MMM d, yyyy")}
                          {assessment.completed_by && ` by ${assessment.completed_by}`}
                        </p>
                        {assessment.notes && assessment.status !== "in_progress" && (
                          <p className="text-xs text-slate-600 mt-2">{assessment.notes}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openLegacyEdit(assessment)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      {assessment.pdf_url && (
                        <a href={assessment.pdf_url} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="ghost">
                            <Download className="w-3.5 h-3.5" />
                          </Button>
                        </a>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-400 hover:text-red-600 hover:bg-red-50"
                        onClick={() => handleDelete(assessment)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Legacy Assessment Modal ─────────────────────────────────────── */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) { setShowForm(false); setEditingAssessment(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAssessment ? "Edit Assessment" : "Complete Assessment"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label>Assessment Type</Label>
              <Select value={assessmentType} onValueChange={setAssessmentType}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(assessmentQuestions).map((type) => (
                    <SelectItem key={type} value={type}>
                      {type === "interest_profiler" ? "Interest Profiler" : type.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {assessmentType === "work_strategy_assessment" && (
              <div className="rounded-md border border-blue-100 bg-blue-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-blue-800">Upload existing WSA PDF</p>
                    <p className="text-xs text-blue-600 mt-0.5">AI will extract the WSA details and pre-fill the fields.</p>
                  </div>
                  <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={handleWSAUpload} />
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-blue-300 text-blue-700 hover:bg-blue-100"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={extracting}
                  >
                    {extracting ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Extracting...</> : <><Upload className="w-3.5 h-3.5 mr-1.5" />Upload WSA PDF</>}
                  </Button>
                </div>
              </div>
            )}

            {assessmentType === "interest_profiler" && (
              <InterestProfilerPanel
                clientId={resolvedClientId}
                existingAssessment={editingAssessment}
                onSaved={() => {
                  queryClient.invalidateQueries({ queryKey: ["client-assessments", resolvedClientId] });
                  setShowForm(false);
                  setEditingAssessment(null);
                }}
              />
            )}

            {currentQuestions.map((q) => (
              <div key={q.id}>
                {q.type === "section" ? (
                  <p className="text-xs font-semibold text-slate-400 mt-4">{q.label}</p>
                ) : (
                  <>
                    <Label>{q.label}</Label>
                    {q.type === "textarea" ? (
                      <Textarea value={responses[q.id] || ""} onChange={(e) => setResponses({ ...responses, [q.id]: e.target.value })} className="mt-1" />
                    ) : q.type === "select" ? (
                      <Select value={responses[q.id] || ""} onValueChange={(val) => setResponses({ ...responses, [q.id]: val })}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {q.options.map((opt) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input value={responses[q.id] || ""} onChange={(e) => setResponses({ ...responses, [q.id]: e.target.value })} className="mt-1" />
                    )}
                  </>
                )}
              </div>
            ))}

            {assessmentType !== "interest_profiler" && (
              <div>
                <Label>Additional Notes (Optional)</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1" />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            {assessmentType !== "interest_profiler" && (
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            )}
            {assessmentType !== "interest_profiler" && (
              <Button
                onClick={handleSubmit}
                disabled={submitting || extracting || (assessmentType === "work_strategy_assessment" && !responses._uploaded_pdf_url)}
              >
                {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> :
                  assessmentType === "work_strategy_assessment" ? "Save WSA" : "Save Assessment"}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}