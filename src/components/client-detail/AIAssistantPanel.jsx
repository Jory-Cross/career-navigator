import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Sparkles, FileText, ListChecks, Mail, TrendingUp,
  Loader2, Copy, CheckCheck, AlertTriangle, ChevronDown, ChevronUp,
  Database, Eye, EyeOff
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import SourceProvenancePanel from "@/components/shared/SourceProvenancePanel";
import GroundingSummary from "./GroundingSummary";

const PRIORITY_COLORS = {
  high: "bg-red-100 text-red-700 border-red-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  low: "bg-slate-100 text-slate-600 border-slate-200"
};

const TREND_COLORS = {
  Improving: "bg-green-100 text-green-700",
  Declining: "bg-red-100 text-red-700",
  Steady: "bg-blue-100 text-blue-700",
  Inconsistent: "bg-amber-100 text-amber-700",
  "New Client": "bg-purple-100 text-purple-700"
};

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} className="p-1.5 hover:bg-slate-100 rounded transition-colors" title="Copy">
      {copied ? <CheckCheck className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-slate-400" />}
    </button>
  );
}

function SummaryResult({ data }) {
  return (
    <div className="space-y-4">
      <div className="p-4 bg-slate-50 rounded-lg">
        <p className="text-sm text-slate-700 leading-relaxed">{data.overview}</p>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Engagement</span>
        <Badge className={cn("text-xs font-medium", data.engagement_level === "High" ? "bg-green-100 text-green-700" : data.engagement_level === "Medium" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700")}>
          {data.engagement_level}
        </Badge>
        <span className="text-xs text-slate-500">{data.engagement_reasoning}</span>
      </div>
      {data.highlights?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">✅ Highlights</p>
          <ul className="space-y-1">
            {data.highlights.map((h, i) => <li key={i} className="text-sm text-slate-700 flex gap-2"><span className="text-green-500 shrink-0">•</span>{h}</li>)}
          </ul>
        </div>
      )}
      {data.concerns?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">⚠️ Concerns</p>
          <ul className="space-y-1">
            {data.concerns.map((c, i) => <li key={i} className="text-sm text-slate-700 flex gap-2"><span className="text-amber-500 shrink-0">•</span>{c}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

function TasksResult({ data, clientId, onRefresh }) {
  const [adding, setAdding] = useState(null);
  const handleAddTask = async (task) => {
    setAdding(task.title);
    try {
      const dueDate = task.suggested_due_in_days
        ? new Date(Date.now() + task.suggested_due_in_days * 86400000).toISOString().split('T')[0]
        : null;
      await base44.entities.Task.create({
        title: task.title,
        description: task.description,
        priority: task.priority || 'medium',
        category: task.category || 'follow_up',
        status: 'pending',
        client_ids: [clientId],
        ...(dueDate ? { due_date: dueDate } : {})
      });
      toast.success("Task added!");
      if (onRefresh) onRefresh();
    } catch {
      toast.error("Failed to add task");
    } finally {
      setAdding(null);
    }
  };

  return (
    <div className="space-y-3">
      {data.suggested_tasks?.map((task, i) => (
        <div key={i} className="border border-slate-200 rounded-lg p-4 bg-white">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <p className="font-medium text-slate-900 text-sm">{task.title}</p>
                <span className={cn("text-xs px-2 py-0.5 rounded border font-medium", PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium)}>
                  {task.priority}
                </span>
              </div>
              <p className="text-sm text-slate-600">{task.description}</p>
              {task.suggested_due_in_days && (
                <p className="text-xs text-slate-400 mt-1.5">
                  Suggested: within {task.suggested_due_in_days} days
                </p>
              )}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleAddTask(task)}
              disabled={adding === task.title}
              className="shrink-0 text-xs"
            >
              {adding === task.title ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "+ Add"}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function EmailResult({ data, onUseEmail }) {
  const fullEmail = `Subject: ${data.subject}\n\n${data.body}`;
  return (
    <div className="space-y-3">
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-200">
          <span className="text-xs text-slate-500 font-medium">Subject</span>
          <CopyButton text={data.subject} />
        </div>
        <p className="px-4 py-2.5 text-sm font-medium text-slate-900">{data.subject}</p>
      </div>
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-200">
          <span className="text-xs text-slate-500 font-medium">Body</span>
          <CopyButton text={data.body} />
        </div>
        <p className="px-4 py-3 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{data.body}</p>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" className="text-xs" onClick={() => { navigator.clipboard.writeText(fullEmail); toast.success("Email copied!"); }}>
          <Copy className="w-3.5 h-3.5 mr-1" /> Copy All
        </Button>
        {onUseEmail && (
          <Button size="sm" className="text-xs" onClick={() => onUseEmail(data.subject, data.body)}>
            <Mail className="w-3.5 h-3.5 mr-1" /> Open in Email Composer
          </Button>
        )}
      </div>
    </div>
  );
}

function InsightsResult({ data }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
        <span className="text-xs font-medium text-slate-500">Trend</span>
        <Badge className={cn("text-xs", TREND_COLORS[data.trend] || "bg-slate-100 text-slate-600")}>{data.trend}</Badge>
        <p className="text-sm text-slate-600 flex-1">{data.trend_detail}</p>
      </div>
      <div>
        <p className="text-sm text-slate-500 leading-relaxed">{data.activity_pattern}</p>
      </div>
      {data.effective_supports?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">💪 What's Working</p>
          <ul className="space-y-1">
            {data.effective_supports.map((s, i) => <li key={i} className="text-sm text-slate-700 flex gap-2"><span className="text-green-500 shrink-0">•</span>{s}</li>)}
          </ul>
        </div>
      )}
      {data.risk_signals?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">🚨 Risk Signals</p>
          <ul className="space-y-1">
            {data.risk_signals.map((r, i) => <li key={i} className="text-sm text-slate-700 flex gap-2"><span className="text-red-500 shrink-0">•</span>{r}</li>)}
          </ul>
        </div>
      )}
      {data.recommendations?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">💡 Recommendations</p>
          <ul className="space-y-1">
            {data.recommendations.map((r, i) => <li key={i} className="text-sm text-slate-700 flex gap-2"><span className="text-blue-500 shrink-0">•</span>{r}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

function CoachingResult({ data, clientId, onRefresh, onSave }) {
  return (
    <div className="space-y-4">
      {data.coaching_priorities?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">🎯 Coaching Priorities</p>
          <ul className="space-y-1">
            {data.coaching_priorities.map((p, i) => <li key={i} className="text-sm text-slate-700 flex gap-2"><span className="text-blue-500 shrink-0">•</span>{p}</li>)}
          </ul>
        </div>
      )}
      {data.job_search_strategy && (
        <div>
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">🔍 Job Search Strategy</p>
          <p className="text-sm text-slate-700">{data.job_search_strategy}</p>
        </div>
      )}
      {data.skill_gaps?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">📈 Skill Gaps</p>
          <ul className="space-y-1">
            {data.skill_gaps.map((g, i) => <li key={i} className="text-sm text-slate-700 flex gap-2"><span className="text-amber-500 shrink-0">•</span>{g}</li>)}
          </ul>
        </div>
      )}
      {data.recommended_accommodations?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">♿ Accommodations</p>
          <ul className="space-y-1">
            {data.recommended_accommodations.map((a, i) => <li key={i} className="text-sm text-slate-700 flex gap-2"><span className="text-green-500 shrink-0">•</span>{a}</li>)}
          </ul>
        </div>
      )}
      {data.job_recommendations?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">💼 Job Recommendations</p>
          <div className="space-y-2">
            {data.job_recommendations.map((j, i) => (
              <div key={i} className="p-2 bg-slate-50 rounded text-sm">
                <p className="font-medium text-slate-900">{j.job_title}</p>
                <p className="text-xs text-slate-600 mt-0.5">{j.why_fit}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {data.next_coaching_session_focus && (
        <div>
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">📌 Next Session Focus</p>
          <p className="text-sm text-slate-700">{data.next_coaching_session_focus}</p>
        </div>
      )}
      <div className="flex gap-2 pt-2">
        <Button size="sm" variant="outline" onClick={() => onSave?.(data)} className="text-xs flex-1">
          <CheckCheck className="w-3.5 h-3.5 mr-1" /> Save Plan
        </Button>
      </div>
    </div>
  );
}

export default function AIAssistantPanel({ clientId, onUseEmail, onRefresh }) {
  const [activeTab, setActiveTab] = useState("summarize");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [results, setResults] = useState({});
  const [emailPurpose, setEmailPurpose] = useState("");
  const [emailContext, setEmailContext] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [groundingCollapsed, setGroundingCollapsed] = useState(true);
  const [showGrounding, setShowGrounding] = useState(false);

  const run = async (action, extra = {}) => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke("clientAIAssistant", {
        action,
        clientId,
        ...extra
      });
      setResults(prev => ({ ...prev, [action]: res.data.data }));
    } catch (e) {
      toast.error("AI assistant error: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const saveCoachingPlan = async (data) => {
    setSaving(true);
    try {
      await base44.functions.invoke("clientAIAssistant", {
        action: 'save_coaching_plan',
        clientId,
        coaching_priorities: data.coaching_priorities,
        job_search_strategy: data.job_search_strategy,
        recommended_accommodations: data.recommended_accommodations,
        next_session_focus: data.next_coaching_session_focus
      });
      toast.success("Coaching plan saved to Documents!");
      if (onRefresh) onRefresh();
    } catch (e) {
      toast.error("Failed to save: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const actionModes = [
    { key: "summarize", label: "Summarize Client", icon: FileText, description: "AI-generated overview" },
    { key: "suggest_tasks", label: "Next Steps", icon: ListChecks, description: "Follow-up actions" },
    { key: "draft_email", label: "Draft Outreach", icon: Mail, description: "Personalized message" },
    { key: "engagement_insights", label: "Engagement Insights", icon: TrendingUp, description: "Pattern analysis" },
    { key: "coaching_recommendations", label: "Coaching Ideas", icon: Sparkles, description: "Job coaching" },
    { key: "provenance", label: "Data Sources", icon: Database, description: "View grounding" },
  ];

  return (
    <Card className="border border-purple-200/60 bg-gradient-to-br from-purple-50/40 via-white to-blue-50/30 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-purple-100/60">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-sm">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="font-semibold text-slate-900 text-sm">AI Assistant</p>
            <p className="text-xs text-slate-400">Data-grounded insights</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowGrounding(!showGrounding)}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1"
            title="Toggle data grounding"
          >
            {showGrounding ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
          <button onClick={() => setCollapsed(c => !c)} className="text-slate-400 hover:text-slate-600 transition-colors p-1">
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="flex flex-col h-full">
          {/* Grounding Summary (if visible) */}
          {showGrounding && (
            <GroundingSummary
              clientId={clientId}
              isCollapsed={groundingCollapsed}
              onToggle={() => setGroundingCollapsed(c => !c)}
            />
          )}

          <div className="p-4 space-y-3">
            {/* Action Mode Selector */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Choose an action</p>
              <div className="grid grid-cols-2 gap-2">
                {actionModes.map(mode => (
                  <button
                    key={mode.key}
                    onClick={() => setActiveTab(mode.key)}
                    className={cn(
                      "p-2.5 rounded-lg border text-left text-xs transition-all",
                      activeTab === mode.key
                        ? "border-purple-300 bg-purple-50 shadow-sm"
                        : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <mode.icon className={cn("w-3.5 h-3.5 mt-0.5 shrink-0", activeTab === mode.key ? "text-purple-600" : "text-slate-500")} />
                      <div>
                        <p className={cn("font-medium", activeTab === mode.key ? "text-purple-700" : "text-slate-700")}>
                          {mode.label}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">{mode.description}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Tabs for content rendering */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="hidden">
              <TabsList className="hidden" />
            </Tabs>

            {activeTab === "summarize" && (
              <div className="space-y-3 border-t border-slate-100 pt-4">
                <p className="text-xs text-slate-500">AI-generated summary of client notes, history, and current status.</p>
                {results.summarize ? (
                  <SummaryResult data={results.summarize} />
                ) : null}
                <Button size="sm" onClick={() => run("summarize")} disabled={loading} className="w-full text-xs">
                  {loading && activeTab === "summarize" ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <Sparkles className="w-3.5 h-3.5 mr-2" />}
                  {results.summarize ? "Regenerate Summary" : "Generate Summary"}
                </Button>
              </div>
            )}

            {activeTab === "suggest_tasks" && (
              <div className="space-y-3 border-t border-slate-100 pt-4">
                <p className="text-xs text-slate-500">AI-suggested follow-up actions based on recent activity and progress.</p>
                {results.suggest_tasks ? (
                  <TasksResult data={results.suggest_tasks} clientId={clientId} onRefresh={onRefresh} />
                ) : null}
                <Button size="sm" onClick={() => run("suggest_tasks")} disabled={loading} className="w-full text-xs">
                  {loading && activeTab === "suggest_tasks" ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <Sparkles className="w-3.5 h-3.5 mr-2" />}
                  {results.suggest_tasks ? "Re-suggest Tasks" : "Suggest Follow-up Tasks"}
                </Button>
              </div>
            )}

            {activeTab === "draft_email" && (
              <div className="space-y-3 border-t border-slate-100 pt-4">
                <p className="text-xs text-slate-500">Draft a personalized email to this client based on their history.</p>
                <div className="space-y-2">
                  <Label className="text-xs">Email purpose</Label>
                  <Input
                    placeholder="e.g. Follow up on interview, check-in after job fair..."
                    value={emailPurpose}
                    onChange={e => setEmailPurpose(e.target.value)}
                    className="text-xs h-8"
                  />
                  <Label className="text-xs">Additional context (optional)</Label>
                  <Textarea
                    placeholder="Any specific details to include..."
                    value={emailContext}
                    onChange={e => setEmailContext(e.target.value)}
                    className="text-xs min-h-[60px] resize-none"
                  />
                </div>
                {results.draft_email ? (
                  <EmailResult data={results.draft_email} onUseEmail={onUseEmail} />
                ) : null}
                <Button
                  size="sm"
                  onClick={() => run("draft_email", { emailPurpose, emailContext })}
                  disabled={loading}
                  className="w-full text-xs"
                >
                  {loading && activeTab === "draft_email" ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <Sparkles className="w-3.5 h-3.5 mr-2" />}
                  {results.draft_email ? "Regenerate Draft" : "Draft Email"}
                </Button>
              </div>
            )}

            {activeTab === "engagement_insights" && (
              <div className="space-y-3 border-t border-slate-100 pt-4">
                <p className="text-xs text-slate-500">Analyze engagement patterns and get actionable recommendations.</p>
                {results.engagement_insights ? (
                  <InsightsResult data={results.engagement_insights} />
                ) : null}
                <Button size="sm" onClick={() => run("engagement_insights")} disabled={loading} className="w-full text-xs">
                  {loading && activeTab === "engagement_insights" ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <Sparkles className="w-3.5 h-3.5 mr-2" />}
                  {results.engagement_insights ? "Refresh Insights" : "Analyze Engagement"}
                </Button>
              </div>
            )}

            {activeTab === "coaching_recommendations" && (
              <div className="space-y-3 border-t border-slate-100 pt-4">
                <p className="text-xs text-slate-500">AI-generated job coaching strategy based on vocational profile and client data.</p>
                {results.coaching_recommendations ? (
                  <CoachingResult 
                    data={results.coaching_recommendations}
                    clientId={clientId}
                    onRefresh={onRefresh}
                    onSave={saveCoachingPlan}
                  />
                ) : null}
                <Button size="sm" onClick={() => run("coaching_recommendations")} disabled={loading} className="w-full text-xs">
                  {loading && activeTab === "coaching_recommendations" ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <Sparkles className="w-3.5 h-3.5 mr-2" />}
                  {results.coaching_recommendations ? "Regenerate Coaching Plan" : "Generate Coaching Plan"}
                </Button>
              </div>
            )}

            {activeTab === "provenance" && (
              <div className="space-y-3 border-t border-slate-100 pt-4">
                <p className="text-xs text-slate-500">View data sources, quality metrics, and conflicts in the underlying client data used for AI insights.</p>
                <SourceProvenancePanel variant="inline" />
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}