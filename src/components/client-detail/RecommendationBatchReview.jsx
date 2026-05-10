import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Loader2, Search, Filter, AlertTriangle, CheckCircle,
  Calendar, User, ChevronDown, ChevronUp
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";
import RecommendationReviewCard from "./RecommendationReviewCard";

const STATUS_LABELS = {
  suggested: "Suggested",
  staff_reviewed: "Staff Reviewed",
  shared_with_client: "Shared with Client",
  client_interested: "Client Interested",
  client_not_interested: "Client Not Interested",
  job_search_target: "Job Search Target",
  not_a_fit: "Not a Fit",
  archived: "Archived"
};

const STATUS_COLORS = {
  suggested: "bg-slate-100 text-slate-700",
  staff_reviewed: "bg-blue-100 text-blue-700",
  shared_with_client: "bg-purple-100 text-purple-700",
  client_interested: "bg-green-100 text-green-700",
  client_not_interested: "bg-amber-100 text-amber-700",
  job_search_target: "bg-indigo-100 text-indigo-700",
  not_a_fit: "bg-red-100 text-red-700",
  archived: "bg-slate-200 text-slate-600"
};

function BatchHeader({ batch, recs }) {
  if (!batch) return null;

const statusCounts = {};
let needsReviewCount = 0;

recs.forEach(r => {
  statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;

  if (r.status === "suggested") {
    needsReviewCount += 1;
  }
});
  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <CardTitle className="text-base">{batch.search_summary}</CardTitle>
            {batch.grounding_note && (
              <p className="text-xs text-slate-600 mt-2">{batch.grounding_note}</p>
            )}
            <div className="flex items-center gap-3 mt-3 text-xs text-slate-500">
              <span>Generated {batch.generated_at ? format(new Date(batch.generated_at), 'MMM d, yyyy') : 'Unknown'}</span>
              {batch.generated_by && <span>by {batch.generated_by}</span>}
            </div>
          </div>
          <Badge className={cn("text-xs font-medium", 
            batch.status === 'fully_reviewed' ? 'bg-green-100 text-green-700' :
            batch.status === 'pending_review' ? 'bg-amber-100 text-amber-700' : 
            'bg-slate-100 text-slate-700'
          )}>
            {(batch.status || '').replace(/_/g, ' ')}
          </Badge>
        </div>
      </CardHeader>

      {batch.review_notes && (
        <CardContent className="pb-3">
          <p className="text-xs text-slate-600 bg-slate-50 rounded p-2">{batch.review_notes}</p>
        </CardContent>
      )}

      {Object.keys(statusCounts).length > 0 && (
        <CardContent className="pt-0">
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(statusCounts).map(([status, count]) => (
              <Badge key={status} variant="outline" className="text-[11px]">
                {STATUS_LABELS[status]}: <span className="font-bold ml-1">{count}</span>
              </Badge>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export default function RecommendationBatchReview({ 
  recs = [],
  batches = {},
  loading = false,
  onRefresh
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedBatches, setExpandedBatches] = useState({});
  
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-slate-400 animate-spin mr-2" />
        <p className="text-sm text-slate-500">Loading recommendations...</p>
      </div>
    );
  }

  if (recs.length === 0) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        <p className="text-sm text-slate-600 font-medium">No recommendations saved yet</p>
        <p className="text-xs text-slate-500">Run a job search to generate and save recommendations</p>
      </div>
    );
  }

  // Group recs by batch
const recsByBatch = {};
const batchOrder = [];
recs.forEach(rec => {
  const batchId = rec.batch_id || 'unbatched';
  if (!recsByBatch[batchId]) {
    recsByBatch[batchId] = [];
    batchOrder.push(batchId);
  }
  recsByBatch[batchId].push(rec);
});

  // Filter recs
  let filteredRecs = recs;
  if (statusFilter !== 'all') {
    filteredRecs = recs.filter(r => r.status === statusFilter);
  }
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filteredRecs = filteredRecs.filter(r =>
      r.job_title?.toLowerCase().includes(q) ||
      r.employer?.toLowerCase().includes(q) ||
      r.location?.toLowerCase().includes(q)
    );
  }

 // Count statuses
const statusCounts = {};
let needsReviewCount = 0;

recs.forEach(r => {
  statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;

  if (r.status === "suggested") {
    needsReviewCount += 1;
  }
});

  const toggleBatch = (batchId) => {
    setExpandedBatches(prev => ({
      ...prev,
      [batchId]: !prev[batchId]
    }));
  };

  const handleStatusChange = async (recId, newStatus) => {
  try {
    if (onRefresh) {
      await onRefresh();
    }

    // 🔥 FORCE immediate UI update (no waiting for polling)
    setTimeout(() => {
      if (onRefresh) {
        onRefresh();
      }
    }, 500);
  } catch (e) {
    console.error("Failed to refresh after status change", e);
  }
};

  return (
    <div className="space-y-4">
      {/* Header with filters */}
      <div className="space-y-3">

  {needsReviewCount > 0 && (
    <div className="rounded-lg border border-amber-300 bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-900">
      ⚠️ {needsReviewCount} recommendation{needsReviewCount !== 1 ? "s" : ""} pending staff review
    </div>
  )}
        <div className="flex items-center justify-between gap-2">
  
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search by job title, company, location..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 text-sm h-9"
              />
            </div>
          </div>
        </div>

        {/* Status filter tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          <Button
            size="sm"
            variant={statusFilter === 'all' ? 'default' : 'outline'}
            className="text-xs h-7 shrink-0"
            onClick={() => setStatusFilter('all')}
          >
            All ({recs.length})
          </Button>
          {Object.entries(statusCounts).map(([status, count]) => (
            <Button
              key={status}
              size="sm"
              variant={statusFilter === status ? 'default' : 'outline'}
              className={cn("text-xs h-7 shrink-0", statusFilter === status ? '' : STATUS_COLORS[status])}
              onClick={() => setStatusFilter(status)}
            >
              {STATUS_LABELS[status]} ({count})
            </Button>
          ))}
        </div>
      </div>

{/* Batches and recommendations */}
<div className="space-y-4">
  {batchOrder.map(batchId => {
    const batchRecs = recsByBatch[batchId].filter(r => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          r.job_title?.toLowerCase().includes(q) ||
          r.employer?.toLowerCase().includes(q) ||
          r.location?.toLowerCase().includes(q)
        );
      }
      return true;
    });

    if (batchRecs.length === 0) return null;

    const batch = batches[batchId];
    const isExpanded = expandedBatches[batchId] !== false;

    return (
      <div key={batchId}>
        {batchId !== 'unbatched' && batch && (
          <button
            onClick={() => toggleBatch(batchId)}
            className="w-full mb-2"
          >
            <BatchHeader batch={batch} recs={batchRecs} />
          </button>
        )}

        {isExpanded && (
          <div className="space-y-3">
            {batchRecs
              .sort((a, b) => {
                // Sort by priority level first
                const priorityOrder = { strong_target: 0, explore_further: 1, stretch: 2, caution: 3, low_priority: 4, unknown: 5 };
                const aPriority = priorityOrder[a.priority?.priority_level] ?? 5;
                const bPriority = priorityOrder[b.priority?.priority_level] ?? 5;
                if (aPriority !== bPriority) return aPriority - bPriority;
                // Then by match score descending
                return (b.match_score || 0) - (a.match_score || 0);
              })
              .map(rec => (
                <RecommendationReviewCard
                  key={rec.id}
                  recommendation={rec}
                  clientId={rec.client_id}
                  onStatusChange={handleStatusChange}
                  onRefresh={onRefresh}
                />
              ))}
          </div>
        )}
      </div>
    );
  })}
</div>
      {filteredRecs.length === 0 && (
        <div className="text-center py-8">
          <p className="text-sm text-slate-600">No recommendations match your filters</p>
        </div>
      )}
    </div>
  );
}