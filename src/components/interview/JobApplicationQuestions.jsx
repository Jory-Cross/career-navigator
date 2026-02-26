import React, { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function JobApplicationQuestions({ jobApplication, onQuestionsGenerated }) {
  const [generating, setGenerating] = useState(false);

  const generateQuestionsFromJob = async () => {
    if (!jobApplication?.company || !jobApplication?.position) {
      toast.error("Job application missing company or position");
      return;
    }

    setGenerating(true);
    try {
      const prompt = `Generate 5 tailored interview questions for someone applying for a ${jobApplication.position} position at ${jobApplication.company}.

${jobApplication.ai_fit_analysis ? `Additional context: ${jobApplication.ai_fit_analysis}` : ""}

Focus on:
1. Role-specific challenges at this company
2. Why they want to work there
3. Relevant experience and skills
4. Problem-solving for company's context
5. Cultural fit questions

Categorize each question appropriately.`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            questions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  question: { type: "string" },
                  category: { type: "string" }
                }
              }
            }
          }
        }
      });

      onQuestionsGenerated(result.questions, jobApplication.id);
      toast.success("Job-specific questions generated!");
    } catch (error) {
      toast.error("Failed to generate questions");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <button
      onClick={generateQuestionsFromJob}
      disabled={generating}
      className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
    >
      {generating ? (
        <>
          <Loader2 className="w-3 h-3 animate-spin" />
          Generating...
        </>
      ) : (
        "Generate Job-Specific Questions"
      )}
    </button>
  );
}