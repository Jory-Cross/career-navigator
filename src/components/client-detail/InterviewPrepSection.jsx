import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Lightbulb, Sparkles, Loader2, MessageSquare, Target, CheckCircle2, Tag, FileText } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import RealTimeCoach from "@/components/interview/RealTimeCoach";
import SkillTracker from "@/components/interview/SkillTracker";
import JobApplicationQuestions from "@/components/interview/JobApplicationQuestions";

export default function InterviewPrepSection({ client }) {
  const [sessions, setSessions] = useState([]);
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
  const [applications, setApplications] = useState([]);
  const [jobDropdownOpen, setJobDropdownOpen] = useState(false);
  const jobDropdownRef = React.useRef(null);

  React.useEffect(() => {
    const handleClickOutside = (e) => {
      if (jobDropdownRef.current && !jobDropdownRef.current.contains(e.target)) {
        setJobDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
    { question: "Do you have any questions for us?", category: "Engagement" }
  ];

  useEffect(() => {
    loadSessions();
    loadApplications();
  }, [client.id]);

  const loadApplications = async () => {
    try {
      const apps = await base44.entities.JobApplication.filter({ client_id: client.id });
      setApplications(apps.filter(a => a.status !== 'rejected' && a.status !== 'withdrawn'));
    } catch (error) {
      // Silent fail
    }
  };

  const loadSessions = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.InterviewSession.filter({ client_id: client.id });
      setSessions(data.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
    } catch (error) {
      toast.error("Failed to load sessions");
    } finally {
      setLoading(false);
    }
  };

  const reviewSession = (session) => {
    setCurrentSession(session);
    setCurrentQuestionIdx(0);
    setReviewMode(true);
    setShowSession(true);
  };

  const startNewSession = async (useWSA = false, jobApplicationId = null) => {
    if (!client.target_role) {
      toast.error("Please set a target role for the client first");
      return;
    }

    setGenerating(true);
    setShowSession(true);
    setReviewMode(false);
    setIsWSA(useWSA);

    try {
      let questions;
      let jobApp = null;

      // If job application is provided, fetch it for context
      if (jobApplicationId) {
        jobApp = applications.find(a => a.id === jobApplicationId);
      }
      
      if (useWSA) {
        questions = WSA_QUESTIONS.map(q => ({
          question: q.question,
          category: q.category,
          answer: "",
          feedback: "",
          score: null
        }));
      } else if (jobApp) {
        const prompt = `Generate 5 tailored interview questions for someone applying for a ${jobApp.position} position at ${jobApp.company}.

Company role: ${client.target_role}
${jobApp.ai_fit_analysis ? `Context: ${jobApp.ai_fit_analysis}` : ""}

Focus on:
1. Role-specific challenges at this company
2. Why they want to work there
3. Relevant experience and skills
4. Problem-solving for company's context
5. Cultural fit

For each question, categorize it appropriately.`;

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

        questions = result.questions.map(q => ({
          question: q.question,
          category: q.category,
          answer: "",
          feedback: "",
          score: null
        }));
      } else {
        const prompt = `Generate 5 common interview questions for someone applying for a ${client.target_role} position in the ${client.industry || "general"} industry.

Include a mix of:
1. Behavioral questions (STAR method)
2. Technical/role-specific questions
3. Situational questions
4. Questions about experience and skills

For each question, categorize it (e.g., "Behavioral", "Technical", "Situational").`;

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

        questions = result.questions.map(q => ({
          question: q.question,
          category: q.category,
          answer: "",
          feedback: "",
          score: null
        }));
      }

      const session = await base44.entities.InterviewSession.create({
        client_id: client.id,
        job_application_id: jobApplicationId || undefined,
        target_role: jobApp?.position || client.target_role,
        industry: jobApp?.location || client.industry || "",
        company: jobApp?.company,
        questions,
        session_date: new Date().toISOString().split('T')[0],
        session_type: useWSA ? "WSA" : "practice"
      });

      setCurrentSession(session);
      setCurrentQuestionIdx(0);
      setAnswer("");
    } catch (error) {
      toast.error("Failed to start session");
      setShowSession(false);
    } finally {
      setGenerating(false);
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
      
      const prompt = `You are an interview coach. Evaluate this candidate's answer to the interview question.

Question: ${question.question}
Category: ${question.category}
Answer: ${answer}

Provide:
1. A score from 0-100 (where 100 is excellent)
2. Detailed feedback on:
   - Clarity and structure
   - Relevance to the question
   - Use of specific examples and keywords
   - Areas for improvement
   
Be constructive and specific.`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            score: { type: "number" },
            feedback: { type: "string" }
          }
        }
      });

      // Update the session with the answer and feedback
      const updatedQuestions = [...currentSession.questions];
      updatedQuestions[currentQuestionIdx] = {
        ...updatedQuestions[currentQuestionIdx],
        answer,
        feedback: result.feedback,
        score: result.score
      };

      await base44.entities.InterviewSession.update(currentSession.id, {
        questions: updatedQuestions
      });

      setCurrentSession(prev => ({
        ...prev,
        questions: updatedQuestions
      }));

      // Move to next question or finish
      if (currentQuestionIdx < currentSession.questions.length - 1) {
        setCurrentQuestionIdx(currentQuestionIdx + 1);
        setAnswer("");
        toast.success("Answer submitted!");
      } else {
        // Generate overall feedback
        await generateOverallFeedback(updatedQuestions);
      }

    } catch (error) {
      toast.error("Failed to analyze answer");
    } finally {
      setAnalyzingAnswer(false);
    }
  };

  const generateOverallFeedback = async (questions) => {
    try {
      const prompt = `Based on these interview practice responses, provide:
1. Overall performance summary
2. Top 3 personalized improvement tips

Questions and Scores:
${questions.map((q, i) => `${i + 1}. ${q.question}\nScore: ${q.score}/100\nFeedback: ${q.feedback}`).join('\n\n')}`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            overall_feedback: { type: "string" },
            improvement_tips: {
              type: "array",
              items: { type: "string" }
            }
          }
        }
      });

      await base44.entities.InterviewSession.update(currentSession.id, {
        overall_feedback: result.overall_feedback,
        improvement_tips: result.improvement_tips,
        notes: sessionNotes
      });

      // Create activity log entry
      const avgScore = Math.round(questions.reduce((sum, q) => sum + (q.score || 0), 0) / questions.length);
      await base44.entities.Activity.create({
        client_id: client.id,
        activity_type: "interview_prep",
        title: `${isWSA ? "WSA" : "Practice"} Interview Completed`,
        description: `Completed interview session with ${questions.length} questions. Average score: ${avgScore}%`,
        metadata: {
          session_id: currentSession.id,
          session_type: isWSA ? "WSA" : "practice",
          average_score: avgScore,
          questions_count: questions.length
        }
      });

      setCurrentSession(prev => ({
        ...prev,
        overall_feedback: result.overall_feedback,
        improvement_tips: result.improvement_tips
      }));

      toast.success("Session completed!");
      loadSessions();
    } catch (error) {
      toast.error("Failed to generate feedback");
    }
  };

  const currentQuestion = currentSession?.questions?.[currentQuestionIdx];
  const avgScore = sessions.length > 0 
    ? Math.round(sessions.reduce((sum, s) => {
        const sessionAvg = s.questions?.reduce((qSum, q) => qSum + (q.score || 0), 0) / (s.questions?.length || 1);
        return sum + sessionAvg;
      }, 0) / sessions.length)
    : 0;

  return (
    <>
      <Card className="border-0 shadow-sm">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-violet-600" />
            <h3 className="text-sm font-semibold text-slate-800">Interview Preparation</h3>
          </div>
          <div className="flex gap-2">
            {applications.length > 0 && (
              <div className="relative group">
                <Button size="sm" variant="outline">
                  <FileText className="w-3.5 h-3.5 mr-1" /> Job-Specific
                </Button>
                <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-slate-200 z-10 hidden group-hover:block min-w-max">
                  {applications.map(app => (
                    <button
                      key={app.id}
                      onClick={() => startNewSession(false, app.id)}
                      className="block w-full text-left px-3 py-2 text-xs hover:bg-slate-50 border-b last:border-b-0"
                    >
                      {app.company} - {app.position}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <Button size="sm" onClick={() => startNewSession(true)}>
              <Sparkles className="w-3.5 h-3.5 mr-1" /> WSA Interview
            </Button>
            <Button size="sm" variant="outline" onClick={() => startNewSession(false)}>
              <Sparkles className="w-3.5 h-3.5 mr-1" /> AI Practice
            </Button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Skill Tracker */}
          {sessions.length > 0 && <SkillTracker clientId={client.id} />}

          {sessions.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="text-sm text-slate-500 mb-1">No practice sessions yet</p>
              <p className="text-xs text-slate-400">Generate AI questions and practice your answers</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-violet-50 rounded-lg">
                <span className="text-sm text-violet-700">Average Score</span>
                <span className="text-lg font-bold text-violet-700">{avgScore}%</span>
              </div>
              
              {sessions.slice(0, 3).map(session => {
                const sessionAvg = session.questions 
                  ? Math.round(session.questions.reduce((sum, q) => sum + (q.score || 0), 0) / session.questions.length)
                  : 0;

                return (
                  <div 
                    key={session.id} 
                    onClick={() => reviewSession(session)}
                    className="border border-slate-200 rounded-lg p-3 cursor-pointer hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-sm font-medium text-slate-800">{session.target_role}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-xs text-slate-500">{session.questions?.length || 0} questions</p>
                          {session.company && <Badge variant="outline" className="text-xs">{session.company}</Badge>}
                          {session.tags && session.tags.length > 0 && (
                            <div className="flex gap-1">
                              {session.tags.map((tag, idx) => (
                                <Badge key={idx} variant="secondary" className="text-xs">{tag}</Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <Badge className={cn(
                        "text-xs",
                        sessionAvg >= 80 ? "bg-green-100 text-green-700" :
                        sessionAvg >= 60 ? "bg-blue-100 text-blue-700" :
                        "bg-amber-100 text-amber-700"
                      )}>
                        {sessionAvg}%
                      </Badge>
                    </div>
                    {session.improvement_tips && session.improvement_tips.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {session.improvement_tips.slice(0, 2).map((tip, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-xs text-slate-600">
                            <Lightbulb className="w-3 h-3 text-amber-500 mt-0.5 shrink-0" />
                            <span>{tip}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      <Dialog open={showSession} onOpenChange={setShowSession}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-violet-600" />
              {isWSA ? "WSA Interview" : "Interview Practice Session"}
            </DialogTitle>
          </DialogHeader>

          {generating ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
              <p className="text-sm text-slate-500">{isWSA ? "Loading WSA Interview..." : "Generating interview questions..."}</p>
            </div>
          ) : reviewMode ? (
            <div className="py-4">
              <div className="flex items-center justify-between mb-4">
                <Badge variant="outline">
                  Question {currentQuestionIdx + 1} of {currentSession.questions.length}
                </Badge>
                <Badge className="bg-violet-100 text-violet-700">
                  {currentQuestion?.category}
                </Badge>
              </div>

              <div className="bg-slate-50 rounded-lg p-4 mb-4">
                <p className="text-sm font-medium text-slate-800">{currentQuestion?.question}</p>
              </div>

              {currentQuestion?.answer && (
                <div className="space-y-4 mb-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <span className="text-sm font-medium text-slate-800">Your Answer</span>
                    <Badge className="bg-blue-100 text-blue-700">
                      <Target className="w-3 h-3 mr-1" />
                      {currentQuestion.score}%
                    </Badge>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3 mb-3">
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{currentQuestion.answer}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-600 mb-2">Feedback:</p>
                    <div className="bg-amber-50 rounded-lg p-3">
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">{currentQuestion.feedback}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {currentQuestionIdx > 0 && (
                      <Button variant="outline" onClick={() => setCurrentQuestionIdx(currentQuestionIdx - 1)}>
                        Previous
                      </Button>
                    )}
                    {currentQuestionIdx < currentSession.questions.length - 1 && (
                      <Button onClick={() => setCurrentQuestionIdx(currentQuestionIdx + 1)}>
                        Next
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : currentSession && !currentSession.overall_feedback ? (
            <div className="py-4">
              <div className="flex items-center justify-between mb-4">
                <Badge variant="outline">
                  Question {currentQuestionIdx + 1} of {currentSession.questions.length}
                </Badge>
                <Badge className="bg-violet-100 text-violet-700">
                  {currentQuestion?.category}
                </Badge>
              </div>

              <div className="bg-slate-50 rounded-lg p-4 mb-4">
                <p className="text-sm font-medium text-slate-800">{currentQuestion?.question}</p>
              </div>

              {currentQuestion?.feedback ? (
                <div className="space-y-4 mb-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <span className="text-sm font-medium text-slate-800">Answer Submitted</span>
                    <Badge className="bg-blue-100 text-blue-700">
                      <Target className="w-3 h-3 mr-1" />
                      {currentQuestion.score}%
                    </Badge>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3">
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{currentQuestion.feedback}</p>
                  </div>
                  {currentQuestionIdx < currentSession.questions.length - 1 ? (
                    <Button onClick={() => { setCurrentQuestionIdx(currentQuestionIdx + 1); setAnswer(""); }}>
                      Next Question
                    </Button>
                  ) : (
                    <Button onClick={() => generateOverallFeedback(currentSession.questions)}>
                      Finish Session
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                   <div>
                    <label className="text-sm font-medium text-slate-700 mb-2 block">Your Answer:</label>
                    <Textarea
                      value={answer}
                      onChange={e => setAnswer(e.target.value)}
                      placeholder="Type your answer here..."
                      rows={6}
                      className="resize-none"
                    />
                    {/* Real-time Coach Feedback */}
                    <RealTimeCoach 
                      answer={answer}
                      question={currentQuestion?.question}
                      isAnalyzing={analyzingAnswer}
                    />
                  </div>
                  <Button 
                    onClick={submitAnswer} 
                    disabled={analyzingAnswer || !answer.trim()}
                    className="w-full"
                  >
                    {analyzingAnswer ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      "Submit Answer"
                    )}
                  </Button>
                </div>
              )}
            </div>
          ) : currentSession?.overall_feedback ? (
            <div className="py-4 space-y-4">
              <div className="text-center">
                <CheckCircle2 className="w-12 h-12 mx-auto text-green-600 mb-3" />
                <h3 className="text-lg font-semibold text-slate-800 mb-2">Session Complete!</h3>
              </div>

              <div className="bg-slate-50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-slate-800 mb-2">Overall Performance:</h4>
                <p className="text-sm text-slate-600 whitespace-pre-wrap">{currentSession.overall_feedback}</p>
              </div>

              <div className="bg-amber-50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-amber-600" />
                  Improvement Tips:
                </h4>
                <ul className="space-y-2">
                  {currentSession.improvement_tips?.map((tip, idx) => (
                    <li key={idx} className="text-sm text-slate-600 flex items-start gap-2">
                      <span className="text-amber-600 font-bold">{idx + 1}.</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {!showSessionNotes ? (
                <Button 
                  variant="outline" 
                  onClick={() => setShowSessionNotes(true)}
                  className="w-full"
                >
                  <FileText className="w-4 h-4 mr-2" /> Add Session Notes
                </Button>
              ) : (
                <div className="space-y-2">
                  <Textarea
                    value={sessionNotes}
                    onChange={(e) => setSessionNotes(e.target.value)}
                    placeholder="Add notes about this session, areas to focus on, etc..."
                    rows={3}
                    className="resize-none text-xs"
                  />
                  <Button 
                    onClick={() => setShowSessionNotes(false)}
                    size="sm"
                    className="w-full"
                  >
                    Done
                  </Button>
                </div>
              )}

              <Button onClick={() => { setShowSession(false); setCurrentSession(null); setReviewMode(false); setSessionNotes(""); }} className="w-full">
                Close
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}