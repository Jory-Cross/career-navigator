import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Lightbulb,
  Sparkles,
  Loader2,
  MessageSquare,
  Target,
  CheckCircle2,
  Tag,
  FileText,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import RealTimeCoach from "@/components/interview/RealTimeCoach";
import SkillTracker from "@/components/interview/SkillTracker";
import JobApplicationQuestions from "@/components/interview/JobApplicationQuestions";
import {
  getApplications,
  getInterviewSessions,
  deleteInterviewSession,
  createInterviewSession,
  updateInterviewSession,
  generateInterviewQuestions,
  analyzeInterviewAnswer,
  generateInterviewOverallFeedback,
  createActivity,
} from "@/lib/api/clientPortalApi";

const WSA_QUESTIONS = [
  { question: "Tell me about yourself", category: "Background" },
  { question: "What are your greatest strengths?", category: "Strengths" },
  { question: "What is your greatest weakness?", category: "Weakness" },
  { question: "Why are you interested in this role/our company?", category: "Motivation" },
  {
    question: "Describe a challenging situation you've faced and how you dealt with it.",
    category: "Problem Solving",
  },
  { question: "Where do you see yourself in 5 years?", category: "Career Goals" },
  { question: "How do you handle conflict in the workplace?", category: "Conflict Resolution" },
  { question: "How do you prioritize your work?", category: "Time Management" },
  { question: "Give an example of a goal you set and how you achieved it.", category: "Achievement" },
  { question: "Do you have any questions for us?", category: "Engagement" },
];

function buildQuestionState(question) {
  return {
    question: question.question || "",
    category: question.category || "General",
    answer: question.answer || "",
    feedback: question.feedback || "",
    score: typeof question.score === "number" ? question.score : null,
  };
}

