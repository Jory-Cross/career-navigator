import { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, AlertTriangle } from "lucide-react";

const ANSWER_OPTIONS = [
  { value: 1, label: "Strongly Dislike" },
  { value: 2, label: "Dislike" },
  { value: 3, label: "Unsure" },
  { value: 4, label: "Like" },
  { value: 5, label: "Strongly Like" },
];

const RIASEC_LABELS = {
  realistic: "Realistic",
  investigative: "Investigative",
  artistic: "Artistic",
  social: "Social",
  enterprising: "Enterprising",
  conventional: "Conventional",
  R: "Realistic",
  I: "Investigative",
  A: "Artistic",
  S: "Social",
  E: "Enterprising",
  C: "Conventional",
};

function getQuestionList(data) {
  if (Array.isArray(data?.question)) return data.question;
  if (Array.isArray(data?.questions)) return data.questions;
  if (Array.isArray(data?.data?.question)) return data.data.question;
  if (Array.isArray(data?.data?.questions)) return data.data.questions;
  if (Array.isArray(data)) return data;
  return [];
}

function getQuestionText(question) {
  return (
    question?.text ||
    question?.question ||
    question?.area ||
    question?.activity ||
    question?.title ||
    ""
  );
}

function getQuestionId(question, index) {
  return String(question?.index || question?.id || question?.number || index + 1);
}

function normalizeScores(resultsData) {
  const resultList =
    resultsData?.result ||
    resultsData?.results ||
    resultsData?.data?.result ||
    resultsData?.data?.results ||
    [];

  const scores = {};

  if (Array.isArray(resultList)) {
    resultList.forEach((item) => {
      const rawKey =
        item?.area ||
        item?.title ||
        item?.name ||
        item?.interest ||
        item?.code ||
        "";

      const key = String(rawKey).toLowerCase();
      const label = RIASEC_LABELS[key] || RIASEC_LABELS[rawKey] || rawKey;

      if (label) {
        scores[label] = Number(item?.score ?? item?.value ?? 0);
      }
    });
  }

  return scores;
}

function buildRiasecCode(scores) {
  return Object.entries(scores)
    .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))
    .map(([key]) => key.charAt(0).toUpperCase())
    .join("");
}

export default function InterestProfilerForm({ onComplete, initialAnswers = [] }) {
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (Array.isArray(initialAnswers) && initialAnswers.length > 0) {
      setAnswers(initialAnswers);
    }
  }, [initialAnswers]);

  useEffect(() => {
    let cancelled = false;

    async function loadQuestions() {
      setLoadingQuestions(true);
      setLoadError("");

      try {
        const res = await base44.functions.invoke("onetProxy", {
          path: "/mnm/interestprofiler/questions",
          params: {
            start: 1,
            end: 60,
          },
        });

        if (!res?.data?.success) {
          throw new Error(res?.data?.error || "Unable to load O*NET questions.");
        }

        const questionList = getQuestionList(res.data.data);

        if (!questionList.length) {
          console.log("O*NET question response:", res.data.data);
          throw new Error("O*NET returned no Interest Profiler questions.");
        }

        if (!cancelled) {
          setQuestions(questionList);
        }
      } catch (error) {
        console.error("Failed to load O*NET Interest Profiler questions:", error);
        if (!cancelled) {
          setLoadError(
            error?.message || "Failed to load O*NET Interest Profiler questions."
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingQuestions(false);
        }
      }
    }

    loadQuestions();

    return () => {
      cancelled = true;
    };
  }, []);

  const answerString = useMemo(() => {
    return questions
      .map((question, index) => {
        const questionId = getQuestionId(question, index);
        const answer = answers.find((a) => String(a.questionId) === questionId);
        return answer?.value || "";
      })
      .join("");
  }, [answers, questions]);

  function handleAnswer(questionId, value) {
    setAnswers((prev) => {
      const existing = prev.find((a) => String(a.questionId) === String(questionId));

      if (existing) {
        return prev.map((a) =>
          String(a.questionId) === String(questionId) ? { ...a, value } : a
        );
      }

      return [...prev, { questionId, value }];
    });
  }

  async function handleSubmit() {
    if (answers.length !== questions.length) return;

    setSubmitting(true);

    try {
      const resultsRes = await base44.functions.invoke("onetProxy", {
        path: "/mnm/interestprofiler/results",
        params: {
          answers: answerString,
        },
      });

      if (!resultsRes?.data?.success) {
        throw new Error(
          resultsRes?.data?.error || "Unable to calculate O*NET Interest Profiler results."
        );
      }

      const scores = normalizeScores(resultsRes.data.data);
      const topCodes = buildRiasecCode(scores);

      onComplete({
        answers,
        answerString,
        scores,
        riasec_scores: scores,
        riasec_code: topCodes,
        topCodes,
        status: "completed",
        completed: true,
        completed_at: new Date().toISOString(),
        onetResult: resultsRes.data.data,
      });
    } catch (error) {
      console.error("Failed to submit O*NET Interest Profiler:", error);
      setLoadError(
        error?.message || "Failed to submit O*NET Interest Profiler."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingQuestions) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading O*NET Interest Profiler questions...
        </div>
      </Card>
    );
  }

  if (loadError) {
    return (
      <Card className="p-4 space-y-3 border-amber-200 bg-amber-50">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <div>
            <h3 className="text-sm font-semibold text-amber-900">
              O*NET Interest Profiler could not load
            </h3>
            <p className="mt-1 text-xs text-amber-800">{loadError}</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 space-y-4">
      <div>
        <h3 className="text-sm font-semibold">O*NET Interest Profiler</h3>
        <p className="mt-1 text-xs text-slate-500">
          Answer each activity from 1 Strongly Dislike to 5 Strongly Like.
        </p>
      </div>

      {questions.map((question, index) => {
        const questionId = getQuestionId(question, index);
        const selected = answers.find(
          (a) => String(a.questionId) === String(questionId)
        )?.value;

        return (
          <div key={questionId} className="space-y-2 rounded-lg border p-3">
            <Label className="text-xs font-semibold">
              {index + 1}. {getQuestionText(question)}
            </Label>

            <div className="flex flex-wrap gap-2">
              {ANSWER_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  size="sm"
                  variant={selected === option.value ? "default" : "outline"}
                  onClick={() => handleAnswer(questionId, option.value)}
                  title={option.label}
                >
                  {option.value}
                </Button>
              ))}
            </div>
          </div>
        );
      })}

      <Button
        onClick={handleSubmit}
        disabled={answers.length !== questions.length || submitting}
      >
        {submitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Submitting...
          </>
        ) : (
          "Submit O*NET Interest Profiler"
        )}
      </Button>
    </Card>
  );
}
