import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, Send, Loader2, Trash2, AlertCircle, CheckCircle, Info } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function AgentChatEmbed({ agentKey, title, description, clientId }) {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [grounding, setGrounding] = useState(null);
  const [groundingLoading, setGroundingLoading] = useState(false);
  const [showGrounding, setShowGrounding] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    initConversation();
    loadGrounding();
  }, [agentKey, clientId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadGrounding = async () => {
    if (!clientId) return;
    setGroundingLoading(true);
    try {
      const res = await base44.functions.invoke('agentContextGrounding', { clientId });
      if (res?.data?.success) {
        setGrounding(res.data);
      }
    } catch (e) {
      console.error('Error loading grounding:', e);
    } finally {
      setGroundingLoading(false);
    }
  };

  const initConversation = async () => {
    setInitializing(true);
    try {
      const storageKey = `agent_conv_v2_${agentKey}_${clientId || 'anonymous'}`;
      const savedConvId = localStorage.getItem(storageKey);
      let conv = null;
      if (savedConvId) {
        try {
          conv = await base44.agents.getConversation(savedConvId);
          if (conv && clientId && conv.metadata?.client_id !== clientId) conv = null;
        } catch {
          conv = null;
        }
      }
      if (!conv) {
        conv = await base44.agents.createConversation({
          agent_name: agentKey,
          metadata: { name: `${title} session`, client_id: clientId }
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
    try {
      // Send clean message without context injection
      // Context is handled server-side via agentContextGrounding
      await base44.agents.addMessage(conversation, { role: "user", content: text });
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

  const clearConversation = async () => {
    const storageKey = `agent_conv_v2_${agentKey}_${clientId || 'anonymous'}`;
    localStorage.removeItem(storageKey);
    setMessages([]);
    setConversation(null);
    await initConversation();
  };

  const visibleMessages = messages.filter(m => m.role !== "system");

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-base">{title}</CardTitle>
            {description && <p className="text-xs text-slate-400">{description}</p>}
          </div>
          <div className="flex items-center gap-1.5">
            {grounding && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowGrounding(!showGrounding)}
                title="Show grounding context"
                className={cn(
                  "text-slate-400 hover:text-slate-600",
                  showGrounding && "bg-violet-50 text-violet-600"
                )}>
                <Info className="w-4 h-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={clearConversation} title="Clear conversation" className="text-slate-400 hover:text-red-500">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      {/* Grounding context panel */}
      {showGrounding && grounding && (
        <div className="px-4 py-3 border-b border-slate-100 space-y-3 bg-violet-50/50">
          {/* Data quality score */}
          <div className="flex items-center gap-2">
            <div className="text-xs font-semibold text-slate-700">Data Quality:</div>
            <div className="flex-1 bg-white rounded h-1.5 overflow-hidden">
              <div
                className={cn("h-full transition-all",
                  grounding.data_quality_score >= 70 ? "bg-green-500" :
                  grounding.data_quality_score >= 40 ? "bg-amber-500" : "bg-red-500"
                )}
                style={{ width: `${grounding.data_quality_score}%` }}
              />
            </div>
            <span className="text-xs font-medium text-slate-600">{grounding.data_quality_score}%</span>
          </div>

          {/* Data sources */}
          <div>
            <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Data Sources</p>
            <div className="flex flex-wrap gap-1">
              {grounding.sources.map((source, i) => (
                <span key={i} className="text-[10px] bg-white border border-violet-200 text-violet-700 px-2 py-0.5 rounded-full">
                  {source}
                </span>
              ))}
            </div>
          </div>

          {/* Warnings */}
          {grounding.warnings?.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide">Warnings</p>
              {grounding.warnings.map((warn, i) => (
                <div key={i} className={cn("flex items-start gap-2 text-xs p-2 rounded-lg",
                  warn.type === 'critical' ? "bg-red-50 text-red-800 border border-red-200" :
                  warn.type === 'warning' ? "bg-amber-50 text-amber-800 border border-amber-200" :
                  "bg-blue-50 text-blue-800 border border-blue-200"
                )}>
                  {warn.type === 'critical' ? <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" /> : <Info className="w-3 h-3 shrink-0 mt-0.5" />}
                  <span>{warn.message}</span>
                </div>
              ))}
            </div>
          )}

          {/* VFP status */}
          {grounding.grounding.vocational_facts && (
            <div className="bg-white rounded-lg p-2 text-xs border border-violet-100">
              <div className="flex items-center gap-1.5 mb-1.5 text-green-700">
                <CheckCircle className="w-3 h-3" />
                <span className="font-semibold">Vocational Facts Profile</span>
              </div>
              <div className="text-slate-600 space-y-0.5">
                <p>Quality: {grounding.grounding.vocational_facts.quality_score}%</p>
                <p>Extracted: {new Date(grounding.grounding.vocational_facts.extracted_at).toLocaleDateString()}</p>
              </div>
            </div>
          )}
        </div>
      )}
      <CardContent className="p-0">
        <div className="flex flex-col h-[480px]">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {initializing ? (
              <div className="flex items-center justify-center h-full text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin mr-2" /> Starting...
              </div>
            ) : visibleMessages.length === 0 ? (
              <div className="text-center text-sm text-slate-400 py-8">
                Send a message to get started
              </div>
            ) : (
              visibleMessages.map((msg, idx) => (
                <div key={idx} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                  {msg.role !== "user" && (
                    <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center mr-2 mt-0.5 shrink-0">
                      <Bot className="w-4 h-4 text-slate-500" />
                    </div>
                  )}
                  <div className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm",
                    msg.role === "user" ? "bg-slate-800 text-white" : "bg-slate-50 border border-slate-200"
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
              ))
            )}
            {loading && (
              <div className="flex justify-start">
                <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center mr-2 mt-0.5">
                  <Bot className="w-4 h-4 text-slate-500" />
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3">
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
              disabled={loading || initializing}
            />
            <Button size="icon" onClick={sendMessage} disabled={loading || !input.trim() || initializing}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}