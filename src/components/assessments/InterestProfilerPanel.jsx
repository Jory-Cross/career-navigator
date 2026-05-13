import { useEffect, useRef } from "react";
import { toast } from "sonner";
import InterestProfilerForm from "@/components/assessments/InterestProfilerForm";
import { saveInterestProfilerResult } from "@/lib/assessments/saveInterestProfilerResult";

export default function InterestProfilerPanel({
  clientId,
  onSaved,
  existingAssessment,
}) {
  const initialAnswers = existingAssessment?.responses?.answers || [];

  // Keep a ref to the latest answers/result from the form so unmount can access them
  const latestResultRef = useRef(null);
  const isSavingRef = useRef(false);

  // Auto-save helper — saves whatever is in latestResultRef
  async function doSave(result, showToast = false) {
    if (!result || isSavingRef.current) return;
    isSavingRef.current = true;
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
        status: result.completed ? "completed" : "in_progress",
        completed: !!result.completed,
        completed_at: result.completed_at || (result.completed ? new Date().toISOString() : null),
        onetResult: result.onetResult || null,
      });
      if (showToast) toast.success("Interest Profiler saved");
      if (onSaved) onSaved();
    } catch (error) {
      console.error("Interest Profiler save error:", error);
      if (showToast) toast.error("Failed to save Interest Profiler");
    } finally {
      isSavingRef.current = false;
    }
  }

  // Auto-save on unmount (tab switch / panel close)
  useEffect(() => {
    return () => {
      if (latestResultRef.current) {
        doSave(latestResultRef.current, false).catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Called by InterestProfilerForm on any answer change (partial) or full completion
  function handleProgress(result) {
    latestResultRef.current = result;
  }

  // Called by InterestProfilerForm on full submit (all 60 answered + O*NET scored)
  async function handleComplete(result) {
    latestResultRef.current = result;
    await doSave(result, true);
  }

  return (
    <InterestProfilerForm
      onComplete={handleComplete}
      onProgress={handleProgress}
      initialAnswers={initialAnswers}
    />
  );
}