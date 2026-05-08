import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, ChevronDown, ChevronUp, CheckCheck } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { cn } from "@/lib/utils";

const AI_FIELDS = {
  ai_clarified_barriers: "Clarified Barrier Summary",
  ai_vocational_impact: "Vocational Impact Statement",
  ai_support_recommendations: "Possible Workplace Supports & Accommodations",
  ai_vfp_keywords: "Keywords for Vocational Profile",
};

export default function BarriersAIClarify({ answers, onAccept }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [expanded, setExpanded] = useState(false);

  // Collect all filled narrative fields from barriers section
  const buildContext = () => {
    const parts = [];
    if (answers.barriers_list) parts.push(`Known barriers: ${answers.barriers_list}`);
    if (answers.accommodations_needed) parts.push(`Accommodations needed: ${answers.accommodations_needed}`);
    if (answers.technology_barriers) parts.push(`Technology barriers: ${answers.technology_barriers}`);
    if (answers.communication_barriers) parts.push(`Communication barriers: ${answers.communication_barriers}`);
    if (answers.sensory_needs) parts.push(`Sensory/environmental needs: ${answers.sensory_needs}`);
    if (answers.support_notes) parts.push(`Additional support notes: ${answers.support_notes}`);
    if (answers.support_level) parts.push(`Support level needed: ${answers.support_level}`);
    if (answers.job_coach_needed) parts.push(`Job coaching needed: ${answers.job_coach_needed}`);
    return parts.join("\n");
  };

  const hasContent = () => {
    return ["barriers_list", "accommodations_needed", "technology_barriers", "communication_barriers", "sensory_needs", "support_notes"].some(
      (k) => answers[k] && answers[k].trim().length > 5
    );
  };

  // Pre-populate from existing AI fields if present
  const existingAI = [
    answers.ai_clarified_barriers,
    answers.ai_vocational_impact,
    answers.ai_support_recommendations,
    answers.ai_vfp_keywords,
  ].some(Boolean);

  const handleRun = async () => {
    setLoading(true);
    setResult(null);
    try {
      const context = buildContext();
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `You are an employment specialist assistant for a Vocational Rehabilitation (VR) agency.

You are reviewing barrier and support information that a client or staff member wrote during an intake interview.

Your job is to rewrite and organize this information into clear, professional vocational language — without diagnosing, without making assumptions, and without adding information that was not provided.

Use neutral, functional language focused on employment impact (NOT medical, NOT clinical).

Given this barrier/support information:
---
${context}
---

Return ONLY a JSON object with these four fields:

{
  "ai_clarified_barriers": "A clear 2-4 sentence plain-language summary of the functional employment barriers described.",
  "ai_vocational_impact": "A 1-3 sentence statement describing how these barriers may impact the client's ability to obtain or maintain employment. Focus on work tasks, environment, schedule, or social interaction — not diagnosis.",
  "ai_support_recommendations": "A bulleted list (using - ) of specific workplace supports or accommodations that may help address these barriers. Base this only on what was described.",
  "ai_vfp_keywords": "A comma-separated list of 5-12 concise keywords or tags useful for categorizing this client in a vocational profile (e.g. 'noise sensitivity, written instructions, flexible schedule, job coach, limited computer skills')"
}

Rules:
- Do NOT diagnose or speculate about diagnoses.
- Do NOT add information not present in the input.
- Do NOT use medical jargon.
- Keep language professional, clear, and employment-focused.
- If information is sparse, produce what you can based on what was given.`,
        response_json_schema: {
          type: "object",
          properties: {
            ai_clarified_barriers: { type: "string" },
            ai_vocational_impact: { type: "string" },
            ai_support_recommendations: { type: "string" },
            ai_vfp_keywords: { type: "string" },
          },
        },
      });
      setResult(res);
      setExpanded(true);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = () => {
    if (!result) return;
    onAccept({
      ai_clarified_barriers: result.ai_clarified_barriers || "",
      ai_vocational_impact: result.ai_vocational_impact || "",
      ai_support_recommendations: result.ai_support_recommendations || "",
      ai_vfp_keywords: result.ai_vfp_keywords || "",
    });
  };

  // Show current saved AI output if no fresh result
  const displayResult = result || (existingAI ? {
    ai_clarified_barriers: answers.ai_clarified_barriers,
    ai_vocational_impact: answers.ai_vocational_impact,
    ai_support_recommendations: answers.ai_support_recommendations,
    ai_vfp_keywords: answers.ai_vfp_keywords,
  } : null);

  return (
    <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50/60 p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-600" />
          <span className="text-sm font-semibold text-indigo-800">AI Rewrite for Vocational Profile</span>
          {existingAI && !result && (
            <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full">Previously generated</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {displayResult && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-xs text-indigo-600 flex items-center gap-1 hover:underline"
            >
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {expanded ? "Hide" : "Show"} results
            </button>
          )}
          <Button
            type="button"
            size="sm"
            onClick={handleRun}
            disabled={loading || !hasContent()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
          >
            {loading ? (
              <><Loader2 className="w-3 h-3 animate-spin mr-1" /> Rewriting...</>
            ) : (
              <><Sparkles className="w-3 h-3 mr-1" />{result || existingAI ? "Re-run AI" : "AI Clarify"}</>
            )}
          </Button>
        </div>
      </div>

      {!hasContent() && (
        <p className="text-xs text-indigo-500 italic">
          Fill in at least one barrier or support field above to enable AI rewrite.
        </p>
      )}

      {displayResult && expanded && (
        <div className="space-y-3 pt-1">
          {Object.entries(AI_FIELDS).map(([key, label]) => (
            displayResult[key] ? (
              <div key={key} className="space-y-1">
                <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">{label}</p>
                <div className="text-sm text-slate-700 bg-white rounded-lg border border-indigo-100 px-3 py-2 whitespace-pre-line leading-relaxed">
                  {displayResult[key]}
                </div>
              </div>
            ) : null
          ))}

          <div className="flex items-center gap-3 pt-1 border-t border-indigo-100">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleAccept}
              className={cn(
                "text-xs border-indigo-300 text-indigo-700 hover:bg-indigo-100",
                result ? "" : "opacity-60"
              )}
            >
              <CheckCheck className="w-3 h-3 mr-1" />
              {result ? "Save AI Output to Record" : "Re-run to update saved output"}
            </Button>
            <p className="text-xs text-slate-500">
              Original answers are never overwritten. AI output is saved separately.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}