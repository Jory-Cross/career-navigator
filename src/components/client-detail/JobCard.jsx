import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ExternalLink, Copy, Check, ChevronDown, ChevronUp,
  AlertTriangle, Lightbulb, Star, Send, CheckCircle, X, BookmarkPlus, Info
} from "lucide-react";
import { cn } from "@/lib/utils";

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

export default function JobCard({ job, onStatusChange, isSaved }) {
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

  // Parse cited_factors out of fit_reason if stored combined
  const citedFactors = job.cited_factors || [];
  const hasReviewFlag = job.requires_staff_review;
  const constraintViolations = job.constraint_violations || [];

  return (
    <div className={cn(
      "border rounded-xl bg-white overflow-hidden transition-all",
      hasReviewFlag ? "border-amber-300" :
      job.status === 'applied' ? "border-green-200" :
      job.status === 'rejected' ? "border-red-100 opacity-60" :
      job.status === 'saved' ? "border-blue-200" : "border-slate-200"
    )}>
      {/* Review flag banner */}
      {hasReviewFlag && job.review_reason && (
        <div className="bg-amber-50 border-b border-amber-200 px-3 py-1.5 flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <p className="text-xs text-amber-800 font-medium">Staff Review Needed: {job.review_reason}</p>
        </div>
      )}

      {/* Constraint violations */}
      {constraintViolations.length > 0 && (
        <div className="bg-red-50 border-b border-red-100 px-3 py-1.5">
          <p className="text-[11px] text-red-700 font-medium">
            ⚠️ Possible constraint conflicts: {constraintViolations.join(' · ')}
          </p>
        </div>
      )}

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

        {/* Fit reason */}
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
                <Button size="sm" variant="outline"
                  className="h-7 text-xs px-2.5 border-green-300 text-green-700 hover:bg-green-50"
                  onClick={() => handleStatus('applied')} disabled={updatingStatus}>
                  <CheckCircle className="w-3 h-3 mr-1" /> Mark Applied
                </Button>
              )}
              {job.status !== 'rejected' && (
                <Button size="sm" variant="outline"
                  className="h-7 text-xs px-2.5 border-red-200 text-red-500 hover:bg-red-50"
                  onClick={() => handleStatus('rejected')} disabled={updatingStatus}>
                  <X className="w-3 h-3 mr-1" /> Not a Fit
                </Button>
              )}
            </>
          ) : (
            <Button size="sm" variant="outline"
              className="h-7 text-xs px-2.5 border-blue-300 text-blue-700 hover:bg-blue-50"
              onClick={() => handleStatus('save')} disabled={updatingStatus}>
              <BookmarkPlus className="w-3 h-3 mr-1" /> Save
            </Button>
          )}
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/60 p-4 space-y-3">
          {/* Cited factors */}
          {citedFactors.length > 0 && (
            <div className="flex gap-2">
              <Info className="w-3.5 h-3.5 text-violet-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-violet-700 mb-1.5">Client Factors That Influenced This Match</p>
                <div className="space-y-1">
                  {citedFactors.map((cf, i) => (
                    <div key={i} className="text-xs bg-violet-50 border border-violet-100 rounded px-2 py-1">
                      <span className="font-medium text-violet-800">{cf.factor}</span>
                      {cf.source && <span className="text-violet-600 ml-1">[{cf.source}]</span>}
                      {cf.relevance && <span className="text-slate-600 ml-1">— {cf.relevance}</span>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

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