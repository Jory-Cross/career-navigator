import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, RefreshCw, Briefcase, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "react-hot-toast";

const TYPE_LABELS = {
  career_goals: "Career Goals",
  skills_audit: "Skills Audit",
  job_search_readiness: "Job Search Readiness",
  interview_readiness: "Interview Readiness",
};

export default function AssessmentRecommendations({ assessment, onUpdate }) {
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const existing = assessment.responses?.ai_recommendations;

  const generate = async () => {
    setLoading(true);
    try {
      const responsesSummary = Object.entries(assessment.responses || {})
        .filter(([k]) => k !== "ai_recommendations")
        .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`)
        .join("\n");

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a career counselor assistant. Based on the following ${TYPE_LABELS[assessment.assessment_type]} assessment responses, provide actionable recommendations.

Assessment Responses:
${responsesSummary}

Provide a structured response with:
1. 3-5 specific action steps the client should take
2. 3-5 job titles that would be a good fit based on their profile
3. A brief overall summary (2-3 sentences)`,
        response_json_schema: {
          type: "object",
          properties: {
            summary: { type: "string" },
            action_steps: { type: "array", items: { type: "string" } },
            recommended_job_titles: { type: "array", items: { type: "string" } }
          }
        }
      });

      await base44.entities.Assessment.update(assessment.id, {
        responses: { ...assessment.responses, ai_recommendations: result }
      });

      toast.success("AI recommendations generated!");
      setExpanded(true);
      onUpdate();
    } catch (e) {
      toast.error("Failed to generate recommendations");
    } finally {
      setLoading(false);
    }
  };

  if (!existing) {
    return (
      <Button size="sm" variant="outline" className="mt-2 text-purple-700 border-purple-200 hover:bg-purple-50" onClick={generate} disabled={loading}>
        {loading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5" />}
        {loading ? "Generating..." : "Generate AI Recommendations"}
      </Button>
    );
  }

  return (
    <div className="mt-3 bg-purple-50 border border-purple-100 rounded-lg p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-purple-700 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5" />
          AI Recommendations
        </div>
        <div className="flex items-center gap-1">
          <button onClick={generate} disabled={loading} className="text-purple-400 hover:text-purple-600 p-0.5">
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          </button>
          <button onClick={() => setExpanded(e => !e)} className="text-purple-400 hover:text-purple-600 p-0.5">
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {!expanded && (
        <p className="text-xs text-purple-700 mt-1 line-clamp-2 cursor-pointer" onClick={() => setExpanded(true)}>
          {existing.summary}
        </p>
      )}

      {expanded && (
        <div className="mt-2 space-y-3">
          <p className="text-xs text-purple-800">{existing.summary}</p>

          {existing.action_steps?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-purple-700 mb-1">Action Steps</p>
              <ul className="space-y-1">
                {existing.action_steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-purple-800">
                    <span className="w-4 h-4 rounded-full bg-purple-200 text-purple-700 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                    {step}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {existing.recommended_job_titles?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-purple-700 mb-1 flex items-center gap-1">
                <Briefcase className="w-3 h-3" /> Suggested Job Titles
              </p>
              <div className="flex flex-wrap gap-1.5">
                {existing.recommended_job_titles.map((title, i) => (
                  <span key={i} className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs">{title}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}