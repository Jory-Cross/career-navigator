import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, Send, Loader2, Trash2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function AgentChatEmbed({ agentKey, title, description, clientId, systemContext }) {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    initConversation();
    return () => {};
  }, [agentKey, clientId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
    // Always inject system context so the agent has current data (assessments, profile, etc.)
    const content = systemContext
      ? `[SYSTEM CONTEXT - do not repeat this back to the user, use this data directly without searching:\n${systemContext}\n]\n\n${text}`
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

  const clearConversation = async () => {
    const storageKey = `agent_conv_v2_${agentKey}_${clientId || 'anonymous'}`;
    localStorage.removeItem(storageKey);
    setMessages([]);
    setConversation(null);
    await initConversation();
  };

  const visibleMessages = messages
    .filter(m => m.role !== "system")
    .map(m => {
      if (m.role === "user" && m.content?.includes("[SYSTEM CONTEXT")) {
        return { ...m, content: m.content.replace(/\[SYSTEM CONTEXT[\s\S]*?\]\n\n/, "") };
      }
      return m;
    });

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
          <Button variant="ghost" size="icon" onClick={clearConversation} title="Clear conversation" className="text-slate-400 hover:text-red-500">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
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