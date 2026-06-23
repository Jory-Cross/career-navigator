import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2 } from "lucide-react";

export default function VocationalThemeCandidateGraphSummary({ client, candidate }) {
  const [graph, setGraph] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!client?.id || !candidate?.themeName) return;

    (async () => {
      try {
        setLoading(true);
        const res = await base44.functions.invoke('getVocationalThemeCandidateGraph', {
          client_id: client.id,
          candidate_theme_name: candidate.themeName
        });
        setGraph(res.data?.graph || null);
      } catch (err) {
        console.error('Error loading graph:', err);
        setGraph(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [client?.id, candidate?.themeName]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-2">
        <Loader2 className="h-3.5 w-3.5 text-slate-400 animate-spin" />
        <span className="text-xs text-slate-400 ml-1.5">Loading graph...</span>
      </div>
    );
  }

  if (!graph) {
    return (
      <div className="text-xs text-slate-400 italic py-1.5">
        No graph data available. Call rebuildVocationalThemeCandidateGraph to generate it.
      </div>
    );
  }

  return (
    <div className="py-1.5 space-y-1.5 text-xs">
      <div className="flex items-center justify-between px-2 py-1 bg-slate-50/50 rounded">
        <span className="text-slate-600">Supporting Evidence</span>
        <span className="font-semibold text-slate-800">{graph.supporting_evidence_count}</span>
      </div>
      <div className="flex items-center justify-between px-2 py-1 bg-slate-50/50 rounded">
        <span className="text-slate-600">Supporting Concepts</span>
        <span className="font-semibold text-slate-800">{graph.supporting_concept_count}</span>
      </div>
      <div className="flex items-center justify-between px-2 py-1 bg-slate-50/50 rounded">
        <span className="text-slate-600">Supporting Themes</span>
        <span className="font-semibold text-slate-800">{graph.supporting_theme_count}</span>
      </div>
      <div className="flex items-center justify-between px-2 py-1 bg-slate-50/50 rounded">
        <span className="text-slate-600">Supporting Sources</span>
        <span className="font-semibold text-slate-800">{graph.supporting_source_count}</span>
      </div>
      <div className="flex items-center justify-between px-2 py-1 bg-slate-50/50 rounded">
        <span className="text-slate-600">Feedback Records</span>
        <span className="font-semibold text-slate-800">{graph.feedback_count}</span>
      </div>
      {graph.consensus_status && (
        <div className="flex items-center justify-between px-2 py-1 bg-violet-50 rounded border border-violet-100">
          <span className="text-slate-600">Consensus Status</span>
          <span className="font-semibold text-violet-700">{graph.consensus_status}</span>
        </div>
      )}
      {graph.last_rebuilt_date && (
        <div className="text-xs text-slate-400 italic text-right pt-1">
          Rebuilt {new Date(graph.last_rebuilt_date).toLocaleDateString()}
        </div>
      )}
    </div>
  );
}