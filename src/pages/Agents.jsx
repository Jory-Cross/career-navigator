import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Bot, Send, Loader2, MessageSquare, Users, Briefcase, ClipboardList, Mic } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const AGENTS = [
  {
    key: "job_application_manager",
    name: "Job Application Manager",
    description: "Manage client pipelines, track applications, and identify who needs follow-up",
    icon: Briefcase,
    color: "from-blue-500 to-blue-600",
    badge: "Staff",
    badgeColor: "bg-blue-100 text-blue-700"
  },
  {
    key: "career_coach",
    name: "Career Coach",
    description: "Help clients navigate their job search, track applications, and stay motivated",
    icon: Users,
    color: "from-emerald-500 to-emerald-600",
    badge: "Clients",
    badgeColor: "bg-emerald-100 text-emerald-700"
  },
  {
    key: "interview_prep_coach",
    name: "Interview Prep Coach",
    description: "Practice interview questions, get feedback, and build interview confidence",
    icon: Mic,
    color: "from-violet-500 to-violet-600",
    badge: "Clients",
    badgeColor: "bg-violet-100 text-violet-700"
  },
  {
    key: "onboarding_assistant",
    name: "Onboarding Assistant",
    description: "Guide new clients through onboarding steps and manage onboarding progress",
    icon: ClipboardList,
    color: "from-amber-500 to-amber-600",
    badge: "Staff & Clients",
    badgeColor: "bg-amber-100 text-amber-700"
  }
];

function AgentChat({ agentKey, agentName, userId, systemContext }) {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (userId) initConversation();
  }, [agentKey, userId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const initConversation = async () => {
    setInitializing(true);
    try {
      const storageKey = `staff_agent_conv_v2_${agentKey}_${userId}`;
      const savedConvId = localStorage.getItem(storageKey);
      let conv = null;
      if (savedConvId) {
        try {
          conv = await base44.agents.getConversation(savedConvId);
          if (!conv || conv.metadata?.user_id !== userId) conv = null;
        } catch {
          conv = null;
        }
      }
      if (!conv) {
        conv = await base44.agents.createConversation({
          agent_name: agentKey,
          metadata: { name: `${agentName} session`, user_id: userId }
        });
        localStorage.setItem(storageKey, conv.id);
      }
      setConversation(conv);
      setMessages(conv.messages || []);
      base44.agents.subscribeToConversation(conv.id, (data) => {
        setMessages(data.messages || []);
      });
    } catch (error) {
      toast.error("Failed to start conversation");
    } finally {
      setInitializing(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || loading || !conversation) return;
    const text = input.trim();
    setInput("");
    setLoading(true);
    // Prepend staff context on first message so agent knows who it's talking to
    const hasUserMessage = messages.some(m => m.role === "user");
    const content = (!hasUserMessage && systemContext)
      ? `[SYSTEM CONTEXT - do not repeat this back to the user: ${systemContext}]\n\n${text}`
      : text;
    try {
      await base44.agents.addMessage(conversation, { role: "user", content });
    } catch (error) {
      toast.error("Failed to send message");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (initializing) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Starting conversation...
      </div>
    );
  }

  const visibleMessages = messages
    .filter(m => m.role !== "system")
    .map(m => {
      if (m.role === "user" && m.content?.includes("[SYSTEM CONTEXT")) {
        return { ...m, content: m.content.replace(/\[SYSTEM CONTEXT[^\]]*\][^\n]*\n\n/, "") };
      }
      return m;
    });

  return (
    <div className="flex flex-col h-[500px]">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {visibleMessages.length === 0 && (
          <div className="text-center text-sm text-slate-400 py-8">
            Send a message to get started
          </div>
        )}
        {visibleMessages.map((msg, idx) => (
          <div key={idx} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
            {msg.role !== "user" && (
              <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center mr-2 mt-0.5 shrink-0">
                <Bot className="w-4 h-4 text-slate-500" />
              </div>
            )}
            <div className={cn(
              "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm",
              msg.role === "user"
                ? "bg-slate-800 text-white"
                : "bg-white border border-slate-200"
            )}>
              {msg.role === "user" ? (
                <p>{msg.content}</p>
              ) : (
                <ReactMarkdown className="prose prose-sm prose-slate max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                  {msg.content || "..."}
                </ReactMarkdown>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center mr-2 mt-0.5">
              <Bot className="w-4 h-4 text-slate-500" />
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3">
              <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="border-t border-slate-100 p-3 flex gap-2">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          className="flex-1"
          disabled={loading}
        />
        <Button size="icon" onClick={sendMessage} disabled={loading || !input.trim()}>
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

export default function AgentsPage() {
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const getSystemContext = (agentKey) => {
    if (!user) return null;
    // Always inject staff identity for all agents when accessed from the staff Agents page
    return `You are speaking with ${user.full_name}, a staff member (role: ${user.role}) at a vocational rehabilitation / employment services organization. They are NOT a client or job seeker. Address them as a professional colleague. Do not assume they are any client such as Anthony or any other client you may have context about.`;
  };

  const selectedAgentConfig = AGENTS.find(a => a.key === selectedAgent);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">AI Agents</h1>
        <p className="text-sm text-slate-500 mt-1">Intelligent assistants to help with career management tasks</p>
      </div>

      {!selectedAgent ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {AGENTS.map(agent => {
            const Icon = agent.icon;
            const whatsappUrl = base44.agents.getWhatsAppConnectURL(agent.key);
            return (
              <Card key={agent.key} className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className={cn("w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center shrink-0", agent.color)}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-slate-900 text-sm">{agent.name}</h3>
                        <Badge className={cn("text-xs", agent.badgeColor)}>{agent.badge}</Badge>
                      </div>
                      <p className="text-xs text-slate-500 mb-3">{agent.description}</p>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => setSelectedAgent(agent.key)}>
                          <MessageSquare className="w-3.5 h-3.5 mr-1" /> Chat
                        </Button>
                        <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="outline" className="text-green-700 border-green-200 hover:bg-green-50">
                            💬 WhatsApp
                          </Button>
                        </a>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {selectedAgentConfig && (
                  <div className={cn("w-9 h-9 rounded-lg bg-gradient-to-br flex items-center justify-center", selectedAgentConfig.color)}>
                    <selectedAgentConfig.icon className="w-5 h-5 text-white" />
                  </div>
                )}
                <div>
                  <CardTitle className="text-base">{selectedAgentConfig?.name}</CardTitle>
                  <p className="text-xs text-slate-400">{selectedAgentConfig?.description}</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedAgent(null)}>← Back</Button>
            </div>
          </CardHeader>
          <AgentChat agentKey={selectedAgent} agentName={selectedAgentConfig?.name} userId={user?.id} systemContext={getSystemContext(selectedAgent)} />
        </Card>
      )}
    </div>
  );
}