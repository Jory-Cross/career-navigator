import React, { useEffect, useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Loader2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import StructuredAssessmentWorkspacePanel from "@/components/assessments/StructuredAssessmentWorkspacePanel";
import WorkPerformanceSupportObservationPanel from "@/components/assessments/WorkPerformanceSupportObservationPanel";
import DiscoveryInterviewPanel from "@/components/assessments/DiscoveryInterviewPanel";
import LegacyAssessmentPanel from "@/components/assessments/LegacyAssessmentPanel";
import WSAInterviewPanel from "@/components/assessments/WSAInterviewPanel";

import {
  WORK_ENVIRONMENT_TOLERANCE_SECTIONS,
  WORK_ENVIRONMENT_TOLERANCE_META,
} from "@/lib/assessments/workEnvironmentToleranceDefinition";
import {
  BARRIERS_TO_EMPLOYMENT_SECTIONS,
  BARRIERS_TO_EMPLOYMENT_META,
} from "@/lib/assessments/barriersToEmploymentDefinition";
import {
  WORK_PERFORMANCE_SUPPORT_OBSERVATION_SECTIONS,
  WORK_PERFORMANCE_SUPPORT_OBSERVATION_META,
} from "@/lib/assessments/workPerformanceSupportObservationDefinition";
import {
  SKILLS_AUDIT_SECTIONS,
  SKILLS_AUDIT_META,
} from "@/lib/assessments/skillsAuditDefinition";
import {
  TRANSPORTATION_ASSESSMENT_SECTIONS,
  TRANSPORTATION_ASSESSMENT_META,
} from "@/lib/assessments/transportationAssessmentDefinition";
import {
  HOME_COMMUNITY_DISCOVERY_SECTIONS,
  HOME_COMMUNITY_DISCOVERY_META,
} from "@/lib/assessments/homeCommunityDiscoveryDefinition";
import {
  BENEFITS_RESOURCES_SECTIONS,
  BENEFITS_RESOURCES_META,
} from "@/lib/assessments/benefitsResourcesAssessmentDefinition";
import {
  ASSISTIVE_TECHNOLOGY_SECTIONS,
  ASSISTIVE_TECHNOLOGY_META,
} from "@/lib/assessments/assistiveTechnologyAssessmentDefinition";
import {
  DISCOVERY_INTERVIEW_SECTIONS,
  DISCOVERY_INTERVIEW_META,
} from "@/lib/assessments/discoveryInterviewDefinition";
import TransportationAssessmentPanel from "@/components/assessments/TransportationAssessmentPanel";
// ── Unified assessment registry ────────────────────────────────────────────────
// Order determines card display order. type: "structured" | "legacy"

const ALL_ASSESSMENTS = [
 {
  key: "home_community_discovery",
  label: "Home & Community Discovery",
  emoji: "🏠",
  description: "Stage One CE discovery: home observation, daily routines, interests, community participation, neighborhood mapping, observable talents and skills, and conditions to avoid",
  type: "structured",
  available: true,
  sections: HOME_COMMUNITY_DISCOVERY_SECTIONS,
  meta: HOME_COMMUNITY_DISCOVERY_META,
  clientTypes: ["customized_employment"],
},

{
  key: "benefits_resources",
  label: "Benefits & Resources",
  emoji: "💵",
  description: "Benefits planning, BPQY, work incentives, WIPA referral, resources, and employment impact",
  type: "structured",
  available: true,
  sections: BENEFITS_RESOURCES_SECTIONS,
  meta: BENEFITS_RESOURCES_META,
  clientTypes: ["customized_employment"],
},

{
  key: "assistive_technology",
  label: "Assistive Technology",
  emoji: "💻",
  description: "Technology skills, assistive technology, accessibility supports, barriers, and referral recommendations",
  type: "structured",
  available: true,
  sections: ASSISTIVE_TECHNOLOGY_SECTIONS,
  meta: ASSISTIVE_TECHNOLOGY_META,
  clientTypes: ["customized_employment"],
},

  {
  key: "discovery_interview",
  label: "Discovery Interview",
  emoji: "🗣️",
  description: "Repeatable Discovery interview with family, friends, employers, providers, and others who know the client well",
  type: "structured",
  available: true,
  sections: DISCOVERY_INTERVIEW_SECTIONS,
  meta: DISCOVERY_INTERVIEW_META,
  repeatable: true,
  clientTypes: ["customized_employment"],
},
  // Legacy types — rendered via LegacyAssessmentPanel
  {
    key: "career_goals",
    label: "Career Goals",
    emoji: "🎯",
    description: "Current role, career goals, target industries, challenges & strengths",
    type: "legacy",
    available: true,
    questions: [
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
  },
    {
    key: "skills_audit",
    label: "Skills Audit",
    emoji: "🔧",
    description: "Structured work-skill evidence, verification status, training needs & vocational relevance",
    type: "structured",
    available: true,
    sections: SKILLS_AUDIT_SECTIONS,
    meta: SKILLS_AUDIT_META,
  },
  {
    key: "job_search_readiness",
    label: "Job Search Readiness",
    emoji: "🔍",
    description: "Resume, LinkedIn, portfolio, networking & application activity",
    type: "legacy",
    available: true,
    questions: [
      { id: "resume_status", label: "Resume Status", type: "select", options: ["Not Started", "In Progress", "Complete", "Needs Review"] },
      { id: "linkedin_status", label: "LinkedIn Profile Status", type: "select", options: ["Not Set Up", "Basic", "Optimized", "Needs Update"] },
      { id: "portfolio_status", label: "Portfolio/Work Samples", type: "select", options: ["Not Available", "In Progress", "Complete"] },
      { id: "networking_activity", label: "Current Networking Activity", type: "textarea" },
      { id: "applications_sent", label: "Applications Sent (last 30 days)", type: "text" },
      { id: "interview_experience", label: "Recent Interview Experience", type: "textarea" },
    ],
  },

  {
    key: "interest_profiler",
    label: "Interest Profiler",
    emoji: "🧭",
    description: "RIASEC interest profile to guide career direction",
    type: "legacy",
    available: true,
    questions: [],
  },
  {
    key: "work_strategy_assessment",
    label: "Work Strategy Assessment",
    emoji: "📋",
    description: "Comprehensive VR assessment — counselor referral, CRP observations & recommendations",
    type: "legacy",
    available: true,
    questions: [
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
  },

  // Structured types — rendered via StructuredAssessmentWorkspacePanel
  {
    key: "work_environment_tolerance",
    label: "Work Environment Tolerance",
    emoji: "🏢",
    description: "Physical setting, sensory tolerance, social interaction, pace & stress recovery",
    type: "structured",
    available: true,
    sections: WORK_ENVIRONMENT_TOLERANCE_SECTIONS,
    meta: WORK_ENVIRONMENT_TOLERANCE_META,
  },
    {
    key: "barriers_to_employment",
    label: "Barriers to Employment",
    emoji: "🚧",
    description: "Functional barriers across sensory, social, physical, and logistical domains",
    type: "structured",
    available: true,
    sections: BARRIERS_TO_EMPLOYMENT_SECTIONS,
    meta: BARRIERS_TO_EMPLOYMENT_META,
  },
  {
    key: "wsa_interview",
    label: "WSA Interview Assessment",
    emoji: "🎤",
    description: "Structured WSA interview session — conduct, score, and review interview responses",
    type: "wsa_interview",
    available: true,
    questions: [],
    sections: [],
  },
  {
    key: "work_performance_support_observation",
    label: "Work Performance & Support Observation",
    emoji: "📝",
    description: "Repeatable worksite observations, job coaching, retention, and ongoing support review",
    type: "structured",
    available: true,
    sections: WORK_PERFORMANCE_SUPPORT_OBSERVATION_SECTIONS,
    meta: WORK_PERFORMANCE_SUPPORT_OBSERVATION_META,
    repeatable: true,
  },
  {
    key: "transportation",
    label: "Transportation",
    emoji: "🚌",
    description: "Transportation options, reliability, and barriers",
    type: "transportation",
    available: true,
    sections: TRANSPORTATION_ASSESSMENT_SECTIONS,
    meta: TRANSPORTATION_ASSESSMENT_META,
  },
  {
    key: "support_and_accommodation",
    label: "Support & Accommodation",
    emoji: "🤝",
    description: "Workplace accommodation needs and support planning",
    type: "structured",
    available: false,
    sections: [],
    meta: { assessment_type: "support_and_accommodation", label: "Support & Accommodation" },
  },
  {
    key: "work_values",
    label: "Work Values",
    emoji: "⭐",
    description: "What the client values most in employment",
    type: "structured",
    available: false,
    sections: [],
    meta: { assessment_type: "work_values", label: "Work Values" },
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function countTotalLegacyFields(questions) {
  return questions.filter((q) => q.type !== "section").length;
}

function countAnsweredLegacyFields(questions, responses) {
  return questions.filter((q) => {
    if (q.type === "section") return false;
    const v = responses?.[q.id];
    return v !== null && v !== undefined && v !== "";
  }).length;
}

function countTotalStructuredQuestions(sections) {
  let total = 0;
  for (const section of sections) {
    for (const q of section.questions) {
      total++;
      if (q.conditionals) total += q.conditionals.length;
    }
  }
  return total;
}

function countAnsweredStructuredQuestions(sections, responses) {
  let answered = 0;
  for (const section of sections) {
    for (const q of section.questions) {
      const v = responses?.[q.id];
      if (v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0)) answered++;
    }
  }
  return answered;
}

// ── Assessment Card ────────────────────────────────────────────────────────────

function AssessmentCard({ assessment, record, isActive, onClick, statusOverride }) {
  const { label, emoji, description, type, available, questions = [], sections = [] } = assessment;

  let totalFields = 0;
  let answeredFields = 0;

  if (available) {
    if (type === "legacy") {
      totalFields = countTotalLegacyFields(questions);
      answeredFields = countAnsweredLegacyFields(questions, record?.responses);
    } else if (type === "structured") {
      totalFields = countTotalStructuredQuestions(sections);
      answeredFields = countAnsweredStructuredQuestions(sections, record?.responses);
    }
    // wsa_interview type: no field count — uses statusOverride
  }

  const pct = totalFields > 0 ? Math.round((answeredFields / totalFields) * 100) : 0;

  const status = statusOverride || (!record ? "not_started"
    : record.status === "completed" ? "completed"
    : record.status === "in_progress" ? "in_progress"
    : "draft");

  const statusConfig = {
    not_started: { label: "Not Started", color: "bg-slate-100 text-slate-500" },
    draft:        { label: "Draft",        color: "bg-slate-100 text-slate-500" },
    in_progress:  { label: "In Progress",  color: "bg-amber-100 text-amber-700"  },
    completed:    { label: "Completed",    color: "bg-emerald-100 text-emerald-700" },
  }[status] || { label: "Not Started", color: "bg-slate-100 text-slate-500" };

  return (
    <button
      type="button"
      disabled={!available}
      onClick={available ? onClick : undefined}
      className={cn(
        "w-full text-left rounded-xl border p-3 transition-all",
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
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-semibold text-slate-800 truncate">{label}</span>
              {!available && (
                <span className="text-[10px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded-full font-medium shrink-0">
                  Soon
                </span>
              )}
            </div>
            <div className="text-xs text-slate-500 mt-0.5 truncate">
              {available && totalFields > 0
                ? `${answeredFields} / ${totalFields} fields`
                : description}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {available && (
            <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap", statusConfig.color)}>
              {statusConfig.label}
            </span>
          )}
          <ChevronRight className={cn("w-4 h-4 text-slate-400 transition-transform shrink-0", isActive && "rotate-90")} />
        </div>
      </div>

      {/* Progress bar */}
      {available && totalFields > 0 && (
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

// ── Main Component ─────────────────────────────────────────────────────────────

export default function AssessmentSection({ clientId, client, openAssessmentType, onOpenAssessmentTypeHandled }) {
  const resolvedClientId = clientId || client?.id || "";
    const [activeKey, setActiveKey] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const formPanelRef = useRef(null);
  const leaveSaveRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: assessments = [], isLoading } = useQuery({
    queryKey: ["client-assessments", resolvedClientId],
    queryFn: () => base44.entities.Assessment.filter({ client_id: resolvedClientId }),
    enabled: !!resolvedClientId,
  });

  const { data: wsaSessions = [] } = useQuery({
    queryKey: ["client-wsa-sessions", resolvedClientId],
    queryFn: async () => {
      const all = await base44.entities.InterviewSession.filter({ client_id: resolvedClientId });
      return (Array.isArray(all) ? all : []).filter(s => s.session_type === "WSA");
    },
    enabled: !!resolvedClientId,
  });

  const getRecord = (key) => assessments.find((a) => a.assessment_type === key) || null;

  const getWsaInterviewStatus = () => {
    if (!wsaSessions.length) return "not_started";
    if (wsaSessions.some(s => s.overall_feedback)) return "completed";
    return "in_progress";
  };

   const visibleAssessments = ALL_ASSESSMENTS.filter((assessment) => {
    if (!assessment.clientTypes || assessment.clientTypes.length === 0) {
      return true;
    }

    return assessment.clientTypes.includes(client?.client_type);
  });

  const activeAssessment = visibleAssessments.find((a) => a.key === activeKey);
  const activeRecord = activeKey ? getRecord(activeKey) : null;

    const handleSaved = async () => {
    await queryClient.invalidateQueries({ queryKey: ["client-assessments", resolvedClientId] });
    await queryClient.invalidateQueries({ queryKey: ["client-wsa-sessions", resolvedClientId] });
  };

  const handleAssessmentSelection = async (assessmentKey) => {
    const nextKey = activeKey === assessmentKey ? null : assessmentKey;
    const isLeavingWSA =
      activeKey === "work_strategy_assessment" &&
      nextKey !== "work_strategy_assessment";

    if (isLeavingWSA && leaveSaveRef.current) {
      const saved = await leaveSaveRef.current();

      if (!saved) {
        return;
      }
    }

    setActiveKey(nextKey);

    if (formPanelRef.current) {
      formPanelRef.current.scrollTop = 0;
    }
  };

  // Handle external trigger (e.g. AI Job Search → open Interest Profiler)
  useEffect(() => {
    if (!openAssessmentType) return;
    const found = ALL_ASSESSMENTS.find((a) => a.key === openAssessmentType);
    if (found?.available) {
      setActiveKey(openAssessmentType);
    }
    onOpenAssessmentTypeHandled?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openAssessmentType]);

  // Right panel content
  const renderRightPanel = (onClose) => {
    if (!activeAssessment || !activeAssessment.available) return null;

      if (activeAssessment.key === "wsa_interview") {
      return (
        <WSAInterviewPanel
          clientId={resolvedClientId}
          client={client}
          onSaved={handleSaved}
        />
      );
    }

    if (activeAssessment.key === "work_performance_support_observation") {
      return (
        <WorkPerformanceSupportObservationPanel
          clientId={resolvedClientId}
          records={assessments.filter(
            (record) =>
              record.assessment_type ===
              WORK_PERFORMANCE_SUPPORT_OBSERVATION_META.assessment_type
          )}
          onSaved={handleSaved}
        />
      );
    }

if (activeAssessment.key === "discovery_interview") {
  return (
    <DiscoveryInterviewPanel
      clientId={resolvedClientId}
      records={assessments.filter(
        (record) =>
          record.assessment_type ===
          DISCOVERY_INTERVIEW_META.assessment_type
      )}
      onSaved={handleSaved}
    />
  );
}
    
    if (activeAssessment.key === "transportation") {
      return (
        <TransportationAssessmentPanel
          clientId={resolvedClientId}
          onAssessmentUpdate={handleSaved}
        />
      );
    }

    if (activeAssessment.type === "structured") {
      return (
        <StructuredAssessmentWorkspacePanel
          key={activeKey}
          clientId={resolvedClientId}
          assessment={activeAssessment}
          existingRecord={activeRecord}
          onSaved={handleSaved}
        />
      );
    }
    // Legacy panel
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <LegacyAssessmentPanel
          key={activeKey}
          assessmentDef={activeAssessment}
          existingRecord={activeRecord}
          clientId={resolvedClientId}
          onRegisterLeaveSave={(saveFunction) => {
            leaveSaveRef.current = saveFunction;
          }}
          onSaved={async () => {
            await handleSaved();
            onClose?.();
          }}
        />
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="pb-1">
        <p className="text-xs text-slate-500">Click an assessment to open it. Structured assessments auto-save as drafts.</p>
      </div>

      {/* Mobile: card list → bottom sheet */}
      <div className="block lg:hidden space-y-2">
                {visibleAssessments.map((assessment) => (
          <AssessmentCard
            key={assessment.key}
            assessment={assessment}
            record={getRecord(assessment.key)}
            isActive={activeKey === assessment.key}
            statusOverride={assessment.key === "wsa_interview" ? getWsaInterviewStatus() : undefined}
            onClick={() => {
              setActiveKey(assessment.key);
              setMobileOpen(true);
            }}
          />
        ))}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="bottom" className="h-[92vh] overflow-y-auto">
            <SheetHeader className="mb-4">
              <SheetTitle>{activeAssessment?.label || ""}</SheetTitle>
            </SheetHeader>
            {renderRightPanel(() => setMobileOpen(false))}
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop: two-panel layout */}
      <div className="hidden lg:flex gap-5" style={{ height: "calc(100vh - 280px)", minHeight: "520px" }}>
        {/* Left: card list */}
        <div className="w-[290px] shrink-0 overflow-y-auto space-y-2 pr-1">
        {visibleAssessments.map((assessment) => (            <AssessmentCard
              key={assessment.key}
              assessment={assessment}
              record={getRecord(assessment.key)}
              isActive={activeKey === assessment.key}
              statusOverride={assessment.key === "wsa_interview" ? getWsaInterviewStatus() : undefined}
              onClick={() => {
                handleAssessmentSelection(assessment.key);
              }}
            />
          ))}
        </div>

        {/* Right: form panel */}
        <div ref={formPanelRef} className="flex-1 overflow-y-auto">
          {activeAssessment?.available ? (
            renderRightPanel(null)
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 h-full flex items-center justify-center">
              <p className="text-slate-400 text-sm">← Select an assessment to begin</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
