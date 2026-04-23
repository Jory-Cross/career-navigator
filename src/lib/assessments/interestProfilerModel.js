export const INTEREST_PROFILER_QUESTIONS = [
  // Phase 1: keep small (expand later)
  { id: 1, text: "Build kitchen cabinets", type: "R" },
  { id: 2, text: "Study the structure of the human body", type: "I" },
  { id: 3, text: "Paint a portrait", type: "A" },
  { id: 4, text: "Help people with personal problems", type: "S" },
  { id: 5, text: "Sell products in a store", type: "E" },
  { id: 6, text: "Organize files and records", type: "C" },
];
export function calculateRiasecScores(answers) {
  const scores = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };

  answers.forEach(({ questionId, value }) => {
    const q = INTEREST_PROFILER_QUESTIONS.find(q => q.id === questionId);
    if (!q) return;

    scores[q.type] += value;
  });

  return scores;
}
export function getTopRiasecCodes(scores) {
  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([code]) => code);
}
