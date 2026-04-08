import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle, XCircle, Share2, Briefcase, Loader2, ChevronDown,
  ChevronUp, ExternalLink, RefreshCw, AlertTriangle, Clock, User
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";

const STATUS_CONFIG = {
  suggested:          { label: "Pending Review",    color: "bg-amber-50 text-amber-700 border-amber-200",    dot: "bg-amber-400" },
  staff_reviewed:     { label: "Reviewed",           color: "bg-blue-50 text-blue-700 border-blue-200",       dot: "bg-blue-500" },
  shared_with_client: { label: "Shared",             color: "bg-violet-50 text-violet-700 border-violet-200", dot: "bg-violet-500" },
  applied:            { label: "Applied",            color: "bg-green-50 text-green-700 border-green-200",    dot: "bg-green-500" },
  interview:          { label: "Interview",          color: "bg-teal-50 text-teal-700 border-teal-200",       dot: "bg-teal-500" },
  closed_not_fit:     { label: "Not a Fit",          color: "bg-slate-100 text-slate-600 border-slate-200",   dot: "bg-slate-400" },
  closed_declined:    { label: "Declined",           color: "bg-red-50 text-red-600 border-red-200",          dot: "bg-red-400" },
  hired:              { label: "Hired! 🎉",           color: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
};

// ─── Single recommendation card with review actions ───────────────────────────

function RecommendationCard({ rec, onReviewed }) {
  const [expanded, setExpanded] = useState(false);
  const [reviewNotes, setReviewNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [acting, setActing] = useState(false);

  const status = STATUS_CONFIG[rec.status] || STATUS_CONFIG.suggested;
  const needsReview = rec.status === "suggested";

  const act = async (nextStatus) => {
    setActing(true);
    try {
      await base44.functions.invoke("jobSearchAssistant", {
        action: "review_recommendation",
        recommendationId: rec.id,
        status: nextStatus,
        review_notes: reviewNotes || undefined,
      });
      toast.success(STATUS_CONFIG[nextStatus]?.label || nextStatus);
      setShowNotes(false);
      setReviewNotes("");
      onReviewed?.();
    } catch (e) {
      toast.error("Action failed: " + e.message);
    } finally {
      setActing(false);
    }
  };

  return (
    <Card className={cn(
      "border overflow-hidden transition-all",
      needsReview ? "border-amber-200 shadow-md" : "border-slate-200 shadow-sm"
    )}>
      {/* Header row */}
      <div className="flex items-start gap-3 p-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 flex-wrap">
            <span className="font-semibold text-sm text-slate-900 leading-tight">{rec.job_title}</span>
            {rec.fit_score > 0 && (
              <span className={cn(
                "text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0",
                rec.fit_score >= 80 ? "bg-green-50 text-green-700 border-green-200" :
                rec.fit_score >= 60 ? "bg-amber-50 text-amber-700 border-amber-200" :
                "bg-slate-50 text-slate-600 border-slate-200"
              )}>
                {rec.fit_score}% fit
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {rec.employer}{rec.location ? ` · ${rec.location}` : ""}
            {rec.pay ? ` · ${rec.pay}` : ""}
          </p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full border", status.color)}>
              <span className={cn("inline-block w-1.5 h-1.5 rounded-full mr-1.5", status.dot)} />
              {status.label}
            </span>
            {rec.reviewed_by && (
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                <User className="w-2.5 h-2.5" />
                {rec.reviewed_by.split("@")[0]}
              </span>
            )}
            {rec.reviewed_at && (
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" />
                {format(new Date(rec.reviewed_at), "MMM d")}
              </span>
            )}
            {rec.generated_by_ai && (
              <span className="text-[10px] bg-violet-50 text-violet-600 border border-violet-100 px-1.5 py-0.5 rounded-full">AI</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {rec.source_url && (
            <a href={rec.source_url} target="_blank" rel="noopener noreferrer"
              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
              title="View job posting">
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          <button onClick={() => setExpanded(e => !e)}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded transition-colors">
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-3 border-t border-slate-100 pt-3 space-y-2">
          {rec.fit_reason && (
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Why it fits</p>
              <p className="text-xs text-slate-700 leading-relaxed">{rec.fit_reason}</p>
            </div>
          )}
          {rec.concerns && (
            <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide mb-1">Concerns</p>
              <p className="text-xs text-amber-800">{rec.concerns}</p>
            </div>
          )}
          {rec.support_strategy && (
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Support Strategy</p>
              <p className="text-xs text-slate-600">{rec.support_strategy}</p>
            </div>
          )}
          {rec.review_notes && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Staff Notes</p>
              <p className="text-xs text-slate-700 italic">"{rec.review_notes}"</p>
            </div>
          )}
          {rec.search_terms_used?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {rec.search_terms_used.map((t, i) => (
                <span key={i} className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{t}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Review notes input */}
      {showNotes && (
        <div className="px-4 pb-3 border-t border-slate-100 pt-3">
          <Textarea
            value={reviewNotes}
            onChange={e => setReviewNotes(e.target.value)}
            placeholder="Add optional review notes..."
            className="text-xs min-h-[60px] resize-none"
          />
        </div>
      )}

      {/* Action bar */}
      <div className="flex items-center gap-1.5 px-4 pb-3 flex-wrap">
        {needsReview && (
          <>
            <Button size="sm" variant="outline"
              className="h-7 text-xs border-green-200 text-green-700 hover:bg-green-50"
              onClick={() => act("staff_reviewed")} disabled={acting}>
              {acting ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
              Approve
            </Button>
            <Button size="sm" variant="outline"
              className="h-7 text-xs border-violet-200 text-violet-700 hover:bg-violet-50"
              onClick={() => act("shared_with_client")} disabled={acting}>
              {acting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Share2 className="w-3 h-3" />}
              Share with Client
            </Button>
            <Button size="sm" variant="outline"
              className="h-7 text-xs border-red-200 text-red-600 hover:bg-red-50"
              onClick={() => act("closed_not_fit")} disabled={acting}>
              {acting ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
              Not a Fit
            </Button>
            <button
              onClick={() => setShowNotes(n => !n)}
              className="text-[10px] text-slate-400 hover:text-slate-600 underline ml-auto">
              {showNotes ? "Hide notes" : "+ Add notes"}
            </button>
          </>
        )}

        {rec.status === "staff_reviewed" && (
          <Button size="sm" variant="outline"
            className="h-7 text-xs border-violet-200 text-violet-700 hover:bg-violet-50"
            onClick={() => act("shared_with_client")} disabled={acting}>
            <Share2 className="w-3 h-3" />
            Share with Client
          </Button>
        )}

        {rec.status === "shared_with_client" && (
          <Button size="sm" variant="outline"
            className="h-7 text-xs border-green-200 text-green-700 hover:bg-green-50"
            onClick={() => act("applied")} disabled={acting}>
            <CheckCircle className="w-3 h-3" />
            Mark Applied
          </Button>
        )}

        {rec.status === "applied" && (
          <>
            <Button size="sm" variant="outline"
              className="h-7 text-xs border-teal-200 text-teal-700 hover:bg-teal-50"
              onClick={() => act("interview")} disabled={acting}>
              Interview
            </Button>
            <Button size="sm" variant="outline"
              className="h-7 text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50"
              onClick={() => act("hired")} disabled={acting}>
              Hired 🎉
            </Button>
          </>
        )}

        {rec.status === "interview" && (
          <Button size="sm" variant="outline"
            className="h-7 text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50"
            onClick={() => act("hired")} disabled={acting}>
            Hired 🎉
          </Button>
        )}
      </div>
    </Card>
  );
}

// ─── Batch group header ───────────────────────────────────────────────────────

function BatchGroup({ batch, recs, onReviewed }) {
  const [open, setOpen] = useState(true);
  const pending = recs.filter(r => r.status === "suggested").length;
  const batchDate = batch.created_at
    ? format(new Date(batch.created_at), "MMM d, yyyy · h:mm a")
    : "Unknown date";

  return (
    <div className="space-y-2">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
      >
        <div className="flex items-center gap-2 flex-wrap text-left">
          <span className="text-xs font-semibold text-slate-700">Batch: {batchDate}</span>
          {batch.filters?.workType && batch.filters.workType !== "any" && (
            <span className="text-[10px] bg-blue-50 text-blue-600 border border-blue-100 px-1.5 py-0.5 rounded-full">
              {batch.filters.workType}
            </span>
          )}
          {batch.filters?.employmentType && batch.filters.employmentType !== "any" && (
            <span className="text-[10px] bg-blue-50 text-blue-600 border border-blue-100 px-1.5 py-0.5 rounded-full">
              {batch.filters.employmentType}
            </span>
          )}
          {batch.has_vocational_facts && (
            <span className="text-[10px] bg-green-50 text-green-600 border border-green-100 px-1.5 py-0.5 rounded-full">
              VFP grounded
            </span>
          )}
          <span className="text-[10px] text-slate-500">{recs.length} jobs</span>
          {pending > 0 && (
            <span className="text-[10px] bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full font-medium flex items-center gap-1">
              <AlertTriangle className="w-2.5 h-2.5" /> {pending} pending review
            </span>
          )}
        </div>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-slate-400 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
      </button>

      {open && (
        <div className="space-y-2 pl-1">
          {recs.map(r => (
            <RecommendationCard key={r.id} rec={r} onReviewed={onReviewed} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function RecommendationBatchReview({ recs, batches, loading, onRefresh }) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-400 py-8 justify-center text-sm">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading recommendations...
      </div>
    );
  }

  if (recs.length === 0) {
    return (
      <Card className="border-0 shadow-sm p-8 text-center">
        <Briefcase className="w-8 h-8 text-slate-300 mx-auto mb-3" />
        <p className="text-sm text-slate-400">No saved recommendations yet.</p>
        <p className="text-xs text-slate-400 mt-1">Use the Search tab to find and save jobs.</p>
      </Card>
    );
  }

  // Group recs by batch_id (or source_search_batch_id)
  const byBatch = {};
  recs.forEach(r => {
    const key = r.source_search_batch_id || r.batch_id || "ungrouped";
    if (!byBatch[key]) byBatch[key] = [];
    byBatch[key].push(r);
  });

  // Sort within each batch: pending first, then by fit_score desc
  const ORDER = { suggested: 0, staff_reviewed: 1, shared_with_client: 2, applied: 3, interview: 4, hired: 5, closed_not_fit: 6, closed_declined: 7 };
  Object.keys(byBatch).forEach(k => {
    byBatch[k].sort((a, b) =>
      (ORDER[a.status] ?? 5) - (ORDER[b.status] ?? 5) || (b.fit_score || 0) - (a.fit_score || 0)
    );
  });

  // Sort batches newest first
  const batchKeys = Object.keys(byBatch).sort((a, b) => {
    const batchA = batches[a];
    const batchB = batches[b];
    const dateA = batchA?.created_at || "";
    const dateB = batchB?.created_at || "";
    return dateB.localeCompare(dateA);
  });

  const totalPending = recs.filter(r => r.status === "suggested").length;

  return (
    <div className="space-y-3">
      {/* Summary row */}
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {Object.entries(
            recs.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {})
          ).map(([status, count]) => {
            const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.suggested;
            return (
              <span key={status} className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full border", cfg.color)}>
                {cfg.label}: {count}
              </span>
            );
          })}
        </div>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onRefresh}>
          <RefreshCw className="w-3 h-3 mr-1" /> Refresh
        </Button>
      </div>

      {totalPending > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          {totalPending} recommendation{totalPending !== 1 ? "s" : ""} pending staff review
        </div>
      )}

      {batchKeys.map(key => (
        <BatchGroup
          key={key}
          batch={batches[key] || { created_at: null }}
          recs={byBatch[key]}
          onReviewed={onRefresh}
        />
      ))}
    </div>
  );
}