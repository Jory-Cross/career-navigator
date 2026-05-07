import { toast } from "sonner";
import InterestProfilerForm from "@/components/assessments/InterestProfilerForm";
import { saveInterestProfilerResult } from "@/lib/assessments/saveInterestProfilerResult";

export default function InterestProfilerPanel({
  clientId,
  onSaved,
  existingAssessment, // <-- receives assessment when editing
}) {
  const initialAnswers =
    existingAssessment?.responses?.answers || [];

  async function handleComplete(result) {
    try {
            await saveInterestProfilerResult({
        clientId,
        assessmentId: existingAssessment?.id || null,

        answers: result.answers,
        answerString: result.answerString,

        scores: result.scores,
        riasec_scores: result.riasec_scores || result.scores,

        topCodes: result.topCodes,
        riasec_code: result.riasec_code || result.topCodes,

        status: "completed",
        completed: true,
        completed_at:
          result.completed_at || new Date().toISOString(),

        onetResult: result.onetResult || null,
      });

      toast.success("Interest Profiler saved");

      if (onSaved) {
        onSaved();
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to save Interest Profiler");
    }
  }

  return (
    <InterestProfilerForm
      onComplete={handleComplete}
      initialAnswers={initialAnswers}
    />
  );
}
