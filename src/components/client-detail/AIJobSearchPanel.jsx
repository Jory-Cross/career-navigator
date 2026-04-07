import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Sparkles, Briefcase, ExternalLink, Loader2, CheckCircle, BookmarkPlus,
  X, ChevronDown, ChevronUp, AlertTriangle, Lightbulb, Star,
  RefreshCw, Send, History, Search, Copy, Check
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const STATUS_COLORS = {
  suggested: "bg-slate-100 text-slate-600 border-slate-200",
  saved: "bg-blue-100 text-blue-700 border-blue-200",
  applied: "bg-green-100 text-green-700 border-green-200",
  rejected: "bg-red-100 text-red-600 border-red-200",
};

const STATUS_LABELS = {
  suggested: "Suggested",
  saved: "Saved",
  applied: "Applied",
  rejected: "Not a Fit",
};

function FitScoreBadge({ score }) {
  const color = score >= 80 ? "bg-green-100 text-green-800"
    : score >= 60 ? "bg-amber-100 text-amber-800"
    : "bg-slate-100 text-slate-600";
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full", color)}>
      <Star className="w-3 h-3" /> {score}% fit
    </span>
  );
}

function JobCard({ job, onStatusChange, isSaved }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const copyLink = () => {
    if (job.source_url) {
      navigator.clipboard.writeText(job.source_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleStatus = async (status) => {
    setUpdatingStatus(true);
    await onStatusChange(job, status);
    setUpdatingStatus(false);
  };

  return (
    <div className={cn(
      "border rounded-xl bg-white overflow-hidden transition-all",
      job.status === 'applied' ? "border-green-200" :
      job.status === 'rejected' ? "border-red-100 opacity-60" :
      job.status === 'saved' ? "border-blue-200" : "border-slate-200"
    )}>
      {/* Card header */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-semibold text-slate-900 text-sm">{job.job_title}</h4>
              {job.fit_score > 0 && <FitScoreBadge score={job.fit_score} />}
              {isSaved && job.status && (
                <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full border", STATUS_COLORS[job.status])}>
                  {STATUS_LABELS[job.status]}
                </span>
              )}
            </div>
            <p className="text-sm text-slate-600 mt-0.5">{job.employer}</p>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {job.location && <span className="text-xs text-slate-500">📍 {job.location}</span>}
              {job.pay && <span className="text-xs text-slate-500">💰 {job.pay}</span>}
              {job.schedule && <span className="text-xs text-slate-500">🕐 {job.schedule}</span>}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {job.source_url && (
              <a href={job.source_url} target="_blank" rel="noopener noreferrer"
                className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors" title="Open job posting">
                <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
              </a>
            )}
            {job.source_url && (
              <button onClick={copyLink} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors" title="Copy link">
                {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
              </button>
            )}
            <button onClick={() => setExpanded(e => !e)}
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400">
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Fit reason preview */}
        {job.fit_reason && (
          <p className="text-xs text-slate-600 mt-2 bg-green-50 border border-green-100 rounded-lg px-3 py-2 leading-relaxed">
            <span className="font-medium text-green-800">Why it fits: </span>{job.fit_reason}
          </p>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {job.source_url && (
            <a href={job.source_url} target="_blank" rel="noopener noreferrer">
              <Button size="sm" className="h-7 text-xs px-2.5">
                <Send className="w-3 h-3 mr-1" /> Apply Now
              </Button>
            </a>
          )}
          {isSaved ? (
            <>
              {job.status !== 'applied' && (
                <Button size="sm" variant="outline" className="h-7 text-xs px-2.5 border-green-300 text-green-700 hover:bg-green-50"
                  onClick={() => handleStatus('applied')} disabled={updatingStatus}>
                  <CheckCircle className="w-3 h-3 mr-1" /> Mark Applied
                </Button>
              )}
              {job.status !== 'rejected' && (
                <Button size="sm" variant="outline" className="h-7 text-xs px-2.5 border-red-200 text-red-500 hover:bg-red-50"
                  onClick={() => handleStatus('rejected')} disabled={updatingStatus}>
                  <X className="w-3 h-3 mr-1" /> Not a Fit
                </Button>
              )}
            </>
          ) : (
            <Button size="sm" variant="outline" className="h-7 text-xs px-2.5 border-blue-300 text-blue-700 hover:bg-blue-50"
              onClick={() => handleStatus('save')}>
              <BookmarkPlus className="w-3 h-3 mr-1" /> Save
            </Button>
          )}
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/60 p-4 space-y-3">
          {job.concerns && (
            <div className="flex gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-amber-700 mb-0.5">Potential Concerns</p>
                <p className="text-xs text-slate-600">{job.concerns}</p>
              </div>
            </div>
          )}
          {job.support_strategy && (
            <div className="flex gap-2">
              <Lightbulb className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-blue-700 mb-0.5">Support Strategy</p>
                <p className="text-xs text-slate-600">{job.support_strategy}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function VocationalProfile({ profile }) {
  const sections = [
    { key: 'strengths', label: '💪 Strengths', color: 'text-green-700' },
    { key: 'barriers', label: '⚠️ Barriers', color: 'text-amber-700' },
    { key: 'support_needs', label: '🤝 Support Needs', color: 'text-blue-700' },
    { key: 'work_environment_preferences', label: '🏢 Environment Preferences', color: 'text-purple-700' },
    { key: 'suggested_job_targets', label: '🎯 Suggested Job Targets', color: 'text-slate-700' },
  ];
  return (
    <div className="space-y-4">
      {profile.summary && (
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
          <p className="text-sm text-slate-700 leading-relaxed">{profile.summary}</p>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {sections.map(s => profile[s.key]?.length > 0 && (
          <div key={s.key} className="p-3 bg-white rounded-lg border border-slate-100">
            <p className={cn("text-xs font-semibold mb-1.5", s.color)}>{s.label}</p>
            <ul className="space-y-1">
              {profile[s.key].map((item, i) => (
                <li key={i} className="text-xs text-slate-600 flex gap-1.5">
                  <span className="shrink-0 mt-0.5">•</span>{item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {profile.benefits_considerations && (
        <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg text-xs text-amber-800">
          <span className="font-semibold">Benefits Considerations: </span>{profile.benefits_considerations}
        </div>
      )}
      {profile.missing_information?.length > 0 && (
        <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
          <p className="text-xs font-semibold text-blue-800 mb-1">Missing Information (to improve recommendations):</p>
          <ul className="space-y-0.5">
            {profile.missing_information.map((m, i) => (
              <li key={i} className="text-xs text-blue-700 flex gap-1.5"><span>•</span>{m}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function AIJobSearchPanel({ clientId, client }) {
  const [tab, setTab] = useState('search'); // 'search' | 'saved'
  const [step, setStep] = useState('idle'); // 'idle' | 'profiling' | 'searching' | 'done'
  const [profile, setProfile] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [savedRecs, setSavedRecs] = useState([]);
  const [searchSummary, setSearchSummary] = useState('');
  const [customInstructions, setCustomInstructions] = useState('');
  const [assessmentsUsed, setAssessmentsUsed] = useState([]);
  const [clientFieldsUsed, setClientFieldsUsed] = useState([]);
  const [searchTermsUsed, setSearchTermsUsed] = useState([]);
  const [nextSteps, setNextSteps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingAll, setSavingAll] = useState(false);
  const [savedBatchId, setSavedBatchId] = useState(null);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  useEffect(() => {
    loadSavedRecs();
  }, [clientId]);

  const loadSavedRecs = async () => {
    setLoadingSaved(true);
    try {
      const res = await base44.functions.invoke('jobSearchAssistant', {
        action: 'get_saved_recommendations',
        clientId,
      });
      setSavedRecs(res?.data?.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSaved(false);
    }
  };

  const runSearch = async () => {
    setLoading(true);
    setJobs([]);
    setProfile(null);
    setSavedBatchId(null);
    setStep('profiling');

    try {
      // Step 1: Build vocational profile
      const profileRes = await base44.functions.invoke('jobSearchAssistant', {
        action: 'generate_vocational_profile',
        clientId,
      });
      const profileData = profileRes?.data?.data;
      setProfile(profileData);
      setAssessmentsUsed(profileRes?.data?.assessments_used || []);
      setClientFieldsUsed(profileRes?.data?.client_fields_used || []);

      // Step 2: Find jobs using profile
      setStep('searching');
      const jobRes = await base44.functions.invoke('jobSearchAssistant', {
        action: 'find_jobs',
        clientId,
        profile: profileData,
        customInstructions,
      });
      const jobData = jobRes?.data?.data;
      setJobs(jobData?.jobs || []);
      setSearchSummary(jobData?.search_summary || '');
      setNextSteps(jobData?.next_steps || []);
      setSearchTermsUsed(jobData?.search_terms_used || []);
      setStep('done');
    } catch (e) {
      toast.error('Search failed: ' + (e?.response?.data?.error || e.message));
      setStep('idle');
    } finally {
      setLoading(false);
    }
  };

  const saveAllToClient = async () => {
    if (!jobs.length) return;
    setSavingAll(true);
    try {
      const res = await base44.functions.invoke('jobSearchAssistant', {
        action: 'save_recommendations',
        clientId,
        jobs,
        assessmentsUsed,
        clientFieldsUsed,
        searchTermsUsed,
      });
      setSavedBatchId(res?.data?.batch_id);
      toast.success(`${jobs.length} recommendations saved to client record`);
      await loadSavedRecs();
      setTab('saved');
    } catch (e) {
      toast.error('Failed to save: ' + e.message);
    } finally {
      setSavingAll(false);
    }
  };

  const handleStatusChange = async (job, status) => {
    if (status === 'save') {
      // Save single job
      try {
        await base44.functions.invoke('jobSearchAssistant', {
          action: 'save_recommendations',
          clientId,
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
    // Update status of saved rec
    try {
      const rec = savedRecs.find(r =>
        r.job_title === job.job_title && r.employer === job.employer
      ) || job;
      await base44.functions.invoke('jobSearchAssistant', {
        action: 'update_recommendation_status',
        clientId,
        recommendationId: rec.id || job.id,
        status,
      });
      await loadSavedRecs();
      toast.success(`Marked as ${STATUS_LABELS[status]}`);
    } catch (e) {
      toast.error('Failed to update status');
    }
  };

  // Sort saved recs: applied > saved > suggested > rejected
  const ORDER = { applied: 0, saved: 1, suggested: 2, rejected: 3 };
  const sortedSavedRecs = [...savedRecs].sort((a, b) => (ORDER[a.status] ?? 2) - (ORDER[b.status] ?? 2));

  const statusCounts = savedRecs.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            AI Job Search Assistant
          </h3>
          <p className="text-xs text-slate-500 mt-0.5 ml-9">
            Personalized job recommendations for {client?.first_name}
          </p>
        </div>
        <div className="flex gap-1.5">
          <Button size="sm" variant={tab === 'search' ? 'default' : 'outline'}
            className="h-8 text-xs" onClick={() => setTab('search')}>
            <Search className="w-3.5 h-3.5 mr-1" /> Search
          </Button>
          <Button size="sm" variant={tab === 'saved' ? 'default' : 'outline'}
            className="h-8 text-xs" onClick={() => setTab('saved')}>
            <History className="w-3.5 h-3.5 mr-1" /> Saved
            {savedRecs.length > 0 && (
              <span className="ml-1 bg-white/20 rounded-full px-1.5 text-[10px]">{savedRecs.length}</span>
            )}
          </Button>
        </div>
      </div>

      {/* SEARCH TAB */}
      {tab === 'search' && (
        <div className="space-y-4">
          {/* Custom instructions */}
          <Card className="border-0 shadow-sm p-4 space-y-3">
            <Label className="text-xs text-slate-500 block">Additional instructions for the AI (optional)</Label>
            <Textarea
              placeholder={`e.g. "Focus on part-time jobs near downtown. Avoid loud environments. Consider jobs with flexible start times."`}
              value={customInstructions}
              onChange={e => setCustomInstructions(e.target.value)}
              className="text-sm min-h-[70px] resize-none"
            />
            <Button
              className="w-full"
              onClick={runSearch}
              disabled={loading}
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {step === 'profiling' ? 'Building vocational profile...' : 'Searching live jobs...'}
                </>
              ) : (
                <><Sparkles className="w-4 h-4 mr-2" />
                  {step === 'done' ? 'Search Again' : 'Find Jobs for This Client'}
                </>
              )}
            </Button>
          </Card>

          {/* Vocational profile result */}
          {profile && (
            <Card className="border-0 shadow-sm">
              <button
                onClick={() => setShowProfile(p => !p)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors rounded-xl"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-800">Vocational Profile</span>
                  {assessmentsUsed.length > 0 && (
                    <Badge className="text-[10px] bg-purple-100 text-purple-700 border-0">
                      {assessmentsUsed.length} assessment{assessmentsUsed.length !== 1 ? 's' : ''} used
                    </Badge>
                  )}
                </div>
                {showProfile ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>
              {showProfile && (
                <div className="px-4 pb-4">
                  <VocationalProfile profile={profile} />
                </div>
              )}
            </Card>
          )}

          {/* Search results */}
          {jobs.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{jobs.length} Job Recommendations</p>
                  {searchSummary && (
                    <p className="text-xs text-slate-500 mt-0.5">{searchSummary}</p>
                  )}
                  {searchTermsUsed.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {searchTermsUsed.map((t, i) => (
                        <span key={i} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
                {!savedBatchId && (
                  <Button size="sm" onClick={saveAllToClient} disabled={savingAll} className="h-8 text-xs">
                    {savingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <BookmarkPlus className="w-3.5 h-3.5 mr-1" />}
                    Save All to Record
                  </Button>
                )}
                {savedBatchId && (
                  <Badge className="bg-green-100 text-green-700 border-0 text-xs">
                    <CheckCircle className="w-3 h-3 mr-1" /> Saved to record
                  </Badge>
                )}
              </div>

              <div className="space-y-3">
                {jobs.sort((a, b) => (b.fit_score || 0) - (a.fit_score || 0)).map((job, i) => (
                  <JobCard
                    key={i}
                    job={job}
                    onStatusChange={handleStatusChange}
                    isSaved={false}
                  />
                ))}
              </div>

              {nextSteps.length > 0 && (
                <Card className="border-0 shadow-sm p-4 bg-blue-50/50">
                  <p className="text-xs font-semibold text-blue-800 mb-2 flex items-center gap-1.5">
                    <Lightbulb className="w-3.5 h-3.5" /> Suggested Next Steps
                  </p>
                  <ul className="space-y-1.5">
                    {nextSteps.map((step, i) => (
                      <li key={i} className="text-xs text-blue-700 flex gap-2">
                        <span className="shrink-0 font-medium">{i + 1}.</span>{step}
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </div>
          )}
        </div>
      )}

      {/* SAVED TAB */}
      {tab === 'saved' && (
        <div className="space-y-3">
          {/* Status summary */}
          {savedRecs.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {Object.entries(statusCounts).map(([status, count]) => (
                <span key={status} className={cn("text-xs font-medium px-2.5 py-1 rounded-full border", STATUS_COLORS[status])}>
                  {STATUS_LABELS[status]}: {count}
                </span>
              ))}
            </div>
          )}

          {loadingSaved ? (
            <div className="flex items-center gap-2 text-slate-400 py-6 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading saved recommendations...
            </div>
          ) : sortedSavedRecs.length === 0 ? (
            <Card className="border-0 shadow-sm p-8 text-center">
              <Briefcase className="w-8 h-8 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-400">No saved recommendations yet.</p>
              <p className="text-xs text-slate-400 mt-1">Use the Search tab to find and save jobs.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {sortedSavedRecs.map((rec, i) => (
                <JobCard
                  key={rec.id || i}
                  job={rec}
                  onStatusChange={handleStatusChange}
                  isSaved={true}
                />
              ))}
              <Button size="sm" variant="outline" className="w-full text-xs h-8" onClick={loadSavedRecs}>
                <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}