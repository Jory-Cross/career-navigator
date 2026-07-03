import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Brain, Loader2, BookOpen } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const INTEREST_AREAS = [
  { id: "technology", label: "Technology & Computers", emoji: "💻" },
  { id: "healthcare", label: "Healthcare & Helping Others", emoji: "🏥" },
  { id: "arts", label: "Arts, Music & Creativity", emoji: "🎨" },
  { id: "business", label: "Business & Office Work", emoji: "📊" },
  { id: "construction", label: "Construction & Trades", emoji: "🔧" },
  { id: "food_service", label: "Food Service & Hospitality", emoji: "🍽️" },
  { id: "retail", label: "Retail & Customer Service", emoji: "🛍️" },
  { id: "education", label: "Education & Working with Kids", emoji: "📚" },
  { id: "outdoors", label: "Outdoors & Environment", emoji: "🌿" },
  { id: "transportation", label: "Transportation & Logistics", emoji: "🚗" },
];

export default function SkillsExplorationTab({ clientId, isStaff, client }) {
  const [selectedInterests, setSelectedInterests] = useState([]);
  const [loadingAI, setLoadingAI] = useState(false);
  const [careerSuggestions, setCareerSuggestions] = useState(null);
  const queryClient = useQueryClient();

  const { data: assessments = [] } = useQuery({
    queryKey: ["pre-ets-assessments", clientId],
    queryFn: () => base44.entities.Assessment.filter({ client_id: clientId }),
    enabled: !!clientId,
  });

  const skillsAssessment = assessments.find(a => a.assessment_type === "skills_audit");
  const careerAssessment = assessments.find(a => a.assessment_type === "career_goals");

  const toggleInterest = (id) => {
    setSelectedInterests(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const generateCareerPaths = async () => {
    if (selectedInterests.length === 0) {
      toast.error("Please select at least one interest area");
      return;
    }
    setLoadingAI(true);
    try {
      const interestLabels = selectedInterests.map(id => INTEREST_AREAS.find(a => a.id === id)?.label).join(", ");
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `A high school student with disabilities is exploring pre-employment transition services (Pre-ETS). 
Their interest areas are: ${interestLabels}.
${client?.target_role ? `They've expressed interest in: ${client.target_role}.` : ""}

Generate 4 entry-level career paths that would be a great fit. For each, include:
- A clear job title appropriate for someone starting out
- Why it's a good match for their interests
- 3 key skills they would develop
- A realistic first step they can take in high school

Keep the language encouraging and accessible for a high school student.`,
        response_json_schema: {
          type: "object",
          properties: {
            careers: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  why_its_a_fit: { type: "string" },
                  skills_developed: { type: "array", items: { type: "string" } },
                  first_step: { type: "string" }
                }
              }
            }
          }
        }
      });

      // Save as an assessment
      await base44.entities.Assessment.create({
        client_id: clientId,
        assessment_type: "career_goals",
        responses: { interests: selectedInterests, suggestions: result.careers },
        completed_by: "AI Skills Exploration",
        notes: `Interest areas: ${interestLabels}`
      });

      setCareerSuggestions(result.careers);
      queryClient.invalidateQueries({ queryKey: ["pre-ets-assessments", clientId] });
      toast.success("Career paths generated!");
    } catch {
      toast.error("Failed to generate suggestions");
    } finally {
      setLoadingAI(false);
    }
  };

  const savedSuggestions = careerAssessment?.responses?.suggestions || null;
  const displaySuggestions = careerSuggestions || savedSuggestions;

  return (
    <div className="space-y-6">
      {/* Interest Selector */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="w-4 h-4 text-purple-600" /> Career Interest Exploration
          </CardTitle>
          <p className="text-sm text-slate-500">Select areas that sound interesting to you, and we'll suggest career paths!</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {INTEREST_AREAS.map(area => (
              <button
                key={area.id}
                onClick={() => toggleInterest(area.id)}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-all",
                  selectedInterests.includes(area.id)
                    ? "border-purple-500 bg-purple-50 text-purple-900"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                )}
              >
                <span className="text-xl">{area.emoji}</span>
                <span className="text-sm font-medium">{area.label}</span>
              </button>
            ))}
          </div>

          <Button
            onClick={generateCareerPaths}
            disabled={loadingAI || selectedInterests.length === 0}
            className="w-full"
          >
            {loadingAI ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Finding your career paths...</>
            ) : (
              <><Sparkles className="w-4 h-4 mr-2" /> Explore Career Paths ({selectedInterests.length} selected)</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Career Suggestions */}
      {displaySuggestions && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-600" />
            <h3 className="text-sm font-semibold text-slate-800">Suggested Career Paths</h3>
            {savedSuggestions && !careerSuggestions && (
              <span className="text-xs text-slate-400">
                From {careerAssessment?.created_date ? format(new Date(careerAssessment.created_date), "MMM d, yyyy") : "previous session"}
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {displaySuggestions.map((career, idx) => (
              <Card key={idx} className="border-0 shadow-sm bg-gradient-to-br from-white to-purple-50/30">
                <CardContent className="p-5 space-y-3">
                  <h4 className="font-semibold text-slate-900">{career.title}</h4>
                  <p className="text-sm text-slate-600">{career.why_its_a_fit}</p>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Skills You'll Develop</p>
                    <div className="flex flex-wrap gap-1">
                      {career.skills_developed?.map((skill, i) => (
                        <Badge key={i} variant="outline" className="text-xs">{skill}</Badge>
                      ))}
                    </div>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg border border-green-100">
                    <p className="text-xs font-semibold text-green-700 mb-1">🎯 Your First Step</p>
                    <p className="text-xs text-green-800">{career.first_step}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Previous Assessments */}
      {assessments.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-blue-600" /> Completed Assessments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {assessments.map(a => (
                <div key={a.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-slate-800 capitalize">{a.assessment_type.replace(/_/g, " ")}</p>
                    <p className="text-xs text-slate-400">{format(new Date(a.created_date), "MMMM d, yyyy")}</p>
                    {a.notes && <p className="text-xs text-slate-500 mt-0.5 italic">{a.notes}</p>}
                  </div>
                  {a.pdf_url && (
                    <a href={a.pdf_url} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline">Download PDF</Button>
                    </a>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
