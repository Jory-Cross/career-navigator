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
        scores: result.scores,
        topCodes: result.topCodes,
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
