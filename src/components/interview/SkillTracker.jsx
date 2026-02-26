import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Target } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function SkillTracker({ clientId }) {
  const [skillAnalysis, setSkillAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analyzeSkills();
  }, [clientId]);

  const analyzeSkills = async () => {
    setLoading(true);
    try {
      // Fetch all interview sessions for this client
      const sessions = await base44.entities.InterviewSession.filter({ client_id: clientId });
      
      if (sessions.length === 0) {
        setLoading(false);
        return;
      }

      // Extract all answers and feedback
      const allAnswers = sessions.flatMap(s => 
        (s.questions || []).map(q => ({
          answer: q.answer,
          feedback: q.feedback,
          score: q.score,
          category: q.category
        }))
      ).filter(a => a.feedback && a.score);

      if (allAnswers.length === 0) {
        setLoading(false);
        return;
      }

      // Use LLM to analyze skills
      const prompt = `Analyze these interview responses and identify:
1. Top 3 strongest skills (with evidence)
2. Top 3 areas needing improvement
3. Recommended practice focus areas

Responses:
${allAnswers.map(a => `Category: ${a.category}\nScore: ${a.score}/100\nFeedback: ${a.feedback}`).join('\n\n')}`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            strengths: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  skill: { type: "string" },
                  evidence: { type: "string" }
                }
              }
            },
            weaknesses: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  skill: { type: "string" },
                  reason: { type: "string" }
                }
              }
            },
            recommendations: {
              type: "array",
              items: { type: "string" }
            }
          }
        }
      });

      setSkillAnalysis(result);
    } catch (error) {
      console.error("Failed to analyze skills");
    } finally {
      setLoading(false);
    }
  };

  if (loading || !skillAnalysis) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Strengths */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <TrendingUp className="w-4 h-4 text-green-600" />
            Strongest Skills
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {skillAnalysis.strengths?.map((strength, idx) => (
            <div key={idx} className="p-2 bg-green-50 rounded-lg border border-green-200">
              <Badge className="bg-green-100 text-green-800 mb-1">{strength.skill}</Badge>
              <p className="text-xs text-slate-600">{strength.evidence}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Weaknesses */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <TrendingDown className="w-4 h-4 text-amber-600" />
            Areas to Improve
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {skillAnalysis.weaknesses?.map((weakness, idx) => (
            <div key={idx} className="p-2 bg-amber-50 rounded-lg border border-amber-200">
              <Badge className="bg-amber-100 text-amber-800 mb-1">{weakness.skill}</Badge>
              <p className="text-xs text-slate-600">{weakness.reason}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Recommendations */}
      <Card className="border-0 shadow-sm lg:col-span-2">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Target className="w-4 h-4 text-blue-600" />
            Recommended Focus Areas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {skillAnalysis.recommendations?.map((rec, idx) => (
              <li key={idx} className="text-xs text-slate-600 flex items-start gap-2">
                <span className="text-blue-600 font-bold shrink-0">{idx + 1}.</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}