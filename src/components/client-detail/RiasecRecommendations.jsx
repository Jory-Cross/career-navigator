import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Briefcase, Tag } from "lucide-react";
import { toast } from "react-hot-toast";

export default function RiasecRecommendations({ assessment, onUpdate }) {
  const [loading, setLoading] = useState(false);
  const scores = assessment.responses || {};
  const recommendations = scores.riasec_recommendations;

  const generate = async () => {
    setLoading(true);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Based on the following RIASEC career interest scores, provide career recommendations.

RIASEC Scores:
- Realistic (hands-on, mechanical): ${scores.realistic || 0}
- Investigative (analytical, scientific): ${scores.investigative || 0}
- Artistic (creative, expressive): ${scores.artistic || 0}
- Social (helping, teaching): ${scores.social || 0}
- Enterprising (leadership, business): ${scores.enterprising || 0}
- Conventional (organized, detail-oriented): ${scores.conventional || 0}

Please analyze these scores and return career recommendations. Focus on the top 2-3 scoring categories to determine the best fit.`,
        response_json_schema: {
          type: "object",
          properties: {
            top_fields: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  field: { type: "string" },
                  explanation: { type: "string" },
                  job_titles: { type: "array", items: { type: "string" } }
                }
              }
            },
            profile_summary: { type: "string" }
          }
        }
      });

      const updated = { ...scores, riasec_recommendations: result };
      await base44.entities.Assessment.update(assessment.id, { responses: updated });
      onUpdate();
      toast.success("AI recommendations generated!");
    } catch (e) {
      toast.error("Failed to generate recommendations");
    } finally {
      setLoading(false);
    }
  };

  if (!recommendations) {
    return (
      <div className="mt-3 pt-3 border-t border-slate-200">
        <Button size="sm" variant="outline" onClick={generate} disabled={loading} className="w-full">
          {loading ? (
            <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Analyzing scores...</>
          ) : (
            <><Sparkles className="w-3.5 h-3.5 mr-1.5 text-purple-500" /> Generate AI Career Recommendations</>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-slate-200 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-purple-500" />
          <span className="text-xs font-semibold text-slate-700">AI Career Recommendations</span>
        </div>
        <Button size="sm" variant="ghost" onClick={generate} disabled={loading} className="text-xs h-6 px-2">
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Refresh"}
        </Button>
      </div>

      {recommendations.profile_summary && (
        <p className="text-xs text-slate-600 bg-purple-50 rounded-md p-2 border border-purple-100">
          {recommendations.profile_summary}
        </p>
      )}

      <div className="space-y-2.5">
        {recommendations.top_fields?.map((item, i) => (
          <div key={i} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
            <div className="flex items-center gap-2 mb-1">
              <Briefcase className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span className="text-sm font-semibold text-slate-800">{item.field}</span>
            </div>
            <p className="text-xs text-slate-600 mb-2">{item.explanation}</p>
            {item.job_titles?.length > 0 && (
              <div className="flex flex-wrap gap-1">
                <Tag className="w-3 h-3 text-slate-400 mt-0.5" />
                {item.job_titles.map((title, j) => (
                  <Badge key={j} variant="secondary" className="text-xs px-1.5 py-0">
                    {title}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}