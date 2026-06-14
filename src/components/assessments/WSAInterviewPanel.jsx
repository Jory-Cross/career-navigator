import React, { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Lightbulb, Loader2, CheckCircle2, FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import RealTimeCoach from "@/components/interview/RealTimeCoach";
import {
  getInterviewSessions,
  deleteInterviewSession,
  createInterviewSession,
  updateInterviewSession,
  analyzeInterviewAnswer,
  generateInterviewOverallFeedback,
  createActivity,
} from "@/lib/api/clientPortalApi";

const WSA_QUESTIONS = [
  { question: "Tell me about yourself", category: "Background" },
  { question: "What are your greatest strengths?", category: "Strengths" },
  { question: "What is your greatest weakness?", category: "Weakness" },
  { question: "Why are you interested in this role/our company?", category: "Motivation" },
  { question: "Describe a challenging situation you've faced and how you dealt with it.", category: "Problem Solving" },
  { question: "Where do you see yourself in 5 years?", category: "Career Goals" },
  { question: "How do you handle conflict in the workplace?", category: "Conflict Resolution" },
  { question: "How do you prioritize your work?", category: "Time Management" },
  { question: "Give an example of a goal you set and how you achieved it.", category: "Achievement" },
  { question: "Do you have any questions for us?", category: "Engagement" },
];

function buildQuestionState(q) {
  return {
    question: q.question || "",
    category: q.category || "General",
    answer: q.answer || "",
    feedback: q.feedback || "",
    score: typeof q.score === "number" ? q.score : null,
  };
}

export default function WSAInterviewPanel({ clientId, client, onSaved }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  // Active session state
  const [activeSession, setActiveSession] = useState(null);
  const [questionIdx, setQuestionIdx] = useState(0);
  const [answer, setAnswer] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const [sessionNotes, setSessionNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);

  const resolvedClientId = clientId || client?.id;

  const loadSessions = async () => {
    if (!resolvedClientId) return;
    setLoading(true);
    try {
      const all = await getInterviewSessions(resolvedClientId);
      setSessions((Array.isArray(all) ? all : []).filter(s => s.session_type === "WSA"));
    } catch {
      toast.error("Failed to load WSA interview sessions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSessions(); }, [resolvedClientId]);

  const currentQuestion = activeSession?.questions?.[questionIdx];

  const closeSession = () => {
    setActiveSession(null);
    setQuestionIdx(0);
    setAnswer("");
    setAnalyzing(false);
    setReviewMode(false);
    setSessionNotes("");
    setShowNotes(false);
  };

  const startNewSession = async () => {
    setStarting(true);
    try {
      const questions = WSA_QUESTIONS.map(buildQuestionState);
      const session = await createInterviewSession({
        client_id: resolvedClientId,
        target_role: client?.target_role || "WSA Interview",
        industry: client?.industry || "",
        company: "",
        questions,
        session_date: new Date().toISOString().split("T")[0],
        session_type: "WSA",
        notes: "",
      });
      setActiveSession(session);
      setQuestionIdx(0);
      setAnswer("");
      setReviewMode(false);
    } catch {
      toast.error("Failed to start WSA interview session");
    } finally {
      setStarting(false);
    }
  };

  const openSession = (session) => {
    const questions = Array.isArray(session.questions) ? session.questions : [];
    const firstUnanswered = questions.findIndex(q => !q.answer);
    const shouldContinue = !session.overall_feedback && firstUnanswered !== -1;
    const idx = shouldContinue ? firstUnanswered : 0;
    setActiveSession(session);
    setQuestionIdx(idx);
    setAnswer(questions[idx]?.answer || "");
    setReviewMode(!shouldContinue);
    setSessionNotes(session.notes || "");
    setShowNotes(false);
  };

  const handleDelete = async (e, sessionId) => {
    e.stopPropagation();
    try {
      await deleteInterviewSession(sessionId);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      toast.success("Session deleted");
    } catch {
      toast.error("Failed to delete session");
    }
  };

  const buildPayload = (session, questions, extra = {}) => ({
    client_id: session.client_id || resolvedClientId,
    job_application_id: session.job_application_id || null,
    target_role: session.target_role || "WSA Interview",
    industry: session.industry || "",
    company: session.company || "",
    questions: Array.isArray(questions) ? questions : [],
    session_date: session.session_date || new Date().toISOString().split("T")[0],
    session_type: "WSA",
    notes: sessionNotes || session.notes || "",
    tags: Array.isArray(session.tags) ? session.tags : [],
    ...extra,
  });

  const submitAnswer = async () => {
    const clean = answer.trim();
    if (!clean) { toast.error("Please provide an answer"); return; }
    if (!activeSession?.id || !Array.isArray(activeSession.questions)) return;
    if (analyzing) return;
    setAnalyzing(true);
    try {
      const q = activeSession.questions[questionIdx];
      const result = await analyzeInterviewAnswer({ question: q.question, category: q.category, answer: clean });
      const updated = [...activeSession.questions];
      updated[questionIdx] = { ...updated[questionIdx], answer: clean, feedback: result?.feedback || "", score: result?.score ?? null };
      const payload = buildPayload(activeSession, updated, { overall_feedback: activeSession.overall_feedback || "", improvement_tips: activeSession.improvement_tips || [] });
      const saved = await updateInterviewSession(activeSession.id, payload);
      setActiveSession(saved);
      const isLast = questionIdx >= updated.length - 1;
      if (!isLast) {
        setAnswer(updated[questionIdx + 1]?.answer || "");
        setQuestionIdx(prev => prev + 1);
        toast.success("Answer saved");
      } else {
        setAnswer("");
        toast.success("Final answer saved. Click Finish Session to complete.");
      }
    } catch {
      toast.error("Failed to save answer");
    } finally {
      setAnalyzing(false);
    }
  };

  const finishSession = async (questionsToSave) => {
    if (!activeSession?.id || analyzing) return;
    setAnalyzing(true);
    try {
      const safe = Array.isArray(questionsToSave) ? questionsToSave : activeSession.questions || [];
      let feedbackResult = null;
      try { feedbackResult = await generateInterviewOverallFeedback(safe); } catch {}
      const payload = buildPayload(activeSession, safe, {
        overall_feedback: feedbackResult?.overall_feedback || "WSA interview completed and saved.",
        improvement_tips: Array.isArray(feedbackResult?.improvement_tips) ? feedbackResult.improvement_tips : [],
      });
      const saved = await updateInterviewSession(activeSession.id, payload);
      try {
        const avg = Math.round(safe.reduce((s, q) => s + (q.score || 0), 0) / Math.max(safe.length, 1));
        await createActivity({ client_id: resolvedClientId, activity_type: "interview_prep", title: "WSA Interview Completed", description: `Completed WSA interview session with ${safe.length} questions. Average score: ${avg}%` });
      } catch {}
      setActiveSession(saved);
      toast.success("WSA interview session completed");
      await loadSessions();
      onSaved?.();
      closeSession();
    } catch {
      toast.error("Failed to finish session");
    } finally {
      setAnalyzing(false);
    }
  };

  // ── Active session view ──────────────────────────────────────────────────────
  if (activeSession) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">WSA Interview Assessment</h3>
          <Button variant="outline" size="sm" onClick={closeSession}>← Back to Sessions</Button>
        </div>

        {reviewMode ? (
          /* Review mode */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Badge variant="outline">Question {questionIdx + 1} of {activeSession.questions.length}</Badge>
              <Badge>{currentQuestion?.category}</Badge>
            </div>
            <Card className="border-slate-100 p-4">
              <p className="font-medium text-slate-900">{currentQuestion?.question}</p>
            </Card>
            {currentQuestion?.answer ? (
              <Card className="border-slate-100 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <div className="font-medium text-slate-900">Answer</div>
                  <Badge className="bg-blue-100 text-blue-700">{currentQuestion.score}%</Badge>
                </div>
                <p className="mb-4 whitespace-pre-wrap text-sm text-slate-700">{currentQuestion.answer}</p>
                <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                  <strong>Feedback:</strong> {currentQuestion.feedback}
                </div>
              </Card>
            ) : (
              <Card className="border-slate-100 p-4 text-sm text-slate-400">No answer recorded</Card>
            )}
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setQuestionIdx(p => Math.max(p - 1, 0))} disabled={questionIdx === 0}>Previous</Button>
              <Button variant="outline" onClick={() => setQuestionIdx(p => Math.min(p + 1, activeSession.questions.length - 1))} disabled={questionIdx >= activeSession.questions.length - 1}>Next</Button>
            </div>
            {activeSession.overall_feedback && (
              <Card className="border-slate-100 p-4">
                <div className="mb-2 flex items-center gap-2 font-medium text-slate-900">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />Overall Feedback
                </div>
                <p className="text-sm text-slate-700">{activeSession.overall_feedback}</p>
                {Array.isArray(activeSession.improvement_tips) && activeSession.improvement_tips.length > 0 && (
                  <div className="mt-4">
                    <div className="mb-2 text-sm font-medium text-slate-900">Improvement Tips</div>
                    <ul className="space-y-2 text-sm text-slate-700">
                      {activeSession.improvement_tips.map((tip, i) => <li key={i} className="rounded bg-slate-50 p-2">{tip}</li>)}
                    </ul>
                  </div>
                )}
              </Card>
            )}
          </div>
        ) : activeSession.overall_feedback ? (
          /* Completed view */
          <div className="space-y-4">
            <Card className="border-slate-100 p-4">
              <div className="mb-2 flex items-center gap-2 font-medium text-slate-900">
                <CheckCircle2 className="h-4 w-4 text-green-600" />Session Complete
              </div>
              <p className="text-sm text-slate-700">{activeSession.overall_feedback}</p>
            </Card>
          </div>
        ) : (
          /* Active answering */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Badge variant="outline">Question {questionIdx + 1} of {activeSession.questions.length}</Badge>
              <Badge>{currentQuestion?.category}</Badge>
            </div>
            <Card className="border-slate-100 p-4">
              <p className="font-medium text-slate-900">{currentQuestion?.question}</p>
            </Card>
            {currentQuestion?.feedback ? (
              <Card className="border-slate-100 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <div className="font-medium text-slate-900">Answer Submitted</div>
                  <Badge className="bg-blue-100 text-blue-700">{currentQuestion.score}%</Badge>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{currentQuestion.feedback}</div>
                <div className="mt-4 flex justify-end">
                  {questionIdx < activeSession.questions.length - 1 ? (
                    <Button onClick={() => { setQuestionIdx(p => p + 1); setAnswer(activeSession.questions[questionIdx + 1]?.answer || ""); }}>Next Question</Button>
                  ) : (
                    <Button onClick={() => finishSession(activeSession.questions)} disabled={analyzing}>
                      {analyzing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Finishing...</> : "Finish Session"}
                    </Button>
                  )}
                </div>
              </Card>
            ) : (
              <>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Your Answer:</label>
                  <Textarea value={answer} onChange={e => setAnswer(e.target.value)} placeholder="Type your answer here..." rows={6} className="resize-none" />
                </div>
                <RealTimeCoach answer={answer} question={currentQuestion?.question} isAnalyzing={analyzing} />
                <div className="flex items-center justify-between gap-3">
                  <Button variant="outline" onClick={() => setShowNotes(p => !p)}>
                    <FileText className="mr-2 h-4 w-4" />Session Notes
                  </Button>
                  <Button onClick={submitAnswer} disabled={analyzing || !answer.trim()} className="w-full max-w-xs">
                    {analyzing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Analyzing...</> : "Submit Answer"}
                  </Button>
                </div>
                {showNotes && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Session Notes</label>
                    <Textarea value={sessionNotes} onChange={e => setSessionNotes(e.target.value)} rows={4} placeholder="Add any notes from this session..." />
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Session list view ────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-900">WSA Interview Assessment</h3>
          <p className="text-sm text-slate-500">Conduct and review structured WSA interview sessions</p>
        </div>
        <Button onClick={startNewSession} disabled={starting}>
          {starting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Starting...</> : <><Lightbulb className="mr-2 h-4 w-4" />Start WSA Interview</>}
        </Button>
      </div>

      {loading ? (
        <div className="py-8 text-center text-sm text-slate-400">Loading sessions...</div>
      ) : sessions.length === 0 ? (
        <Card className="border-dashed border-slate-200 p-8 text-center">
          <Lightbulb className="mx-auto mb-3 h-8 w-8 text-slate-300" />
          <p className="font-medium text-slate-700">No WSA interview sessions yet</p>
          <p className="mt-1 text-sm text-slate-500">Start a session to conduct a structured WSA interview assessment</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {sessions.map(session => {
            const qs = Array.isArray(session.questions) ? session.questions : [];
            const answered = qs.filter(q => q.answer).length;
            const avg = qs.length ? Math.round(qs.reduce((s, q) => s + (q.score || 0), 0) / qs.length) : 0;
            const isComplete = !!session.overall_feedback;
            return (
              <div key={session.id} onClick={() => openSession(session)} className="cursor-pointer rounded-lg border border-slate-200 p-3 hover:bg-slate-50 transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-slate-900">{session.target_role || "WSA Interview"}</span>
                      <Badge variant="outline">{answered}/{qs.length} answered</Badge>
                      <Badge className={cn(isComplete ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
                        {isComplete ? "Completed" : "In Progress"}
                      </Badge>
                    </div>
                    {session.session_date && <p className="mt-1 text-xs text-slate-400">{session.session_date}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    {avg > 0 && <Badge className={cn(avg >= 80 ? "bg-green-100 text-green-700" : avg >= 60 ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700")}>{avg}%</Badge>}
                    <button type="button" onClick={e => handleDelete(e, session.id)} className="rounded p-1 text-slate-300 hover:bg-red-50 hover:text-red-500 transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}