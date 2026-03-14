import React, { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { base44 } from "@/api/base44Client";
import { Sparkles, Send, Loader2, ExternalLink, MessageCircle, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

const SUGGESTED_QUESTIONS = [
  "What are the highest paying jobs in my field right now?",
  "How do I negotiate a higher salary?",
  "What skills should I learn to advance my career?",
  "How do I write a strong cover letter?",
  "What are employers looking for in interviews?",
];

export default function CareerAdvisorChat({ client }) {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: `Hi ${client?.first_name || "there"}! 👋 I'm your AI Career Advisor. I can search the internet to answer your career questions, find job market insights, salary data, industry trends, and more. What would you like to know?`,
      links: []
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text) => {
    const question = text || input.trim();
    if (!question || loading) return;
    setInput("");

    const userMsg = { role: "user", content: question };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    const clientContext = [
      client?.target_role ? `Client's target role: ${client.target_role}` : "",
      client?.industry ? `Client's target industry: ${client.industry}` : "",
      client?.location ? `Client's location: ${client.location}` : "",
    ].filter(Boolean).join(". ");

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a knowledgeable career advisor with access to current internet data. Answer the following career question thoroughly.

${clientContext ? `Client context: ${clientContext}` : ""}

Question: ${question}

Provide:
1. A clear, helpful answer with actionable advice
2. Current data, statistics, or trends where relevant
3. Up to 4 specific links the user can explore further (real, well-known websites like LinkedIn, Indeed, BLS.gov, Glassdoor, etc.)

Be conversational, specific, and encouraging. Use markdown formatting for readability.`,
      add_context_from_internet: true,
      response_json_schema: {
        type: "object",
        properties: {
          answer: { type: "string" },
          links: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                url: { type: "string" },
                description: { type: "string" }
              }
            }
          }
        }
      }
    });

    setMessages(prev => [...prev, {
      role: "assistant",
      content: result.answer || "I wasn't able to find an answer. Please try rephrasing your question.",
      links: result.links || []
    }]);
    setLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([{
      role: "assistant",
      content: `Hi ${client?.first_name || "there"}! 👋 I'm your AI Career Advisor. Ask me anything about your career journey — I'll search the internet for the latest insights!`,
      links: []
    }]);
  };

  return (
    <Card className="border-0 shadow-sm flex flex-col" style={{ height: "70vh" }}>
      {/* Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">AI Career Advisor</h3>
            <p className="text-xs text-slate-400">Searches the internet for current insights</p>
          </div>
        </div>
        <Button size="sm" variant="ghost" onClick={clearChat} className="text-slate-400 hover:text-slate-600">
          <RotateCcw className="w-3.5 h-3.5 mr-1" /> Clear
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}>
            {msg.role === "assistant" && (
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
            )}
            <div className={cn("max-w-[85%] space-y-2", msg.role === "user" ? "items-end flex flex-col" : "")}>
              <div className={cn(
                "rounded-2xl px-4 py-3 text-sm",
                msg.role === "user"
                  ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-tr-sm"
                  : "bg-slate-50 border border-slate-100 text-slate-800 rounded-tl-sm"
              )}>
                {msg.role === "assistant" ? (
                  <ReactMarkdown
                    className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0.5 prose-headings:text-slate-800"
                    components={{
                      a: ({ children, href }) => (
                        <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                          {children}
                        </a>
                      )
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                ) : (
                  <p>{msg.content}</p>
                )}
              </div>

              {/* Links */}
              {msg.links?.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs text-slate-400 font-medium">Explore further:</p>
                  {msg.links.map((link, li) => (
                    <a
                      key={li}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-2 p-2.5 bg-white border border-slate-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-colors group"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0 group-hover:text-blue-600" />
                      <div>
                        <p className="text-xs font-medium text-slate-800 group-hover:text-blue-700">{link.title}</p>
                        {link.description && <p className="text-xs text-slate-500 mt-0.5">{link.description}</p>}
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 justify-start">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-500" />
              <span className="text-xs text-slate-500">Searching the web for you...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggested questions */}
      {messages.length <= 1 && (
        <div className="px-4 pb-2 shrink-0">
          <p className="text-xs text-slate-400 mb-2">Suggested questions:</p>
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED_QUESTIONS.map((q, i) => (
              <button
                key={i}
                onClick={() => sendMessage(q)}
                className="text-xs px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-full text-slate-600 hover:bg-purple-50 hover:border-purple-200 hover:text-purple-700 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-slate-100 shrink-0">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about your career, job market, salaries..."
            disabled={loading}
            className="flex-1"
          />
          <Button onClick={() => sendMessage()} disabled={!input.trim() || loading} className="shrink-0">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}