export default function InterviewPrepSection({ client }) {
  const [sessions, setSessions] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSession, setShowSession] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [currentSession, setCurrentSession] = useState(null);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [answer, setAnswer] = useState("");
  const [analyzingAnswer, setAnalyzingAnswer] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const [isWSA, setIsWSA] = useState(false);
  const [sessionNotes, setSessionNotes] = useState("");
  const [showSessionNotes, setShowSessionNotes] = useState(false);
  const [jobDropdownOpen, setJobDropdownOpen] = useState(false);

  const jobDropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (jobDropdownRef.current && !jobDropdownRef.current.contains(e.target)) {
        setJobDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loadData = async () => {
    if (!client?.id) {
      setSessions([]);
      setApplications([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [loadedSessions, loadedApps] = await Promise.all([
        getInterviewSessions(client.id),
        getApplications(client.id),
      ]);

      setSessions(Array.isArray(loadedSessions) ? loadedSessions : []);
      setApplications(
        (Array.isArray(loadedApps) ? loadedApps : []).filter(
          (a) => a.status !== "rejected" && a.status !== "withdrawn"
        )
      );
    } catch (error) {
      console.error("Failed to load interview prep data:", error);
      toast.error("Failed to load interview prep data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [client?.id]);

  const currentQuestion = currentSession?.questions?.[currentQuestionIdx];

  const avgScore = useMemo(() => {
    if (!sessions.length) return 0;

    const total = sessions.reduce((sum, session) => {
      const questions = Array.isArray(session.questions) ? session.questions : [];
      const sessionAvg = questions.length
        ? questions.reduce((qSum, q) => qSum + (q.score || 0), 0) / questions.length
        : 0;
      return sum + sessionAvg;
    }, 0);

    return Math.round(total / sessions.length);
  }, [sessions]);

  const closeSessionDialog = () => {
    setShowSession(false);
    setGenerating(false);
    setReviewMode(false);
    setCurrentSession(null);
    setCurrentQuestionIdx(0);
    setAnswer("");
    setAnalyzingAnswer(false);
    setSessionNotes("");
    setShowSessionNotes(false);
  };

  const reviewSession = (session) => {
    setCurrentSession(session);
    setCurrentQuestionIdx(0);
    setReviewMode(true);
    setShowSession(true);
    setIsWSA(session.session_type === "WSA");
    setSessionNotes(session.notes || "");
  };

  const handleDeleteSession = async (e, sessionId) => {
    e.stopPropagation();

    try {
      await deleteInterviewSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      toast.success("Session deleted");
    } catch (error) {
      console.error("Failed to delete session:", error);
      toast.error("Failed to delete session");
    }
  };

  const startNewSession = async (useWSA = false, jobApplicationId = null) => {
    if (!client?.target_role) {
      toast.error("Please set a target role for the client first");
      return;
    }

    setGenerating(true);
    setShowSession(true);
    setReviewMode(false);
    setIsWSA(useWSA);
    setCurrentQuestionIdx(0);
    setAnswer("");
    setSessionNotes("");
    setShowSessionNotes(false);

    try {
      const jobApp = jobApplicationId
        ? applications.find((a) => a.id === jobApplicationId)
        : null;

      let questions;

      if (useWSA) {
        questions = WSA_QUESTIONS.map(buildQuestionState);
      } else {
        const generated = await generateInterviewQuestions({
          client,
          jobApplication: jobApp || null,
        });
        questions = (Array.isArray(generated) ? generated : []).map(buildQuestionState);
      }

      const session = await createInterviewSession({
        client_id: client.id,
        job_application_id: jobApplicationId || null,
        target_role: jobApp?.position || client.target_role,
        industry: jobApp?.location || client.industry || "",
        company: jobApp?.company || "",
        questions,
        session_date: new Date().toISOString().split("T")[0],
        session_type: useWSA ? "WSA" : "practice",
        notes: "",
      });

      setCurrentSession(session);
    } catch (error) {
      console.error("Failed to start session:", error);
      toast.error("Failed to start session");
      setShowSession(false);
    } finally {
      setGenerating(false);
    }
  };

  const generateOverallFeedback = async (questionsToScore) => {
    try {
      const result = await generateInterviewOverallFeedback(questionsToScore);

      const updatedSession = await updateInterviewSession(currentSession.id, {
        overall_feedback: result.overall_feedback,
        improvement_tips: result.improvement_tips,
        notes: sessionNotes,
      });

      const avg = Math.round(
        questionsToScore.reduce((sum, q) => sum + (q.score || 0), 0) /
          Math.max(questionsToScore.length, 1)
      );

      await createActivity({
        client_id: client.id,
        activity_type: "interview_prep",
        title: `${isWSA ? "WSA" : "Practice"} Interview Completed`,
        description: `Completed interview session with ${questionsToScore.length} questions. Average score: ${avg}%`,
      });

      setCurrentSession(updatedSession);
      toast.success("Session completed!");
      await loadData();
    } catch (error) {
      console.error("Failed to generate overall feedback:", error);
      toast.error("Failed to generate feedback");
    }
  };

  const submitAnswer = async () => {
    if (!answer.trim()) {
      toast.error("Please provide an answer");
      return;
    }

    setAnalyzingAnswer(true);

    try {
      const question = currentSession.questions[currentQuestionIdx];
      const result = await analyzeInterviewAnswer({
        question: question.question,
        category: question.category,
        answer,
      });

      const updatedQuestions = [...currentSession.questions];
      updatedQuestions[currentQuestionIdx] = {
        ...updatedQuestions[currentQuestionIdx],
        answer,
        feedback: result.feedback,
        score: result.score,
      };

      const updatedSession = await updateInterviewSession(currentSession.id, {
        questions: updatedQuestions,
      });

      setCurrentSession(updatedSession);

      if (currentQuestionIdx < updatedQuestions.length - 1) {
        setCurrentQuestionIdx((prev) => prev + 1);
        setAnswer("");
        toast.success("Answer submitted!");
      } else {
        await generateOverallFeedback(updatedQuestions);
      }
    } catch (error) {
      console.error("Failed to analyze answer:", error);
      toast.error("Failed to analyze answer");
    } finally {
      setAnalyzingAnswer(false);
    }
  };

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Interview Preparation</h3>
          <p className="text-sm text-slate-500">
            Practice interview questions and track improvement over time
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => startNewSession(false)}>
            <Sparkles className="mr-2 h-4 w-4" />
            General Practice
          </Button>

          {applications.length > 0 && (
            <div className="relative" ref={jobDropdownRef}>
              <Button variant="outline" onClick={() => setJobDropdownOpen((o) => !o)}>
                <Target className="mr-2 h-4 w-4" />
                Job-Specific
              </Button>

              {jobDropdownOpen && (
                <div className="absolute right-0 z-20 mt-2 w-72 rounded-lg border border-slate-200 bg-white shadow-lg">
                  {applications.map((app) => (
                    <button
                      key={app.id}
                      type="button"
                      onClick={() => {
                        startNewSession(false, app.id);
                        setJobDropdownOpen(false);
                      }}
                      className="block w-full border-b px-3 py-2 text-left text-xs hover:bg-slate-50 last:border-b-0"
                    >
                      {app.company} - {app.position}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <Button variant="secondary" onClick={() => startNewSession(true)}>
            <Lightbulb className="mr-2 h-4 w-4" />
            WSA Interview
          </Button>
        </div>
      </div>

      {sessions.length > 0 && <SkillTracker sessions={sessions} />}

      <Card className="border-slate-100 p-6">
        {loading ? (
          <div className="py-8 text-center text-sm text-slate-400">Loading sessions...</div>
        ) : sessions.length === 0 ? (
          <div className="py-10 text-center">
            <MessageSquare className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <p className="text-base font-medium text-slate-700">No practice sessions yet</p>
            <p className="mt-1 text-sm text-slate-500">
              Generate AI questions and practice your answers
            </p>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <div className="text-sm text-slate-500">
                Average Score <span className="font-semibold text-slate-900">{avgScore}%</span>
              </div>
            </div>

            <div className="space-y-3">
              {sessions.slice(0, 3).map((session) => {
                const sessionQuestions = Array.isArray(session.questions) ? session.questions : [];
                const sessionAvg = sessionQuestions.length
                  ? Math.round(
                      sessionQuestions.reduce((sum, q) => sum + (q.score || 0), 0) /
                        sessionQuestions.length
                    )
                  : 0;

                return (
                  <div
                    key={session.id}
                    onClick={() => reviewSession(session)}
                    className="cursor-pointer rounded-lg border border-slate-200 p-3 transition-colors hover:bg-slate-50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="font-medium text-slate-900">{session.target_role}</div>
                          <Badge variant="outline">{sessionQuestions.length} questions</Badge>
                          {session.company ? <Badge variant="secondary">{session.company}</Badge> : null}
                          {Array.isArray(session.tags) && session.tags.length > 0
                            ? session.tags.map((tag, idx) => (
                                <Badge key={`${tag}-${idx}`} variant="outline">
                                  <Tag className="mr-1 h-3 w-3" />
                                  {tag}
                                </Badge>
                              ))
                            : null}
                        </div>

                        {Array.isArray(session.improvement_tips) &&
                        session.improvement_tips.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {session.improvement_tips.slice(0, 2).map((tip, idx) => (
                              <span
                                key={`${tip}-${idx}`}
                                className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600"
                              >
                                {tip}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge
                          className={cn(
                            sessionAvg >= 80
                              ? "bg-green-100 text-green-700"
                              : sessionAvg >= 60
                              ? "bg-blue-100 text-blue-700"
                              : "bg-amber-100 text-amber-700"
                          )}
                        >
                          {sessionAvg}%
                        </Badge>

                        <button
                          type="button"
                          onClick={(e) => handleDeleteSession(e, session.id)}
                          className="rounded p-1 text-slate-300 transition-colors hover:bg-red-50 hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Card>

      <Dialog open={showSession} onOpenChange={(open) => (!open ? closeSessionDialog() : null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{isWSA ? "WSA Interview" : "Interview Practice Session"}</DialogTitle>
          </DialogHeader>

          {generating ? (
            <div className="py-12 text-center">
              <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-slate-400" />
              <p className="text-sm text-slate-500">
                {isWSA ? "Loading WSA Interview..." : "Generating interview questions..."}
              </p>
            </div>
          ) : reviewMode ? (
            currentSession && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">
                    Question {currentQuestionIdx + 1} of {currentSession.questions.length}
                  </Badge>
                  <Badge>{currentQuestion?.category}</Badge>
                </div>

                <Card className="border-slate-100 p-4">
                  <p className="font-medium text-slate-900">{currentQuestion?.question}</p>
                </Card>

                {currentQuestion?.answer ? (
                  <Card className="border-slate-100 p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="font-medium text-slate-900">Your Answer</div>
                      <Badge className="bg-blue-100 text-blue-700">{currentQuestion.score}%</Badge>
                    </div>
                    <p className="mb-4 whitespace-pre-wrap text-sm text-slate-700">
                      {currentQuestion.answer}
                    </p>
                    <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                      <strong>Feedback:</strong> {currentQuestion.feedback}
                    </div>
                  </Card>
                ) : (
                  <Card className="border-slate-100 p-4 text-sm text-slate-400">
                    No answer recorded for this question
                  </Card>
                )}

                <div className="flex justify-between">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentQuestionIdx((prev) => Math.max(prev - 1, 0))}
                    disabled={currentQuestionIdx === 0}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      setCurrentQuestionIdx((prev) =>
                        Math.min(prev + 1, currentSession.questions.length - 1)
                      )
                    }
                    disabled={currentQuestionIdx >= currentSession.questions.length - 1}
                  >
                    Next
                  </Button>
                </div>

                {currentSession.overall_feedback ? (
                  <Card className="border-slate-100 p-4">
                    <div className="mb-2 flex items-center gap-2 font-medium text-slate-900">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      Overall Feedback
                    </div>
                    <p className="text-sm text-slate-700">{currentSession.overall_feedback}</p>
                    {Array.isArray(currentSession.improvement_tips) &&
                    currentSession.improvement_tips.length > 0 ? (
                      <div className="mt-4">
                        <div className="mb-2 text-sm font-medium text-slate-900">
                          Improvement Tips
                        </div>
                        <ul className="space-y-2 text-sm text-slate-700">
                          {currentSession.improvement_tips.map((tip, idx) => (
                            <li key={`${tip}-${idx}`} className="rounded bg-slate-50 p-2">
                              {tip}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </Card>
                ) : null}
              </div>
            )
          ) : currentSession && !currentSession.overall_feedback ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Badge variant="outline">
                  Question {currentQuestionIdx + 1} of {currentSession.questions.length}
                </Badge>
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

                  <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                    {currentQuestion.feedback}
                  </div>

                  <div className="mt-4 flex justify-end">
                    {currentQuestionIdx < currentSession.questions.length - 1 ? (
                      <Button
                        onClick={() => {
                          setCurrentQuestionIdx((prev) => prev + 1);
                          setAnswer("");
                        }}
                      >
                        Next Question
                      </Button>
                    ) : (
                      <Button onClick={() => generateOverallFeedback(currentSession.questions)}>
                        Finish Session
                      </Button>
                    )}
                  </div>
                </Card>
              ) : (
                <>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Your Answer:
                    </label>
                    <Textarea
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      placeholder="Type your answer here..."
                      rows={6}
                      className="resize-none"
                    />
                  </div>

                  <RealTimeCoach
                    answer={answer}
                    question={currentQuestion?.question}
                    isAnalyzing={analyzingAnswer}
                  />

                  <div className="flex items-center justify-between gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setShowSessionNotes((prev) => !prev)}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Session Notes
                    </Button>

                    <Button
                      onClick={submitAnswer}
                      disabled={analyzingAnswer || !answer.trim()}
                      className="w-full max-w-xs"
                    >
                      {analyzingAnswer ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        "Submit Answer"
                      )}
                    </Button>
                  </div>

                  {showSessionNotes ? (
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Session Notes
                      </label>
                      <Textarea
                        value={sessionNotes}
                        onChange={(e) => setSessionNotes(e.target.value)}
                        rows={4}
                        placeholder="Add any notes from this practice session..."
                      />
                    </div>
                  ) : null}
                </>
              )}

              <JobApplicationQuestions client={client} currentSession={currentSession} />
            </div>
          ) : currentSession?.overall_feedback ? (
            <div className="space-y-4">
              <Card className="border-slate-100 p-4">
                <div className="mb-2 flex items-center gap-2 font-medium text-slate-900">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Session Complete
                </div>
                <p className="text-sm text-slate-700">{currentSession.overall_feedback}</p>
              </Card>

              {Array.isArray(currentSession.improvement_tips) &&
              currentSession.improvement_tips.length > 0 ? (
                <Card className="border-slate-100 p-4">
                  <div className="mb-2 font-medium text-slate-900">Improvement Tips</div>
                  <ul className="space-y-2 text-sm text-slate-700">
                    {currentSession.improvement_tips.map((tip, idx) => (
                      <li key={`${tip}-${idx}`} className="rounded bg-slate-50 p-2">
                        {tip}
                      </li>
                    ))}
                  </ul>
                </Card>
              ) : null}

              <div className="flex justify-end">
                <Button onClick={closeSessionDialog}>Close</Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
