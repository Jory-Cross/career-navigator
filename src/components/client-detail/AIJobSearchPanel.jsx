    const hasProfiler = safeArray(assessments).some((assessment) => {
      const type = safeString(assessment?.assessment_type).toLowerCase();
      const title = safeString(
        assessment?.title || assessment?.name
      ).toLowerCase();

      const responses = assessment?.responses || {};

      const hasScores =
        responses?.riasec_scores &&
        Object.keys(responses.riasec_scores || {}).length > 0;

      const hasAnswers =
        Array.isArray(responses?.answers) &&
        responses.answers.length > 0;

      return (
        (
          type === "interest_profiler" ||
          type.includes("interest_profiler") ||
          title.includes("interest profiler")
        ) &&
        hasScores &&
        hasAnswers
      );
    });

    setHasInterestProfilerAssessment(hasProfiler);

    if (!hasProfiler) {
      setInterestProfilerRequiredMessage(
        "Complete the Interest Profiler assessment before generating AI job recommendations."
      );
    } else {
      setInterestProfilerRequiredMessage("");
    }

    return hasProfiler;
