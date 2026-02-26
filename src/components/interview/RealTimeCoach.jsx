import React, { useState, useEffect } from "react";
import { Lightbulb, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function RealTimeCoach({ answer, question, isAnalyzing }) {
  const [coachTips, setCoachTips] = useState([]);
  const [coaching, setCoaching] = useState(false);

  useEffect(() => {
    if (!answer.trim() || coaching) return;

    const timer = setTimeout(async () => {
      setCoaching(true);
      try {
        // Get real-time feedback for current answer progress
        const prompt = `You are an interview coach. The candidate is currently typing their answer to this question:

Question: ${question}
Current Answer: "${answer}"

Provide 2-3 brief, actionable coaching tips focused on:
- Clarity and structure
- Tone and delivery suggestions
- Conciseness where applicable

Keep tips short (1-2 sentences each). Format as a list of key points.`;

        const result = await base44.integrations.Core.InvokeLLM({
          prompt,
          response_json_schema: {
            type: "object",
            properties: {
              tips: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    point: { type: "string" },
                    suggestion: { type: "string" }
                  }
                }
              }
            }
          }
        });

        setCoachTips(result.tips || []);
      } catch (error) {
        // Silently fail for real-time feedback
      } finally {
        setCoaching(false);
      }
    }, 2000); // Debounce: wait 2 seconds after user stops typing

    return () => clearTimeout(timer);
  }, [answer, question, coaching]);

  if (coachTips.length === 0 && !coaching) return null;

  return (
    <div className="mt-3 p-3 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg border border-amber-200">
      <div className="flex items-start gap-2">
        {coaching ? (
          <>
            <Loader2 className="w-4 h-4 text-amber-600 animate-spin mt-0.5 shrink-0" />
            <div className="text-xs text-amber-700">Coach analyzing your answer...</div>
          </>
        ) : (
          <>
            <Lightbulb className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="space-y-2">
              {coachTips.map((tip, idx) => (
                <div key={idx} className="text-xs">
                  <p className="font-medium text-amber-900">{tip.point}:</p>
                  <p className="text-amber-700">{tip.suggestion}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}