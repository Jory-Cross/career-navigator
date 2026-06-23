import React, { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Home,
  MessageSquare,
  MapPin,
  BriefcaseBusiness,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  Target,
  Zap,
  Search,
  Brain,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import DSRExportPackage from "./DSRExportPackage";
import DiscoveryFidelityPanel from "./DiscoveryFidelityPanel";
import DiscoveryReadinessScore from "./DiscoveryReadinessScore";
import StageOneMilestoneTracker from "./StageOneMilestoneTracker";
import DiscoveryEvidenceSourceExplorer from "./DiscoveryEvidenceSourceExplorer";
import StageTwoReadinessGate from "./StageTwoReadinessGate";
import StageOneWorkDashboard from "./StageOneWorkDashboard";
import EvidenceThemeGroupPanel from "./EvidenceThemeGroupPanel";
import VocationalThemeCandidateGraphSummary from "./VocationalThemeCandidateGraphSummary";
import { base44 } from "@/api/base44Client";
import {
  CE_ASSESSMENT_TYPES,
  countCompleted,
  countAny,
  getLatestRecord,
  getAssessmentSourceLabel,
  collectEvidence,
  collectArrayEvidence,
  collectChoiceEvidence,
  countEvidenceSources,
  countDistinctConcepts,
  computeFidelityStatus,
} from "./CEDataProvider";

function EvidenceStatus({ label, count, completed }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-900">{label}</p>
          <p className="text-xs text-slate-500 mt-1">
            {count} record{count === 1 ? "" : "s"} found
          </p>
        </div>
        {completed > 0 ? (
          <Badge
            variant="outline"
            className="border-emerald-200 bg-emerald-50 text-emerald-700"
          >
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Complete
          </Badge>
        ) : count > 0 ? (
          <Badge
            variant="outline"
            className="border-amber-200 bg-amber-50 text-amber-700"
          >
            Draft
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="border-slate-200 bg-slate-50 text-slate-500"
          >
            Missing
          </Badge>
        )}
      </div>
    </div>
  );
}

const TILES = [
  { id: "assessments", label: "🏠 Assessments", icon: Home, color: "indigo" },
  { id: "readiness", label: "📊 Readiness", icon: BarChart3, color: "emerald" },
  { id: "milestones", label: "🎯 Milestones", icon: Target, color: "blue" },
  { id: "evidence-tracking", label: "📁 Evidence Tracking", icon: Zap, color: "amber" },
  { id: "evidence-quality", label: "🛡 Evidence Quality", icon: CheckCircle2, color: "rose" },
  { id: "evidence-explorer", label: "🔍 Evidence Explorer", icon: Search, color: "violet" },
  { id: "vocational-themes", label: "🧠 Vocational Themes", icon: Brain, color: "cyan" },
  { id: "dsr", label: "📄 DSR", icon: FileText, color: "purple" },
];

