import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

import {
  INTEREST_PROFILER_QUESTIONS,
  calculateRiasecScores,
  getTopRiasecCodes
} from "@/lib/assessments/interestProfilerModel";

export default function InterestProfilerForm({ onComplete }) {
  const [answers, setAnswers] = useState([]);

  function handleAnswer(questionId, value) {
    setAnswers((prev) => {
      const existing = prev.find(a => a.questionId === questionId);

      if (existing) {
        return prev.map(a =>
          a.questionId === questionId ? { ...a, value } : a
        );
      }

      return [...prev, { questionId, value }];
    });
  }

  function handleSubmit() {
    if (answers.length !== INTEREST_PROFILER_QUESTIONS.length) return;

   const scores = calculateRiasecScores(
  answers.map(a => {
    const question = INTEREST_PROFILER_QUESTIONS.find(q => q.id === a.questionId);
    return {
      ...a,
      category: question?.category
    };
  })
);
    const topCodes = getTopRiasecCodes(scores);

    onComplete({
      answers,
      scores,
      topCodes,
    });
  }

  return (
    <Card className="p-4 space-y-4">
      <h3 className="text-sm font-semibold">Interest Profiler</h3>

      {INTEREST_PROFILER_QUESTIONS.map((q) => (
        <div key={q.id} className="space-y-1">
          <Label className="text-xs">{q.text}</Label>

          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((val) => (
              <Button
                key={val}
                size="sm"
                variant={
                  answers.find(a => a.questionId === q.id)?.value === val
                    ? "default"
                    : "outline"
                }
                onClick={() => handleAnswer(q.id, val)}
              >
                {val}
              </Button>
            ))}
          </div>
        </div>
      ))}

      <Button
        onClick={handleSubmit}
        disabled={answers.length !== INTEREST_PROFILER_QUESTIONS.length}
      >
        Submit
      </Button>
    </Card>
  );
}
