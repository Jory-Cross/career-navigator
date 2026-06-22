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
} from "lucide-react";
import { base44 } from "@/api/base44Client";

const CE_ASSESSMENT_TYPES = [
  "home_community_discovery",
  "benefits_resources_assessment",
  "assistive_technology_assessment",
  "discovery_interview",
  "informational_interview",
  "discovery_activity",
];

function countCompleted(records, assessmentType) {
  return records.filter(
    (record) =>
      record.assessment_type === assessmentType &&
      record.status === "completed"
  ).length;
}

function countAny(records, assessmentType) {
  return records.filter((record) => record.assessment_type === assessmentType)
    .length;
}

function getLatestRecord(records, assessmentType) {
  return records
    .filter((record) => record.assessment_type === assessmentType)
    .sort((a, b) =>
      String(b.updated_date || b.created_date || "").localeCompare(
        String(a.updated_date || a.created_date || "")
      )
    )[0];
}

function getResponseValue(record, fieldId) {
  return record?.responses?.[fieldId] || "";
}

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

export default function CustomizedEmploymentPanel({ client, currentUser }) {
  const [assessmentRecords, setAssessmentRecords] = useState([]);
  const [loading, setLoading] = useState(true);

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

  const homeDiscovery = useMemo(
    () => getLatestRecord(assessmentRecords, "home_community_discovery"),
    [assessmentRecords]
  );

  const benefitsAssessment = useMemo(
    () => getLatestRecord(assessmentRecords, "benefits_resources_assessment"),
    [assessmentRecords]
  );

  const assistiveTechnologyAssessment = useMemo(
    () =>
      getLatestRecord(
        assessmentRecords,
        "assistive_technology_assessment"
      ),
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

function getAssessmentSourceLabel(assessmentType) {
  const labels = {
    home_community_discovery: "Home & Community Discovery",
    benefits_resources_assessment: "Benefits & Resources Assessment",
    assistive_technology_assessment: "Assistive Technology Assessment",
    discovery_interview: "Discovery Interview",
    informational_interview: "Informational Interview",
    discovery_activity: "Discovery Activity",
  };

  return labels[assessmentType] || "Assessment";
}

function splitEvidenceText(value) {
  if (!value || typeof value !== "string") {
    return [];
  }

  return value
    .split(/\n|•|;/)
    .flatMap((part) => part.split(","))
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => part.length > 2);
}

function collectEvidence(records, fields) {
  return records
    .flatMap((record) =>
      fields.flatMap((field) => {
        const value = record?.responses?.[field];
        const evidenceItems = splitEvidenceText(value);

        return evidenceItems.map((text) => ({
          text,
          source: getAssessmentSourceLabel(record?.assessment_type),
          field,
          recordId: record?.id,
          status: record?.status,
          updatedDate: record?.updated_date || record?.created_date || "",
        }));
      })
    )
    .filter(Boolean);
}

const emergingInterests = [
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
];

const observedSkills = [
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
  ...collectEvidence(discoveryActivities, [
    "skills_demonstrated",
  ]),
];

const conditionsForSuccess = [
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
  ...collectEvidence(informationalInterviews, [
    "conditions_needed_for_client_success",
  ]),
];

const potentialBusinessSettings = [
  ...collectEvidence([homeDiscovery], [
    "potential_businesses_or_settings",
  ]),
  ...collectEvidence(discoveryInterviews, [
    "businesses_or_places_to_explore",
  ]),
  ...collectEvidence(discoveryActivities, [
    "possible_business_settings",
  ]),
  ...collectEvidence(informationalInterviews, [
    "job_carving_opportunities",
  ]),
];

const relationshipsAndNaturalSupports = [
  ...collectEvidence([homeDiscovery], [
    "natural_supports",
    "social_preferences",
    "neighbors_connections",
    "preferred_people_patterns",
  ]),
  ...collectEvidence(discoveryInterviews, [
    "preferred_people",
    "people_or_connections",
    "positive_qualities",
    "contributions",
  ]),
  ...collectEvidence(discoveryActivities, [
    "people_present",
    "people_social_conditions",
    "supports_or_accommodations_used",
  ]),
];

const communityConnections = [
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
];

const employerLeads = [
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
];

const discoveryHypotheses = [
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
];
  
const hasAnyEvidence = assessmentRecords.length > 0;

function countEvidenceSources(items) {
  return new Set(items.map((item) => item.source).filter(Boolean)).size;
}

function buildSourceBreakdown(items) {
  const breakdown = {};

  items.forEach((item) => {
    if (!item?.source) return;

    breakdown[item.source] = (breakdown[item.source] || 0) + 1;
  });

  return Object.entries(breakdown)
    .map(([source, count]) => ({
      source,
      count,
    }))
    .sort((a, b) => b.count - a.count);
}

function normalizeEvidenceConcept(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/public\s+/g, "")
    .replace(/local\s+/g, "")
    .replace(/community\s+/g, "")
    .trim();
}