export default function CustomizedEmploymentPanel({ client, currentUser, onOpenAssessment }) {
  const [assessmentRecords, setAssessmentRecords] = useState([]);
  const [gateRules, setGateRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTile, setSelectedTile] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function loadCeAssessmentRecords() {
      if (!client?.id) {
        setAssessmentRecords([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const records = await base44.entities.Assessment.filter({
          client_id: client.id,
        });
        if (cancelled) return;
        setAssessmentRecords(
          (records || []).filter((record) =>
            CE_ASSESSMENT_TYPES.includes(record.assessment_type)
          )
        );
      } catch (error) {
        console.error("Failed to load CE assessment records", error);
        if (!cancelled) {
          setAssessmentRecords([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    loadCeAssessmentRecords();
    return () => {
      cancelled = true;
    };
  }, [client?.id]);

  // ── Memoized assessment lookups ──────────────────────────────────────────
  const homeDiscovery = useMemo(
    () => getLatestRecord(assessmentRecords, "home_community_discovery"),
    [assessmentRecords]
  );

  const discoveryInterviewCount = countAny(
    assessmentRecords,
    "discovery_interview"
  );
  const completedDiscoveryInterviewCount = countCompleted(
    assessmentRecords,
    "discovery_interview"
  );
  const informationalInterviewCount = countAny(
    assessmentRecords,
    "informational_interview"
  );
  const completedInformationalInterviewCount = countCompleted(
    assessmentRecords,
    "informational_interview"
  );
  const discoveryActivityCount = countAny(
    assessmentRecords,
    "discovery_activity"
  );
  const completedDiscoveryActivityCount = countCompleted(
    assessmentRecords,
    "discovery_activity"
  );

  const discoveryInterviews = assessmentRecords.filter(
    (record) => record.assessment_type === "discovery_interview"
  );
  const informationalInterviews = assessmentRecords.filter(
    (record) => record.assessment_type === "informational_interview"
  );
  const discoveryActivities = assessmentRecords.filter(
    (record) => record.assessment_type === "discovery_activity"
  );
  const benefitsAssessments = assessmentRecords.filter(
    (record) =>
      record.assessment_type === "benefits_resources_assessment" ||
      record.assessment_type === "benefits_resources"
  );
  const assistiveTechnologyAssessments = assessmentRecords.filter(
    (record) =>
      record.assessment_type === "assistive_technology_assessment" ||
      record.assessment_type === "assistive_technology"
  );

  // ── Evidence collections ────────────────────────────────────────────────
  const emergingInterests = useMemo(() => [
    ...collectEvidence([homeDiscovery], [
      "preferred_activities",
      "observable_interests",
    ]),
    ...collectEvidence(discoveryInterviews, [
      "favorite_activities",
      "topics_of_interest",
    ]),
    ...collectEvidence(discoveryActivities, [
      "signs_of_interest",
      "preferred_activities_tools_materials",
    ]),
    ...collectEvidence(assistiveTechnologyAssessments, [
      "technology_interests",
      "technology_strengths_summary",
    ]),
  ], [homeDiscovery, discoveryInterviews, discoveryActivities, assistiveTechnologyAssessments]);

  const observedSkills = useMemo(() => [
    ...collectEvidence([homeDiscovery], [
      "observable_skills",
      "work_relevant_daily_skills",
    ]),
    ...collectEvidence(discoveryInterviews, [
      "home_skills",
      "community_skills",
      "work_skills",
      "technology_skills",
    ]),
    ...collectEvidence(discoveryActivities, ["skills_demonstrated"]),
    ...collectEvidence(assistiveTechnologyAssessments, [
      "technology_skills_present",
      "technology_skill_strengths",
      "workplace_technology_experience",
    ]),
  ], [homeDiscovery, discoveryInterviews, discoveryActivities, assistiveTechnologyAssessments]);

  const conditionsForSuccess = useMemo(() => [
    ...collectEvidence([homeDiscovery], [
      "conditions_for_success_observed",
    ]),
    ...collectEvidence(discoveryInterviews, [
      "conditions_for_success",
      "best_environments",
      "best_supports",
      "best_schedule",
      "best_supervision_style",
    ]),
    ...collectEvidence(discoveryActivities, [
      "environmental_conditions",
      "people_social_conditions",
      "instruction_style",
      "supports_or_accommodations_used",
      "conditions_associated_with_success",
    ]),
    ...collectEvidence(informationalInterviews, [
      "conditions_needed_for_client_success",
    ]),
    ...collectEvidence(assistiveTechnologyAssessments, [
      "organization_supports",
      "employment_supports",
      "technology_accommodations_needed",
      "technology_barriers_summary",
      "technology_recommendations",
    ]),
  ], [homeDiscovery, discoveryInterviews, discoveryActivities, informationalInterviews, assistiveTechnologyAssessments]);

  const potentialBusinessSettings = useMemo(() => [
    ...collectEvidence([homeDiscovery], [
      "potential_businesses_or_settings",
    ]),
    ...collectEvidence(discoveryInterviews, [
      "businesses_or_places_to_explore",
    ]),
    ...collectEvidence(discoveryActivities, ["possible_business_settings"]),
    ...collectEvidence(informationalInterviews, [
      "job_carving_opportunities",
    ]),
  ], [homeDiscovery, discoveryInterviews, discoveryActivities, informationalInterviews]);

  const relationshipsAndNaturalSupports = useMemo(() => [
    ...collectEvidence([homeDiscovery], [
      "natural_supports",
      "social_preferences",
      "preferred_people_patterns",
      "family_friend_community_activities",
      "neighbors_connections",
      "people_present",
      "people_interviewed",
    ]),
    ...collectEvidence(discoveryInterviews, [
      "preferred_people",
      "best_supports",
      "positive_qualities",
      "contributions",
      "known_for",
      "people_or_connections",
    ]),
  ], [homeDiscovery, discoveryInterviews]);

  const communityConnections = useMemo(() => [
    ...collectEvidence([homeDiscovery], [
      "family_friend_community_activities",
      "nearby_resources",
      "neighbors_connections",
      "activities_civic_engagement",
      "places_visited",
      "community_strengths",
    ]),
    ...collectEvidence(discoveryInterviews, [
      "community_roles",
      "people_or_connections",
      "businesses_or_places_to_explore",
      "preferred_places",
    ]),
    ...collectEvidence(discoveryActivities, [
      "activity_location",
      "possible_business_settings",
      "customized_employment_possibilities",
    ]),
    ...collectEvidence(informationalInterviews, [
      "business_organization",
      "person_interviewed",
      "community_contact_opportunities",
      "follow_up_opportunities",
    ]),
  ], [homeDiscovery, discoveryInterviews, discoveryActivities, informationalInterviews]);

  const employerLeads = useMemo(() => [
    ...collectEvidence([homeDiscovery], [
      "potential_businesses_or_settings",
      "nearby_employers",
      "possible_discovery_leads",
    ]),
    ...collectEvidence(discoveryInterviews, [
      "jobs_client_might_enjoy",
      "businesses_or_places_to_explore",
      "people_or_connections",
    ]),
    ...collectEvidence(discoveryActivities, [
      "possible_work_tasks",
      "possible_business_settings",
      "customized_employment_possibilities",
    ]),
    ...collectEvidence(informationalInterviews, [
      "job_carving_opportunities",
      "employer_leads",
    ]),
  ], [homeDiscovery, discoveryInterviews, discoveryActivities, informationalInterviews]);

  const benefitsAndFinancialConsiderations = useMemo(() => [
    ...collectArrayEvidence(benefitsAssessments, "current_benefits", "Current Benefit"),
    ...collectChoiceEvidence(benefitsAssessments, "benefits_verified", "Benefits Verification Status"),
    ...collectEvidence(benefitsAssessments, ["benefits_notes"]),
    ...collectChoiceEvidence(benefitsAssessments, "bpqy_requested", "BPQY Requested"),
    ...collectChoiceEvidence(benefitsAssessments, "bpqy_received", "BPQY Received"),
    ...collectChoiceEvidence(benefitsAssessments, "ssa_3288_completed", "SSA-3288 Release Completed"),
    ...collectChoiceEvidence(benefitsAssessments, "ssa_3288_submitted", "SSA-3288 Submitted"),
    ...collectEvidence(benefitsAssessments, ["bpqy_notes"]),
    ...collectChoiceEvidence(benefitsAssessments, "pass_potential", "PASS Potential"),
    ...collectChoiceEvidence(benefitsAssessments, "irwe_potential", "IRWE Potential"),
    ...collectChoiceEvidence(benefitsAssessments, "able_account", "ABLE Account"),
    ...collectChoiceEvidence(benefitsAssessments, "student_earned_income_exclusion", "Student Earned Income Exclusion"),
    ...collectEvidence(benefitsAssessments, ["other_work_incentives"]),
    ...collectChoiceEvidence(benefitsAssessments, "wipa_referral_needed", "WIPA Referral Needed"),
    ...collectChoiceEvidence(benefitsAssessments, "wipa_referred", "WIPA Referral Made"),
    ...collectEvidence(benefitsAssessments, ["benefits_planning_outcome"]),
    ...collectEvidence(benefitsAssessments, [
      "family_support",
      "housing_support",
      "transportation_support",
      "community_resources",
      "financial_resources",
      "natural_supports",
    ]),
    ...collectChoiceEvidence(benefitsAssessments, "fear_of_losing_benefits", "Fear of Losing Benefits"),
    ...collectChoiceEvidence(benefitsAssessments, "fear_of_losing_healthcare", "Fear of Losing Healthcare"),
    ...collectEvidence(benefitsAssessments, ["employment_concerns", "support_needs"]),
    ...collectEvidence(benefitsAssessments, [
      "benefits_summary",
      "recommended_actions",
      "outstanding_needs",
      "employment_considerations",
    ]),
  ], [benefitsAssessments]);

  const assistiveTechnologyAndAccommodations = useMemo(() => [
    ...collectEvidence(assistiveTechnologyAssessments, [
      "technology_use_notes",
      "technology_skill_strengths",
      "technology_training_needs",
      "communication_supports",
      "organization_supports",
      "transportation_supports",
      "employment_supports",
      "independence_supports",
      "technology_barrier_notes",
      "technology_support_needed_for_access",
      "technology_accommodations_needed",
      "workplace_technology_training_needed",
      "current_assistive_technology",
      "potential_assistive_technology",
      "assistive_technology_referral_notes",
    ]),
  ], [assistiveTechnologyAssessments]);

  const discoveryHypotheses = useMemo(() => [
    ...collectEvidence([homeDiscovery], [
      "discovery_hypotheses",
      "recommended_next_discovery_steps",
      "emerging_patterns",
    ]),
    ...collectEvidence(discoveryInterviews, [
      "patterns_revealed",
      "recommended_next_steps",
      "possible_vocational_themes",
    ]),
    ...collectEvidence(discoveryActivities, [
      "themes_or_hypotheses_refuted",
      "recommended_next_activities",
      "discovery_hypotheses_confirmed",
      "discovery_hypotheses_to_continue_testing",
    ]),
    ...collectEvidence(informationalInterviews, [
      "connection_to_vocational_themes",
      "client_strengths_that_align",
      "conditions_needed_for_client_success",
      "follow_up_opportunities",
      "customized_employment_possibilities",
      "key_takeaways",
      "recommended_next_steps",
    ]),
    ...collectEvidence(assistiveTechnologyAssessments, [
      "potential_assistive_technology",
      "employment_implications",
      "technology_recommendations",
    ]),
  ], [homeDiscovery, discoveryInterviews, discoveryActivities, informationalInterviews, assistiveTechnologyAssessments]);

  const vocationalThemesEvidence = useMemo(() => [
    ...collectEvidence([homeDiscovery], [
      "preferred_activities",
      "observable_interests",
      "observable_skills",
      "observable_talents",
      "emerging_vocational_themes",
      "potential_businesses_or_settings",
      "possible_discovery_leads",
      "discovery_hypotheses",
      "emerging_patterns",
    ]),
    ...collectEvidence(discoveryInterviews, [
      "positive_qualities",
      "contributions",
      "known_for",
      "favorite_activities",
      "preferred_activities",
      "people_or_connections",
      "businesses_or_places_to_explore",
      "jobs_client_might_enjoy",
      "possible_vocational_themes",
    ]),
    ...collectEvidence(informationalInterviews, [
      "customized_employment_possibilities",
      "job_carving_opportunities",
      "business_organization",
      "employer_needs_identified",
      "key_takeaways",
      "connection_to_vocational_themes",
    ]),
    ...collectEvidence(discoveryActivities, [
      "signs_of_interest",
      "skills_demonstrated",
      "preferred_activities_tools_materials",
      "conditions_associated_with_success",
      "engagement_patterns",
      "discovery_hypotheses_confirmed",
      "customized_employment_possibilities",
    ]),
  ], [homeDiscovery, discoveryInterviews, informationalInterviews, discoveryActivities]);

  const hasAnyEvidence = assessmentRecords.length > 0;

  const totalReadinessScore =
    (countCompleted(assessmentRecords, "home_community_discovery") > 0 ? 25 : 0) +
    (countCompleted(assessmentRecords, "benefits_resources_assessment", "benefits_resources") > 0 ? 15 : 0) +
    (countCompleted(assessmentRecords, "assistive_technology_assessment", "assistive_technology") > 0 ? 10 : 0) +
    Math.min(25, Math.round((Math.min(completedDiscoveryInterviewCount, 3) / 3) * 25)) +
    Math.min(15, Math.round((Math.min(completedInformationalInterviewCount, 2) / 2) * 15)) +
    (completedDiscoveryActivityCount >= 1 ? 10 : 0);

  const fidelityCategories = useMemo(() => [
    { items: emergingInterests },
    { items: observedSkills },
    { items: conditionsForSuccess },
    { items: potentialBusinessSettings },
    { items: relationshipsAndNaturalSupports },
    { items: communityConnections },
    { items: employerLeads },
    { items: benefitsAndFinancialConsiderations, singleSource: true },
    { items: assistiveTechnologyAndAccommodations, singleSource: true },
    { items: discoveryHypotheses },
    { items: vocationalThemesEvidence },
  ], [emergingInterests, observedSkills, conditionsForSuccess, potentialBusinessSettings, relationshipsAndNaturalSupports, communityConnections, employerLeads, benefitsAndFinancialConsiderations, assistiveTechnologyAndAccommodations, discoveryHypotheses, vocationalThemesEvidence]);

  const fidelityMissingCount = fidelityCategories.filter(
    (c) => computeFidelityStatus(c.items, c.singleSource) === "missing"
  ).length;
  const fidelityWeakCount = fidelityCategories.filter(
    (c) => computeFidelityStatus(c.items, c.singleSource) === "weak"
  ).length;

  // ── Back button ─────────────────────────────────────────────────────────
  const BackButton = () => (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setSelectedTile(null)}
      className="mb-4"
    >
      <ArrowLeft className="w-4 h-4 mr-2" />
      Back to Dashboard
    </Button>
  );

  // ── Tile grid view ──────────────────────────────────────────────────────
  if (!selectedTile) {
    return (
      <Card className="border-0 shadow-sm">
        <div className="p-6 space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Customized Employment Command Center
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              Discovery workflow for building the Discovery Staging Record, vocational themes, and customized job development plan.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TILES.map((tile) => (
              <button
                key={tile.id}
                onClick={() => setSelectedTile(tile.id)}
                className="group relative rounded-xl border border-slate-200 bg-white p-6 hover:border-slate-300 hover:shadow-md transition-all hover:-translate-y-0.5"
              >
                <div className={`inline-flex rounded-lg bg-${tile.color}-100 p-3 mb-4 group-hover:shadow-md transition-shadow`}>
                  <tile.icon className={`w-6 h-6 text-${tile.color}-600`} />
                </div>
                <h4 className="font-semibold text-slate-900 text-left text-sm">
                  {tile.label}
                </h4>
              </button>
            ))}
          </div>
        </div>
      </Card>
    );
  }

  // ── Tile content views ──────────────────────────────────────────────────
  return (
    <Card className="border-0 shadow-sm">
      <div className="p-6 space-y-6">
        <BackButton />

        {/* Assessments */}
        {selectedTile === "assessments" && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-4">
                🏠 Assessments
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Home className="h-4 w-4 text-indigo-600" />
                    <h4 className="font-medium text-slate-900">
                      Home & Community Discovery
                    </h4>
                  </div>
                  <p className="text-sm text-slate-500">
                    Home observation, daily routines, community activities, neighborhood mapping, natural supports.
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare className="h-4 w-4 text-indigo-600" />
                    <h4 className="font-medium text-slate-900">
                      Discovery Interviews
                    </h4>
                  </div>
                  <p className="text-sm text-slate-500">
                    {discoveryInterviewCount} interview record{discoveryInterviewCount !== 1 ? "s" : ""} found
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="h-4 w-4 text-indigo-600" />
                    <h4 className="font-medium text-slate-900">
                      Discovery Activities
                    </h4>
                  </div>
                  <p className="text-sm text-slate-500">
                    {discoveryActivityCount} activity record{discoveryActivityCount !== 1 ? "s" : ""} found
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <BriefcaseBusiness className="h-4 w-4 text-indigo-600" />
                    <h4 className="font-medium text-slate-900">
                      Employer Leads
                    </h4>
                  </div>
                  <p className="text-sm text-slate-500">
                    Pulled from assessment responses
                  </p>
                </div>
              </div>
              <div className="mt-6 space-y-3">
                <p className="text-sm font-medium text-slate-900">Assessment Status</p>
                <div className="grid gap-3 md:grid-cols-2">
                  <EvidenceStatus
                    label="Home & Community Discovery"
                    count={countAny(assessmentRecords, "home_community_discovery")}
                    completed={countCompleted(assessmentRecords, "home_community_discovery")}
                  />
                  <EvidenceStatus
                    label="Discovery Interviews"
                    count={discoveryInterviewCount}
                    completed={completedDiscoveryInterviewCount}
                  />
                  <EvidenceStatus
                    label="Benefits & Resources Assessment"
                    count={countAny(assessmentRecords, "benefits_resources_assessment", "benefits_resources")}
                    completed={countCompleted(assessmentRecords, "benefits_resources_assessment", "benefits_resources")}
                  />
                  <EvidenceStatus
                    label="Informational Interviews"
                    count={informationalInterviewCount}
                    completed={completedInformationalInterviewCount}
                  />
                  <EvidenceStatus
                    label="Discovery Activities"
                    count={discoveryActivityCount}
                    completed={completedDiscoveryActivityCount}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Readiness */}
        {selectedTile === "readiness" && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-slate-900">
              📊 Readiness
            </h3>
            <div className="space-y-4">
              <DiscoveryReadinessScore
                homeDiscoveryCompleted={countCompleted(assessmentRecords, "home_community_discovery") > 0}
                benefitsCompleted={countCompleted(assessmentRecords, "benefits_resources_assessment", "benefits_resources") > 0}
                assistiveTechCompleted={countCompleted(assessmentRecords, "assistive_technology_assessment", "assistive_technology") > 0}
                discoveryInterviewCompletedCount={completedDiscoveryInterviewCount}
                discoveryInterviewTotalCount={discoveryInterviewCount}
                informationalInterviewCompletedCount={completedInformationalInterviewCount}
                informationalInterviewTotalCount={informationalInterviewCount}
                discoveryActivityCompletedCount={completedDiscoveryActivityCount}
                discoveryActivityTotalCount={discoveryActivityCount}
              />
              <StageTwoReadinessGate
                totalScore={totalReadinessScore}
                homeDiscoveryCompleted={countCompleted(assessmentRecords, "home_community_discovery") > 0}
                benefitsCompleted={countCompleted(assessmentRecords, "benefits_resources_assessment", "benefits_resources") > 0}
                assistiveTechCompleted={countCompleted(assessmentRecords, "assistive_technology_assessment", "assistive_technology") > 0}
                discoveryInterviewCompletedCount={completedDiscoveryInterviewCount}
                discoveryInterviewTotalCount={discoveryInterviewCount}
                informationalInterviewCompletedCount={completedInformationalInterviewCount}
                informationalInterviewTotalCount={informationalInterviewCount}
                discoveryActivityCompletedCount={completedDiscoveryActivityCount}
                discoveryActivityTotalCount={discoveryActivityCount}
                fidelityMissingCount={fidelityMissingCount}
                fidelityWeakCount={fidelityWeakCount}
                onRules={setGateRules}
              />
              <StageOneWorkDashboard rules={gateRules} />
            </div>
          </div>
        )}

        {/* Milestones */}
        {selectedTile === "milestones" && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-slate-900">
              🎯 Milestones
            </h3>
            <StageOneMilestoneTracker
              homeDiscoveryCompleted={countCompleted(assessmentRecords, "home_community_discovery") > 0}
              benefitsCompleted={countCompleted(assessmentRecords, "benefits_resources_assessment", "benefits_resources") > 0}
              assistiveTechCompleted={countCompleted(assessmentRecords, "assistive_technology_assessment", "assistive_technology") > 0}
              discoveryInterviewCompletedCount={completedDiscoveryInterviewCount}
              informationalInterviewCompletedCount={completedInformationalInterviewCount}
              discoveryActivityCompletedCount={completedDiscoveryActivityCount}
              stageTwoReady={totalReadinessScore === 100}
            />
          </div>
        )}

        {/* Evidence Tracking */}
        {selectedTile === "evidence-tracking" && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-slate-900">
              📁 Evidence Tracking
            </h3>
            {loading ? (
              <p className="text-sm text-slate-500">Loading evidence tracking...</p>
            ) : !hasAnyEvidence ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-sm text-amber-800">
                  No CE evidence entered yet. Complete Home & Community Discovery and at least one Discovery Interview.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-sm text-slate-600">
                  <p><strong>Total Evidence Items:</strong> {emergingInterests.length + observedSkills.length + conditionsForSuccess.length}</p>
                  <p><strong>Total Distinct Concepts:</strong> {countDistinctConcepts(vocationalThemesEvidence)}</p>
                  <p><strong>Source Types:</strong> {countEvidenceSources(vocationalThemesEvidence)}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <p className="text-sm font-semibold text-slate-900">Evidence by Category</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between text-slate-700">
                      <span>Emerging Interests</span>
                      <Badge variant="secondary">{emergingInterests.length}</Badge>
                    </div>
                    <div className="flex justify-between text-slate-700">
                      <span>Observed Skills</span>
                      <Badge variant="secondary">{observedSkills.length}</Badge>
                    </div>
                    <div className="flex justify-between text-slate-700">
                      <span>Conditions for Success</span>
                      <Badge variant="secondary">{conditionsForSuccess.length}</Badge>
                    </div>
                    <div className="flex justify-between text-slate-700">
                      <span>Business Settings</span>
                      <Badge variant="secondary">{potentialBusinessSettings.length}</Badge>
                    </div>
                    <div className="flex justify-between text-slate-700">
                      <span>Community Connections</span>
                      <Badge variant="secondary">{communityConnections.length}</Badge>
                    </div>
                    <div className="flex justify-between text-slate-700">
                      <span>Employer Leads</span>
                      <Badge variant="secondary">{employerLeads.length}</Badge>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Evidence Quality */}
        {selectedTile === "evidence-quality" && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-slate-900">
              🛡 Evidence Quality
            </h3>
            <DiscoveryFidelityPanel
              emergingInterests={emergingInterests}
              observedSkills={observedSkills}
              conditionsForSuccess={conditionsForSuccess}
              potentialBusinessSettings={potentialBusinessSettings}
              relationshipsAndNaturalSupports={relationshipsAndNaturalSupports}
              communityConnections={communityConnections}
              employerLeads={employerLeads}
              benefitsAndFinancialConsiderations={benefitsAndFinancialConsiderations}
              assistiveTechnologyAndAccommodations={assistiveTechnologyAndAccommodations}
              discoveryHypotheses={discoveryHypotheses}
              vocationalThemesEvidence={vocationalThemesEvidence}
            />
          </div>
        )}

        {/* Evidence Explorer */}
        {selectedTile === "evidence-explorer" && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-slate-900">
              🔍 Evidence Explorer
            </h3>
            <DiscoveryEvidenceSourceExplorer
              emergingInterests={emergingInterests}
              observedSkills={observedSkills}
              conditionsForSuccess={conditionsForSuccess}
              potentialBusinessSettings={potentialBusinessSettings}
              relationshipsAndNaturalSupports={relationshipsAndNaturalSupports}
              communityConnections={communityConnections}
              employerLeads={employerLeads}
              benefitsAndFinancialConsiderations={benefitsAndFinancialConsiderations}
              assistiveTechnologyAndAccommodations={assistiveTechnologyAndAccommodations}
              discoveryHypotheses={discoveryHypotheses}
              vocationalThemesEvidence={vocationalThemesEvidence}
              onOpenAssessment={onOpenAssessment}
              client={client}
              currentUser={currentUser}
            />
          </div>
        )}

        {/* Vocational Themes */}
        {selectedTile === "vocational-themes" && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-slate-900">
              🧠 Vocational Themes
            </h3>
            {client && <EvidenceThemeGroupPanel client={client} currentUser={currentUser} />}
          </div>
        )}

        {/* DSR */}
        {selectedTile === "dsr" && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-slate-900">
              📄 DSR - Discovery Staging Record
            </h3>
            <div className="space-y-4">
              <DSRExportPackage
                client={client}
                totalReadinessScore={totalReadinessScore}
                homeDiscoveryCompleted={countCompleted(assessmentRecords, "home_community_discovery") > 0}
                benefitsCompleted={countCompleted(assessmentRecords, "benefits_resources_assessment", "benefits_resources") > 0}
                assistiveTechCompleted={countCompleted(assessmentRecords, "assistive_technology_assessment", "assistive_technology") > 0}
                discoveryInterviewCompletedCount={completedDiscoveryInterviewCount}
                discoveryInterviewTotalCount={discoveryInterviewCount}
                informationalInterviewCompletedCount={completedInformationalInterviewCount}
                informationalInterviewTotalCount={informationalInterviewCount}
                discoveryActivityCompletedCount={completedDiscoveryActivityCount}
                discoveryActivityTotalCount={discoveryActivityCount}
                fidelityMissingCount={fidelityMissingCount}
                fidelityWeakCount={fidelityWeakCount}
                gateRules={gateRules}
                emergingInterests={emergingInterests}
                observedSkills={observedSkills}
                conditionsForSuccess={conditionsForSuccess}
                potentialBusinessSettings={potentialBusinessSettings}
                relationshipsAndNaturalSupports={relationshipsAndNaturalSupports}
                communityConnections={communityConnections}
                employerLeads={employerLeads}
                benefitsAndFinancialConsiderations={benefitsAndFinancialConsiderations}
                assistiveTechnologyAndAccommodations={assistiveTechnologyAndAccommodations}
                discoveryHypotheses={discoveryHypotheses}
                vocationalThemesEvidence={vocationalThemesEvidence}
              />
            </div>
          </div>
        )}

        <BackButton />
      </div>
    </Card>
  );
}