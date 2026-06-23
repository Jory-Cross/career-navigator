import React, { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

const CONSENSUS_STYLES = {
  "Strongly Supported": { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  "Emerging Support": { bg: "bg-lime-50", text: "text-lime-700", border: "border-lime-200" },
  "Mixed Feedback": { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  "Needs More Discovery": { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  "Weak Support": { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
  "No Feedback": { bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200" },
};

export default function VocationalThemeCandidateConsensus({
  client,
  candidate,
}) {
  const [consensus, setConsensus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!client?.id || !candidate?.themeName) return;

    const loadConsensus = async () => {
      setLoading(true);
      try {
        const result = await base44.functions.invoke("getVocationalThemeCandidateConsensus", {
          client_id: client.id,
          candidate_theme_name: candidate.themeName,
        });

        if (result?.data?.ok) {
          setConsensus(result.data);
        }
      } catch (error) {
        console.error("Failed to load consensus", error);
      } finally {
        setLoading(false);
      }
    };

    loadConsensus();
  }, [client?.id, candidate?.themeName]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-6">
        <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!consensus) return null;

  const style = CONSENSUS_STYLES[consensus.consensus_status] || CONSENSUS_STYLES["Mixed Feedback"];
  const reviewerCount = consensus.reviewer_count || 0;

  return (
    <div className="flex flex-col gap-1.5">
      {/* Consensus Badge */}
      <Badge
        className={`${style.bg} ${style.text} border ${style.border} text-xs font-medium px-2 py-0.5 w-fit`}
      >
        {consensus.consensus_status}
      </Badge>

      {/* Reviewer Count */}
      {reviewerCount > 0 && (
        <div className="text-xs text-slate-500">
          {reviewerCount} reviewer{reviewerCount !== 1 ? "s" : ""}
        </div>
      )}

      {/* Consensus Details Tooltip (Collapsed) */}
      {reviewerCount > 0 && (
        <div className="text-xs text-slate-600 flex gap-1 flex-wrap mt-1">
          {consensus.stats?.supported > 0 && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded border border-emerald-100">
              ✓ {consensus.stats.supported}
            </span>
          )}
          {consensus.stats?.needs_more_discovery > 0 && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded border border-amber-100">
              ⚠ {consensus.stats.needs_more_discovery}
            </span>
          )}
          {consensus.stats?.not_relevant > 0 && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-red-50 text-red-700 rounded border border-red-100">
              ✕ {consensus.stats.not_relevant}
            </span>
          )}
        </div>
      )}
    </div>
  );
}