function countDistinctConcepts(items) {
  return new Set(
    items.map((item) =>
      normalizeEvidenceConcept(item.text)
    )
  ).size;
}

const discoveryProgressItems = [
  {
    label: "Home & Community Discovery",
    evidenceItems: countAny(
      assessmentRecords,
      "home_community_discovery"
    ),
    sourceCount: null,
  },
  {
    label: "Discovery Interviews",
    evidenceItems: discoveryInterviewCount,
    sourceCount: null,
  },
  {
    label: "Discovery Activities",
    evidenceItems: discoveryActivityCount,
    sourceCount: null,
  },
  {
    label: "Informational Interviews",
    evidenceItems: informationalInterviewCount,
    sourceCount: null,
  },
{
  label: "Emerging Interests",
  evidenceItems: emergingInterests.length,
  conceptCount: countDistinctConcepts(emergingInterests),
  sourceCount: countEvidenceSources(emergingInterests),
  sourceBreakdown: buildSourceBreakdown(emergingInterests),
},
{
  label: "Conditions for Success",
  evidenceItems: conditionsForSuccess.length,
  conceptCount: countDistinctConcepts(emergingInterests),
  sourceCount: countEvidenceSources(conditionsForSuccess),
  sourceBreakdown: buildSourceBreakdown(conditionsForSuccess),
},
{
  label: "Business Settings",
  evidenceItems: potentialBusinessSettings.length,
  conceptCount: countDistinctConcepts(emergingInterests),
  sourceCount: countEvidenceSources(potentialBusinessSettings),
  sourceBreakdown: buildSourceBreakdown(potentialBusinessSettings),
},
{
  label: "Employer Leads",
  evidenceItems: employerLeads.length,
  conceptCount: countDistinctConcepts(emergingInterests),
  sourceCount: countEvidenceSources(employerLeads),
  sourceBreakdown: buildSourceBreakdown(employerLeads),
},
];

  return (
    <Card className="border-0 shadow-sm">
      <div className="p-6 space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Customized Employment
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            Discovery workflow for building the Discovery Staging Record,
            vocational themes, and customized job development plan.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <Home className="h-4 w-4 text-indigo-600" />
              <h4 className="font-medium text-slate-900">
                Home & Community Discovery
              </h4>
            </div>
            <p className="text-sm text-slate-500 mt-2">
              Home observation, daily routines, community activities,
              neighborhood mapping, natural supports, interests, and observable
              skills.
            </p>
            <p className="text-xs text-slate-400 mt-3">
              Assessment available in the CE assessment tab.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-indigo-600" />
              <h4 className="font-medium text-slate-900">
                Discovery Interviews
              </h4>
            </div>
            <p className="text-sm text-slate-500 mt-2">
              Interviews with family, staff, friends, teachers, providers,
              employers, and other people who know the client well.
            </p>
            <p className="text-xs text-slate-400 mt-3">
              {discoveryInterviewCount} interview record
              {discoveryInterviewCount === 1 ? "" : "s"} found.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-indigo-600" />
              <h4 className="font-medium text-slate-900">
                Discovery Activities
              </h4>
            </div>
            <p className="text-sm text-slate-500 mt-2">
              Task-based discovery activities in familiar and unfamiliar
              settings, including observed skills, supports, interests, and
              ecological fit.
            </p>
            <p className="text-xs text-slate-400 mt-3">
              Coming later
            </p>
          </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
  <div className="flex items-center gap-2">
    <BriefcaseBusiness className="h-4 w-4 text-indigo-600" />
    <h4 className="font-medium text-slate-900">
      Employer Leads
    </h4>
  </div>
  <p className="text-sm text-slate-500 mt-2">
    Businesses, industries, community settings, and customized employment
    leads identified through discovery evidence.
  </p>
  <p className="text-xs text-slate-400 mt-3">
    Pulled from assessment responses only.
  </p>
</div>
        </div>

        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-white p-2 border border-indigo-100">
              <FileText className="h-5 w-5 text-indigo-600" />
            </div>

            <div>
              <h4 className="text-base font-semibold text-slate-900">
                Discovery Staging Record
              </h4>
              <p className="text-sm text-slate-600 mt-1">
  Draft shell that organizes CE evidence into emerging interests,
  skills, conditions for success, relationships, community connections,
  employer leads, and Stage Two hypotheses.
</p>
            </div>
          </div>

          {loading ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-sm text-slate-500">
                Loading CE evidence...
              </p>
            </div>
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-2">
                <EvidenceStatus
                  label="Home & Community Discovery"
                  count={countAny(
                    assessmentRecords,
                    "home_community_discovery"
                  )}
                  completed={countCompleted(
                    assessmentRecords,
                    "home_community_discovery"
                  )}
                />

                <EvidenceStatus
                  label="Discovery Interviews"
                  count={discoveryInterviewCount}
                  completed={completedDiscoveryInterviewCount}
                />

                <EvidenceStatus
                  label="Benefits & Resources Assessment"
                  count={countAny(
                    assessmentRecords,
                    "benefits_resources_assessment"
                  )}
                  completed={countCompleted(
                    assessmentRecords,
                    "benefits_resources_assessment"
                  )}
                />

             <EvidenceStatus
  label="Assistive Technology Assessment"
  count={countAny(
    assessmentRecords,
    "assistive_technology_assessment"
  )}
  completed={countCompleted(
    assessmentRecords,
    "assistive_technology_assessment"
  )}
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
/>              </div>

              {!hasAnyEvidence ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-sm text-amber-800">
                    No CE evidence has been entered yet. Complete Home &
                    Community Discovery and at least one Discovery Interview
                    before building the Discovery Staging Record.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
               <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
  <div className="flex items-center justify-between">
    <h5 className="text-sm font-semibold text-slate-900">
      Discovery Progress
    </h5>

    <Badge variant="outline">
      Evidence Tracking
    </Badge>
  </div>

 <div className="grid gap-3 md:grid-cols-2 mt-3">
  {discoveryProgressItems.map((item) => (
    <div
      key={item.label}
      className="border-b border-slate-100 pb-2"
    >
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-700">
          {item.label}
        </span>

        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            {item.evidenceItems} item{item.evidenceItems === 1 ? "" : "s"}
          </Badge>

          {item.sourceCount !== null && (
            <Badge variant="outline">
              {item.sourceCount} source{item.sourceCount === 1 ? "" : "s"}
            </Badge>
          )}
        </div>
      </div>

      {item.sourceBreakdown?.length > 0 && (
        <div className="mt-2 ml-2 space-y-1">
          {item.sourceBreakdown.map((source) => (
            <div
              key={`${item.label}-${source.source}`}
              className="text-xs text-slate-500"
            >
              • {source.source} ({source.count})
            </div>
          ))}
        </div>
      )}
    </div>
  ))}
</div>

  <p className="text-xs text-slate-500 mt-3">
    Evidence counts only. Discovery fidelity and completion criteria will be evaluated separately.
  </p>
</div>

<div className="flex items-center gap-2">
  <Sparkles className="h-4 w-4 text-indigo-600" />
  <h5 className="text-sm font-semibold text-slate-900">
    Draft Evidence Preview
  </h5>
</div>

<div className="grid gap-4 md:grid-cols-2">
  {[
    {
      label: "Emerging Interests",
      items: emergingInterests,
      emptyText: "No interests identified yet.",
    },
    {
      label: "Observed Skills",
      items: observedSkills,
      emptyText: "No skills identified yet.",
    },
    {
      label: "Conditions for Success",
      items: conditionsForSuccess,
      emptyText: "No conditions identified yet.",
    },
    {
      label: "Potential Business Settings",
      items: potentialBusinessSettings,
      emptyText: "No business settings identified yet.",
    },
    {
      label: "Relationships / Natural Supports",
      items: relationshipsAndNaturalSupports,
      emptyText: "No natural supports identified yet.",
    },
    {
      label: "Community Connections",
      items: communityConnections,
      emptyText: "No community connections identified yet.",
    },
    {
      label: "Employer Leads",
      items: employerLeads,
      emptyText: "No employer leads identified yet.",
    },
    {
      label: "Discovery Hypotheses",
      items: discoveryHypotheses,
      emptyText: "No discovery hypotheses identified yet.",
    },
  ].map((section) => (
    <div key={section.label}>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
        {section.label}
      </p>

      {section.items.length > 0 ? (
        <ul className="mt-2 space-y-3 text-sm text-slate-700">
          {section.items.slice(0, 10).map((item, index) => (
            <li key={`${section.label}-${index}`}>
              <p>• {item.text}</p>
              <p className="text-xs text-slate-400 mt-1 ml-3">
                Source: {item.source}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500 mt-1">
          {section.emptyText}
        </p>
      )}
    </div>
  ))}
</div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
