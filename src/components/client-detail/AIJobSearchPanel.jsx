import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Sparkles, Loader2, CheckCircle, BookmarkPlus,
  Search, History, Lightbulb, AlertTriangle, FileText,
  ChevronDown, ChevronUp, Info
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import JobCard from "./JobCard";
import VocationalFactsPanel from "./VocationalFactsPanel";
import JobSearchFilters from "./JobSearchFilters";
import RecommendationBatchReview from "./RecommendationBatchReview";
import SourceProvenancePanel from "@/components/shared/SourceProvenancePanel";
import { loadLatestRecommendationBatch } from "@/lib/recommendations/loadLatestRecommendationBatch";
const safeArray = (value) => Array.isArray(value) ? value : [];
const safeString = (value) => typeof value === "string" ? value.trim() : "";

const STATUS_LABELS = { suggested: "Suggested", saved: "Saved", applied: "Applied", rejected: "Not a Fit" };

function ProfileSummaryCard({ profile, assessmentsUsed, hasVFP, dataQualityScore, conflictsCount }) {
  const [open, setOpen] = useState(false);

  return (
    <Card className="border-0 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-slate-800">Vocational Profile</span>
          {assessmentsUsed?.length > 0 && (
            <Badge className="text-[10px] bg-purple-100 text-purple-700 border-0">
              {assessmentsUsed.length} assessment{assessmentsUsed.length !== 1 ? 's' : ''}
            </Badge>
          )}
          {hasVFP && (
            <Badge className="text-[10px] bg-green-100 text-green-700 border-0">
              <CheckCircle className="w-2.5 h-2.5 mr-1" /> Grounded in facts profile
            </Badge>
          )}
          {dataQualityScore != null && (
            <Badge className={cn("text-[10px] border-0",
              dataQualityScore >= 70 ? "bg-green-100 text-green-700" :
              dataQualityScore >= 40 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-600"
            )}>
              {dataQualityScore}% quality
            </Badge>
          )}
          {conflictsCount > 0 && (
            <Badge className="text-[10px] bg-amber-100 text-amber-700 border-0">
              <AlertTriangle className="w-2.5 h-2.5 mr-1" /> {conflictsCount} conflict{conflictsCount !== 1 ? 's' : ''} flagged
            </Badge>
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {open && profile && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-100">
          {profile.summary && (
            <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 rounded-lg p-3 mt-3">
              {profile.summary}
            </p>
          )}

          {profile.data_sources_used?.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Data Sources Used</p>
              <div className="flex flex-wrap gap-1">
                {profile.data_sources_used.map((s, i) => (
                  <span key={i} className="text-[10px] bg-violet-50 border border-violet-100 text-violet-700 px-2 py-0.5 rounded-full">{s}</span>
                ))}
              </div>
            </div>
          )}
          
          {profile.conflicts_to_review?.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-amber-800 mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Conflicts Flagged for Staff Review
              </p>
              <div className="space-y-2">
                {profile.conflicts_to_review.map((c, i) => (
                  <div key={i} className="text-xs bg-white rounded border border-amber-100 p-2">
                    <p className="font-medium text-amber-900 mb-1">📌 {c.topic}</p>
                    <p className="text-slate-600">{c.source_a}: <em>"{c.value_a}"</em></p>
                    <p className="text-slate-600">{c.source_b}: <em>"{c.value_b}"</em></p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {[
              { key: 'strengths', label: '💪 Strengths', color: 'text-green-700' },
              { key: 'barriers', label: '⚠️ Barriers', color: 'text-amber-700' },
              { key: 'support_needs', label: '🤝 Support Needs', color: 'text-blue-700' },
              { key: 'work_environment_preferences', label: '🏢 Environment', color: 'text-purple-700' },
              { key: 'schedule_constraints', label: '📅 Schedule', color: 'text-indigo-700' },
              { key: 'suggested_job_targets', label: '🎯 Job Targets', color: 'text-slate-700', plain: true },
            ].map(s => {
              const items = profile[s.key] || [];
              if (!items.length) return null;
              return (
                <div key={s.key} className="p-3 bg-white rounded-lg border border-slate-100">
                  <p className={cn("text-xs font-semibold mb-1.5", s.color)}>{s.label}</p>
                  <ul className="space-y-1">
                    {items.map((item, i) => (
                      <li key={i} className="text-xs text-slate-600 flex gap-1.5">
                        <span className="shrink-0 mt-0.5">•</span>
                        <span>
                          {s.plain ? item : item.item}
                          {!s.plain && item.source && (
                            <span className="text-[10px] text-slate-400 ml-1">[{item.source}]</span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          {profile.benefits_considerations && (
            <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg text-xs text-amber-800">
              <span className="font-semibold">Benefits Considerations: </span>{profile.benefits_considerations}
            </div>
          )}

          {profile.missing_information?.length > 0 && (
            <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
              <p className="text-xs font-semibold text-blue-800 mb-1.5 flex items-center gap-1">
                <Info className="w-3.5 h-3.5" /> Missing Information (would improve recommendations)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {profile.missing_information.map((m, i) => (
                  <span key={i} className="text-[10px] bg-white border border-blue-200 text-blue-700 px-2 py-0.5 rounded-full">{m}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export default function AIJobSearchPanel({ clientId, client: initialClient, onStartInterestProfiler }) {
 const resolvedClientId = clientId || initialClient?.id || "";
  const [activeTab, setActiveTab] = useState('search'); 
  const [recommendationBatch, setRecommendationBatch] = useState(null);
  const [profile, setProfile] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [savedRecs, setSavedRecs] = useState([]);
  const [savedBatches, setSavedBatches] = useState({});
  const [searchSummary, setSearchSummary] = useState('');
  const [groundingNote, setGroundingNote] = useState('');
  const [customInstructions, setCustomInstructions] = useState('');
  const [assessmentsUsed, setAssessmentsUsed] = useState([]);
  const [clientFieldsUsed, setClientFieldsUsed] = useState([]);
  const [searchTermsUsed, setSearchTermsUsed] = useState([]);
  const [nextSteps, setNextSteps] = useState([]);
  const [unresolvedConflicts, setUnresolvedConflicts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generatingRecommendations, setGeneratingRecommendations] = useState(false);
  const [savingAll, setSavingAll] = useState(false);
  const [savedBatchId, setSavedBatchId] = useState(null);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [client, setClient] = useState(initialClient);
  const [hasVFP, setHasVFP] = useState(!!initialClient?.vocational_facts_profile);
  const [profileMeta, setProfileMeta] = useState({
    dataQualityScore: null,
    conflictsCount: 0,
  });
const [filters, setFilters] = useState({});
const [hasInterestProfilerAssessment, setHasInterestProfilerAssessment] = useState(false);

const refreshInterestProfilerStatus = useCallback(async () => {
  if (!resolvedClientId) return false;

  try {
    const assessments = base44.entities.Assessment?.filter
      ? await base44.entities.Assessment.filter({
          client_id: resolvedClientId,
        })
      : [];

    const hasProfiler = safeArray(assessments).some((assessment) => {
      const type = safeString(assessment?.assessment_type).toLowerCase();
      const title = safeString(assessment?.title || assessment?.name).toLowerCase();

      return (
        type === "interest_profiler" ||
        type.includes("interest_profiler") ||
        title.includes("interest profiler")
      );
    });

    setHasInterestProfilerAssessment(hasProfiler);
    return hasProfiler;
  } catch (err) {
    console.error("Failed to check Interest Profiler assessment:", err);
    setHasInterestProfilerAssessment(false);
    return false;
  }
}, [resolvedClientId]);

const [recommendationFreshness, setRecommendationFreshness] = useState({
  isOutdated: false,
  newestInputDate: null,
  generatedAt: null,
  reason: "",
});

useEffect(() => {
  if (!resolvedClientId) return;
  loadSavedRecs();
  loadLatestBatch();

  refreshInterestProfilerStatus();

  base44.functions
    .invoke("processAssessmentDocuments", {
      action: "get_vocational_facts",
      clientId: resolvedClientId,
    })
    .then((res) => {
      const vfp = res?.data?.profile || null;
      const metadata = res?.data?.metadata || {};

      setHasVFP(!!vfp);

      setClient((prev) => ({
        ...prev,
        vocational_facts_profile: vfp,
        vocational_facts_metadata: metadata,
        vocational_facts_extracted_at:
          metadata.extracted_at || res?.data?.last_updated_at || null,
        vocational_facts_extracted_by: metadata.extracted_by || null,
        vocational_facts_document_count:
          metadata.source_document_ids?.length || 0,
        vocational_facts_assessment_count:
          metadata.source_assessment_ids?.length || 0,
        vocational_facts_last_updated_at: res?.data?.last_updated_at || null,
      }));
    })
    .catch((err) => {
      console.error("Failed to load saved VFP on AI Job Search load:", err);
    });

}, [resolvedClientId, refreshInterestProfilerStatus]);
  
    const refreshClient = useCallback(async () => {
    try {
      const res = await base44.functions.invoke("processAssessmentDocuments", {
        action: "get_vocational_facts",
        clientId: resolvedClientId,
      });

      const vfp = res?.data?.profile || null;
      const metadata = res?.data?.metadata || {};

      setHasVFP(!!vfp);

      setClient((prev) => ({
        ...prev,
        vocational_facts_profile: vfp,
        vocational_facts_metadata: metadata,
        vocational_facts_extracted_at:
          metadata.extracted_at || res?.data?.last_updated_at || null,
        vocational_facts_extracted_by: metadata.extracted_by || null,
        vocational_facts_document_count:
          metadata.source_document_ids?.length || 0,
        vocational_facts_assessment_count:
          metadata.source_assessment_ids?.length || 0,
        vocational_facts_last_updated_at: res?.data?.last_updated_at || null,
      }));
    } catch (e) {
      console.error("Failed to refresh vocational facts profile", e);
    }
  }, [resolvedClientId]);

  const loadSavedRecs = async () => {
    setLoadingSaved(true);
    try {
   
const recs = await base44.entities.JobRecommendation.filter(
  { client_id: resolvedClientId },
  '-created_date',
  100
);
     
      const batchIds = [...new Set(recs.map(r => r.batch_id).filter(Boolean))];
      const batches = {};
      
      if (batchIds.length > 0) {
        const batchObjs = await base44.entities.JobRecommendationBatch.filter(
          { id: { $in: batchIds } }
        );
        batchObjs.forEach(b => {
          batches[b.id] = b;
        });
      }

      setSavedRecs(recs);
      setSavedBatches(batches);
    } catch (e) {
      console.error('Error loading saved recommendations:', e);
    } finally {
      setLoadingSaved(false);
    }
  };

  const getItemTimestamp = (item) => {
    const value =
      item?.updated_date ||
      item?.updated_at ||
      item?.created_date ||
      item?.created_at ||
      item?.date ||
      null;

    if (!value) return 0;

    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : 0;
  };

  const loadRecommendationFreshness = async (batch) => {
    if (!resolvedClientId || !batch) {
      setRecommendationFreshness({
        isOutdated: false,
        newestInputDate: null,
        generatedAt: null,
        reason: "",
      });
      return;
    }

    const generatedAt =
      batch.generated_at ||
      batch.created_date ||
      batch.created_at ||
      null;

    const generatedTime = generatedAt ? new Date(generatedAt).getTime() : 0;

    if (!generatedTime) {
      setRecommendationFreshness({
        isOutdated: false,
        newestInputDate: null,
        generatedAt,
        reason: "",
      });
      return;
    }

    try {
      const docs = await base44.entities.Document.filter({
        client_id: resolvedClientId,
      });

      const assessments = base44.entities.Assessment?.filter
        ? await base44.entities.Assessment.filter({
            client_id: resolvedClientId,
          })
        : [];

      const vfpTime = client?.vocational_facts_extracted_at
        ? new Date(client.vocational_facts_extracted_at).getTime()
        : 0;

      const newestInputTime = Math.max(
        0,
        ...safeArray(docs).map(getItemTimestamp),
        ...safeArray(assessments).map(getItemTimestamp),
        vfpTime
      );

      const newestInputDate =
        newestInputTime > 0 ? new Date(newestInputTime).toISOString() : null;

      setRecommendationFreshness({
        isOutdated: newestInputTime > generatedTime,
        newestInputDate,
        generatedAt,
        reason:
          newestInputTime > generatedTime
            ? "New client data was added after these recommendations were generated."
            : "",
      });
    } catch (e) {
      console.error("Failed to check recommendation freshness", e);
    }
  };

  const loadLatestBatch = async () => {
  try {
    const batch = await loadLatestRecommendationBatch(resolvedClientId);

    if (!batch) return;

    const parsedRecommendations = (() => {
      if (Array.isArray(batch.recommendations)) {
        return batch.recommendations;
      }

      if (typeof batch.recommended_job_fields_json === "string") {
        try {
          const parsed = JSON.parse(batch.recommended_job_fields_json);
          return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
          console.error("FAILED TO PARSE recommended_job_fields_json", e);
          return [];
        }
      }

      return [];
    })();

    const normalizedBatch = {
      ...batch,
      recommendations: parsedRecommendations,
    };

    let shouldLoadFreshness = true;

    setRecommendationBatch((currentBatch) => {
      if (currentBatch?.error && !normalizedBatch?.error) {

        shouldLoadFreshness = false;
        return currentBatch;
      }

      return normalizedBatch;
    });

    if (shouldLoadFreshness) {
      await loadRecommendationFreshness(normalizedBatch);
    }
  } catch (e) {
    console.error("Failed to load saved batch", e);
  }
};
  
  const runSearch = async () => {
    setLoading(true);
    setJobs([]);
    setProfile(null);
    setSavedBatchId(null);

    try {
     const profileRes = await base44.functions.invoke('jobSearchAssistant', {
  action: 'generate_vocational_profile',
  clientId: resolvedClientId,
});
      const profileData = profileRes?.data?.data;
      setProfile(profileData);
      setAssessmentsUsed(profileRes?.data?.assessments_used || []);
      setClientFieldsUsed(profileRes?.data?.client_fields_used || []);
      setHasVFP(profileRes?.data?.has_vocational_facts || false);
      setProfileMeta({
        dataQualityScore: profileRes?.data?.data_quality_score,
        conflictsCount: profileRes?.data?.conflicts_count || 0,
      });

     
 const jobRes = await base44.functions.invoke('jobSearchAssistant', {
  action: 'find_jobs',
  clientId: resolvedClientId,
  profile: profileData,
  customInstructions,
  filters,
});
      const jobData = jobRes?.data?.data;
      setJobs(jobData?.jobs || []);
      setSearchSummary(jobData?.search_summary || '');
      setGroundingNote(jobData?.grounding_note || '');
      setNextSteps(jobData?.next_steps || []);
      setSearchTermsUsed(jobData?.search_terms_used || []);
      setUnresolvedConflicts(jobData?.unresolved_conflicts_affecting_search || []);
    } catch (e) {
      toast.error('Search failed: ' + (e?.response?.data?.error || e.message));
      
    } finally {
      setLoading(false);
    }
  };

  const saveAllToClient = async () => {
    if (savingAll) return;
    
    if (!jobs.length) {
  toast.error("No recommendations available to save.");
  return;
}

const validJobs = jobs.filter(
  (job) => job.confidence_level !== "low"
);

if (!validJobs.length) {
  toast.error("No valid recommendations available to save.");
  return;
}

const newJobs = validJobs.filter((job) => {
  const jobTitle = safeString(job.job_title || job.title).toLowerCase();
  const employer = safeString(job.employer).toLowerCase();

  return !savedRecs.some((saved) => {
    const savedTitle = safeString(saved.job_title || saved.title).toLowerCase();
    const savedEmployer = safeString(saved.employer).toLowerCase();

    return savedTitle === jobTitle && savedEmployer === employer;
  });
});

if (!newJobs.length) {
  toast.error("All valid recommendations are already saved.");
  return;
}

setSavingAll(true);
    try {
      const res = await base44.functions.invoke('jobSearchAssistant', {
  action: 'save_recommendations',
  clientId: resolvedClientId,
  jobs: newJobs,
  assessmentsUsed,
  clientFieldsUsed: clientFieldsUsed,
  searchTermsUsed,
  dataSourcesUsed: ['vocational_facts_profile', 'assessments', 'goals', 'support_notes', 'job_applications'].filter(s => {
    if (s === 'vocational_facts_profile') return hasVFP;
    if (s === 'assessments') return assessmentsUsed.length > 0;
    return true;
  }),
  filters,
  has_vocational_facts: hasVFP,
  vocational_profile_version: 1,
  search_summary: searchSummary,
  grounding_note: groundingNote,
  custom_instructions: customInstructions,
  data_quality_score: profileMeta.dataQualityScore,
});
      setSavedBatchId(res?.data?.batch_id);
      
      if (res?.data?.batch) {
        setSavedBatches(prev => ({ ...prev, [res.data.batch_id]: res.data.batch }));
      }
     toast.success(`${newJobs.length} recommendations saved and pending staff review`);
      await loadSavedRecs();
      setActiveTab('saved');
    } catch (e) {
      toast.error('Failed to save: ' + e.message);
    } finally {
      setSavingAll(false);
    }
  };

  const handleStatusChange = async (job, status) => {
    if (status === 'save') {
  const jobTitle = safeString(job.job_title || job.title).toLowerCase();
  const employer = safeString(job.employer).toLowerCase();

  const alreadySaved = savedRecs.some((saved) => {
    const savedTitle = safeString(saved.job_title || saved.title).toLowerCase();
    const savedEmployer = safeString(saved.employer).toLowerCase();

    return savedTitle === jobTitle && savedEmployer === employer;
  });

  if (alreadySaved) {
    toast.error("This recommendation is already saved.");
    return;
  }

  try {
       await base44.functions.invoke('jobSearchAssistant', {
  action: 'save_recommendations',
  clientId: resolvedClientId,
  jobs: [job],
  assessmentsUsed,
  clientFieldsUsed,
  searchTermsUsed,
});
        toast.success('Job saved to client record');
        await loadSavedRecs();
      } catch (e) {
        toast.error('Failed to save');
      }
      return;
    }
    try {
      const rec = savedRecs.find(r =>
        r.job_title === job.job_title && r.employer === job.employer
      ) || job;
     await base44.functions.invoke('jobSearchAssistant', {
  action: 'update_recommendation_status',
  clientId: resolvedClientId,
  recommendationId: rec.id || job.id,
  status,
});
      await loadSavedRecs();
      toast.success(`Marked as ${STATUS_LABELS[status]}`);
    } catch (e) {
      toast.error('Failed to update status');
    }
  };

  const needsFactExtraction = !hasVFP;

const validJobCount = jobs.filter(
  (job) => job.confidence_level !== "low"
).length;

  return (
    <div className="space-y-4">
     
      <div className="flex items-center justify-between">
  <div>
    <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center">
        <Sparkles className="w-4 h-4 text-white" />
      </div>
      AI Job Search Assistant
    </h3>
    <p className="text-xs text-slate-500 mt-0.5 ml-9">
      Resume data, WSA data, other assessments, and O*NET recommendations
    </p>
  </div>

  <div className="flex flex-col items-end gap-2">
      
  <Button
  size="sm"
  className="h-8 text-xs"
  disabled={
    generatingRecommendations ||
    !hasInterestProfilerAssessment
  }
  title={
    !hasInterestProfilerAssessment
      ? "Complete the Interest Profiler assessment first."
      : ""
  }
  onClick={async () => {
    try {
      setGeneratingRecommendations(true);

      const { runRecommendationEngine } = await import(
        "@/lib/recommendations/runRecommendationEngine"
      );

      const docs = await base44.entities.Document.filter({
        client_id: resolvedClientId,
      });

      const assessments = base44.entities.Assessment?.filter
        ? await base44.entities.Assessment.filter({
            client_id: resolvedClientId,
          })
        : [];

      if (!docs.length && !assessments.length) {
        toast.error("Upload a resume or assessment first.");
        return;
      }

      const hasInterestProfiler = assessments.some((assessment) => {
        const type = safeString(assessment?.assessment_type).toLowerCase();
        const title = safeString(
          assessment?.title || assessment?.name
        ).toLowerCase();

        return (
          type === "interest_profiler" ||
          type.includes("interest_profiler") ||
          title.includes("interest profiler")
        );
      });

      if (!hasInterestProfiler) {
        const profilerError =
          "Interest Profiler is required before recommendations can be generated. Complete the Interest Profiler first, then generate recommendations again.";

        setRecommendationBatch({
          error: profilerError,
          recommendations: [],
          job_count: 0,
        });

        toast.error(profilerError);
        return;
      }

      const result = await runRecommendationEngine({
        client: { ...(client || {}), id: resolvedClientId },
        documents: docs,
        assessments,
        forceRegenerate: true,
      });

      const generatedBatch = result?.batch || null;

      setRecommendationBatch(generatedBatch);

      setRecommendationFreshness({
        isOutdated: false,
        newestInputDate: null,
        generatedAt:
          generatedBatch?.generated_at ||
          generatedBatch?.created_date ||
          generatedBatch?.created_at ||
          new Date().toISOString(),
        reason: "",
      });

      if (result?.batch?.error) {
        toast.error(result.batch.error);
      } else if (result?.batch?.recommendations?.length > 0) {
        toast.success("Recommendations generated");
      } else {
        toast.error("No recommendations were generated.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate recommendations");
    } finally {
      setGeneratingRecommendations(false);
    }
  }}
>
  {generatingRecommendations ? (
  <>
    <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
    Generating...
  </>
) : (
  "Generate Recommendations"
)}
</Button>

{!hasInterestProfilerAssessment && (
  <div className="mt-2 w-full max-w-sm rounded-xl border-2 border-amber-400 bg-amber-50 px-4 py-3 shadow-sm">
    <div className="flex items-start gap-2">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />

      <div className="flex-1">
        <p className="text-sm font-bold text-amber-900">
          Interest Profiler Required
        </p>

        <p className="mt-1 text-xs leading-relaxed text-amber-800">
          Complete the Interest Profiler assessment before generating AI job recommendations.
        </p>

        {onStartInterestProfiler && (
          <Button
            size="sm"
            className="mt-3 h-8 text-xs"
            onClick={onStartInterestProfiler}
          >
            Start Interest Profiler
          </Button>
        )}
      </div>
    </div>
  </div>
)}
   
        <Button
      size="sm"
      variant={activeTab === 'facts' ? 'default' : 'outline'}
      className="h-8 text-xs"
      onClick={() => setActiveTab(activeTab === 'facts' ? 'search' : 'facts')}
    >
      <FileText className="w-3.5 h-3.5 mr-1" /> Facts
    </Button>

    <Button
      size="sm"
      variant={activeTab === 'search' ? 'default' : 'outline'}
      className="h-8 text-xs"
      onClick={() => setActiveTab('search')}
    >
      <Search className="w-3.5 h-3.5 mr-1" /> Search
    </Button>

        <Button
      size="sm"
      variant={activeTab === 'saved' ? 'default' : 'outline'}
      className="h-8 text-xs"
      onClick={() => setActiveTab(activeTab === 'saved' ? 'search' : 'saved')}
    >
      <History className="w-3.5 h-3.5 mr-1" /> Saved
    </Button>
  </div>
</div>
      
      {activeTab === 'facts' && (
      <VocationalFactsPanel
  clientId={resolvedClientId}
  client={client}
  onFactsUpdated={refreshClient}
  extractedAt={client?.vocational_facts_extracted_at}
  extractedBy={client?.vocational_facts_extracted_by}
  documentCount={client?.vocational_facts_document_count}
  assessmentCount={client?.vocational_facts_assessment_count}
/>
)}
           
      {activeTab === 'search' && (
        <div className="space-y-4">
          {recommendationFreshness.isOutdated && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
              <div className="flex-1">
                <p className="text-xs font-semibold text-amber-900">
                  Recommendations may be outdated
                </p>
                <p className="mt-0.5 text-xs text-amber-800">
                  New client data was added after these recommendations were generated.
                  Click <strong>Generate Recommendations</strong> to refresh them.
                </p>
              </div>
            </div>
          )}

          {needsFactExtraction && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-semibold text-amber-800">No Vocational Facts Profile found</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  For grounded, cited recommendations, first go to the <strong>Facts</strong> tab and run "Extract Facts".
                  You can still search now — the AI will use available assessments and the client record.
                </p>
              </div>
              <Button size="sm" variant="outline" className="h-7 text-xs shrink-0 border-amber-300 text-amber-700 hover:bg-amber-100"
                onClick={() => setActiveTab('facts')}>
                Go to Facts
              </Button>
            </div>
          )}

          {hasVFP && !loading && (
            <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-100 rounded-lg text-xs text-green-800">
              <CheckCircle className="w-3.5 h-3.5 text-green-600 shrink-0" />
              Vocational facts profile found — recommendations will be grounded in extracted client data with source citations.
            </div>
          )}

          <JobSearchFilters filters={filters} onFiltersChange={setFilters} />

          <Card className="border-0 shadow-sm p-4 space-y-3">
            <Label className="text-xs text-slate-500 block">Additional instructions for the AI (optional)</Label>
            <Textarea
              placeholder={`e.g. "Focus on part-time jobs near downtown. Avoid loud environments. Consider jobs with flexible start times."`}
              value={customInstructions}
              onChange={e => setCustomInstructions(e.target.value)}
              className="text-sm min-h-[70px] resize-none"
            />
            <Button className="w-full" onClick={runSearch} disabled={loading}>
  {loading ? (
    <>
      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      Searching live jobs with citations...
    </>
  ) : (
    <>
      <Sparkles className="w-4 h-4 mr-2" />
      {jobs.length > 0
        ? "Search Again"
        : "Find Grounded Jobs for This Client"}
    </>
  )}
</Button>
          </Card>

      
          {profile && (
            <>
              <ProfileSummaryCard
                profile={profile}
                assessmentsUsed={assessmentsUsed}
                hasVFP={hasVFP}
                dataQualityScore={profileMeta.dataQualityScore}
                conflictsCount={profileMeta.conflictsCount}
              />
              <SourceProvenancePanel
                profile={client?.vocational_facts_profile}
                client={client}
                extractedAt={client?.vocational_facts_extracted_at}
                extractedBy={client?.vocational_facts_extracted_by}
                documentCount={client?.vocational_facts_document_count}
                assessmentCount={client?.vocational_facts_assessment_count}
                variant="inline"
              />
            </>
          )}

          {unresolvedConflicts.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <p className="text-xs font-semibold text-amber-800 mb-1.5 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Unresolved Conflicts Affecting This Search
              </p>
              <ul className="space-y-0.5">
                {unresolvedConflicts.map((c, i) => (
                  <li key={i} className="text-xs text-amber-700 flex gap-1.5">
                    <span className="shrink-0">•</span>{c}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
{recommendationBatch &&
  recommendationBatch.recommendations &&
  recommendationBatch.recommendations.length > 0 && (
    <Card className="p-4">
      <h4 className="text-sm font-semibold mb-2">
        AI Job Coach Guidance
      </h4>

      {recommendationBatch.ai_coach_summary && (
        <div className="mb-4 rounded-lg border bg-slate-50 p-3 text-sm text-slate-700 whitespace-pre-line">
          {typeof recommendationBatch.ai_coach_summary === "string"
            ? recommendationBatch.ai_coach_summary
            : recommendationBatch.ai_coach_summary?.narrative_explanation || ""}
        </div>
      )}

      <div className="space-y-2">
        {(() => {
          const recommended = recommendationBatch.recommendations
  .filter((r) => r.confidence_level !== "low")
  .sort((a, b) => (b.match_score || 0) - (a.match_score || 0));

          const notRecommended = recommendationBatch.recommendations.filter(
            (r) => r.confidence_level === "low"
          );

          const renderRecommendationCard = (rec, key, sectionType = "recommended") => (
            <div
  key={key}
  className={`border rounded p-3 space-y-2 ${
    rec.confidence_level === "high"
      ? "border-green-400 bg-green-50"
      : rec.confidence_level === "medium"
      ? "border-blue-300 bg-blue-50"
      : ""
  }`}
>
              <div className="font-medium text-sm">
                {rec.title || "Untitled Recommendation"}
              </div>

{rec.confidence_level === "high" && (
  <div className="text-[10px] font-semibold text-green-700">
    ⭐ Top Match
  </div>
)}

{rec.confidence_level === "medium" && (
  <div className="text-[10px] font-semibold text-blue-700">
    👍 Good Fit
  </div>
)}
              
              <div className="text-xs text-slate-500">
                {rec.onet_code || "No O*NET code"}
              </div>

              {(rec.match_score ?? rec.score ?? rec.fit_score) != null && (
                <div className="flex flex-wrap gap-2">
                  <div className="text-xs text-blue-600 font-medium">
                    Match Score: {rec.match_score ?? rec.score ?? rec.fit_score}
                  </div>

                  {rec.confidence_level && (
                    <div className="text-xs font-medium text-purple-700">
                      Confidence: {rec.confidence_level}
                    </div>
                  )}
                </div>
              )}

              {rec.confidence_reason && (
  <div
    className={
      rec.confidence_level === "high"
        ? "rounded-md border border-green-300 bg-green-50 px-2 py-1 text-[11px] font-medium text-green-800"
        : rec.confidence_level === "medium"
        ? "rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-800"
        : "rounded-md border border-red-300 bg-red-50 px-2 py-1 text-[11px] font-medium text-red-800"
    }
  >
    {rec.confidence_level === "low" ? "⚠️ " : ""}
    {rec.confidence_reason}
  </div>
)}

              {rec.matched_keywords?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {rec.matched_keywords.map((tag, idx) => (
                    <span
                      key={idx}
                      className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {rec.match_reason && (
                <div className="text-xs text-slate-600">
                  {rec.match_reason}
                </div>
              )}

              {rec.fit_strengths?.length > 0 && (
                <div className="space-y-1">
                  {rec.fit_strengths.map((item, idx) => (
                    <div
                      key={idx}
                      className="rounded-md border border-green-200 bg-green-50 px-2 py-1 text-[11px] text-green-800"
                    >
                      ✅ {item}
                    </div>
                  ))}
                </div>
              )}

                            {rec.not_fit_reasons?.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[11px] font-semibold text-amber-900">
                  {sectionType === "notRecommended"
  ? "Why this may NOT fit:"
  : "Client considerations:"}
                  </div>

                  {rec.not_fit_reasons.map((item, idx) => (
                    <div
                      key={idx}
                      className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-900"
                    >
                      ⚠️ {item}
                    </div>
                  ))}
                </div>
              )}

              {rec.fit_concerns?.length > 0 && (
                <div className="space-y-1">
                  {rec.fit_concerns.map((item, idx) => (
                    <div
                      key={idx}
                      className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-800"
                    >
                      ⚠️ {item}
                    </div>
                  ))}
                </div>
              )}

{rec.constraint_codes?.length > 0 && (
  <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-700">
    Client considerations: {rec.constraint_codes.join(", ")}
  </div>
)}
            </div>
          );

          return (
  <>
    {recommended.length > 0 && (
     <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-semibold text-green-800 mb-3">
  ✅ Recommended Jobs
</div>
    )}

<div className="space-y-3">
    
    {recommended.slice(0, 3).map((rec, i) =>
      renderRecommendationCard(rec, `recommended-${i}`)
    )}
</div>

{recommended.length > 3 && (
  <div className="mt-4">
    <div className="text-xs font-semibold text-slate-600 mb-2">
      Other Matches
    </div>

    <div className="space-y-3">
      {recommended.slice(3).map((rec, i) =>
        renderRecommendationCard(rec, `recommended-other-${i}`)
      )}
    </div>
  </div>
)}

{notRecommended.length > 0 && (
                <div className="mt-4">
                  <div className="rounded-lg border border-amber-200 bg-amber-200 px-3 py-2 text-sm font-semibold text-amber-800 mb-3">
  ⚠️ Not Recommended (Review Only)
</div>

                  <div className="space-y-3 border-2 border-amber-300 bg-red-25 rounded-lg p-3">
                    {notRecommended.map((rec, i) =>
                      renderRecommendationCard(rec, `not-${i}`, "notRecommended")
                    )}
                  </div>
                </div>
              )}
            </>
          );
        })()}
      </div>
    </Card>
  )}
          {jobs.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-800">
  {
    jobs.filter((job) => job.confidence_level !== "low").length
  }{" "}
  Recommended Jobs
</p>
                  {searchSummary && <p className="text-xs text-slate-500 mt-0.5">{searchSummary}</p>}
                  {groundingNote && (
                    <p className="text-xs text-violet-700 mt-1 bg-violet-50 border border-violet-100 rounded px-2 py-1">
                      <Info className="w-3 h-3 inline mr-1" />{groundingNote}
                    </p>
                  )}
                  {searchTermsUsed.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {searchTermsUsed.map((t, i) => (
                        <span key={i} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
                {!savedBatchId ? (
                  <Button
  size="sm"
  onClick={saveAllToClient}
  disabled={
    savingAll ||
    jobs.filter((job) => job.confidence_level !== "low").length === 0
  }
  className="h-8 text-xs shrink-0"
>
                    {savingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <BookmarkPlus className="w-3.5 h-3.5 mr-1" />}
                    Save All
                  </Button>
                ) : (
                  <Badge className="bg-green-100 text-green-700 border-0 text-xs">
                    <CheckCircle className="w-3 h-3 mr-1" /> Saved
                  </Badge>
                )}
              </div>

              <div className="space-y-3">
                {[...jobs].sort((a, b) => (b.fit_score || 0) - (a.fit_score || 0)).map((job, i) => (
                  <JobCard key={i} job={job} onStatusChange={handleStatusChange} isSaved={false} />
                ))}
              </div>

              {nextSteps.length > 0 && (
                <Card className="border-0 shadow-sm p-4 bg-blue-50/50">
                  <p className="text-xs font-semibold text-blue-800 mb-2 flex items-center gap-1.5">
                    <Lightbulb className="w-3.5 h-3.5" /> Suggested Next Steps
                  </p>
                  <ul className="space-y-1.5">
                    {nextSteps.map((s, i) => (
                      <li key={i} className="text-xs text-blue-700 flex gap-2">
                        <span className="shrink-0 font-medium">{i + 1}.</span>{s}
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'saved' && (
        <RecommendationBatchReview
          recs={
  recommendationBatch?.recommendations?.length
    ? recommendationBatch.recommendations.map((job, index) => ({
        id: `${recommendationBatch.id || "batch"}-${index}`,
        batch_id: recommendationBatch.id || "latest",
        client_id: resolvedClientId,

  
        status: job.status || (job.confidence_level === "low" ? "not_a_fit" : "suggested"),
        review_notes: job.review_notes || "",
        reviewed_by: job.reviewed_by || null,
        reviewed_at: job.reviewed_at || null,
                reviewed_by_staff: job.reviewed_by_staff || false,

        client_response: job.client_response || null,
        client_responded_at: job.client_responded_at || null,
        client_response_notes: job.client_response_notes || "",

        job_title: job.title || job.job_title || "Untitled Recommendation",
        employer: job.employer || "",
        location: job.location || "",

        match_score: job.match_score,
        fit_score: job.fit_score,
        match_reason: job.match_reason,

        fit_strengths: job.fit_strengths || [],
        fit_concerns: job.fit_concerns || [],
        not_fit_reasons: job.not_fit_reasons || [],
        constraint_codes: job.constraint_codes || [],

        confidence_level: job.confidence_level,
        confidence_reason: job.confidence_reason,

        source_job: job,
      }))
    : savedRecs
}          batches={
            recommendationBatch
              ? {
                  ...(savedBatches || {}),
                  [recommendationBatch.id || "latest"]: recommendationBatch,
                }
              : savedBatches
          }
          loading={loadingSaved}
          onRefresh={() => {
            loadSavedRecs();
            loadLatestBatch();
          }}
        />
      )}
    </div>
  );
}
