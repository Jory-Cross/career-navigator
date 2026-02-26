import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Send, Loader2, FileText } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function EmailComposer({ open, onClose, clientId, clientEmail, clientName }) {
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [emailType, setEmailType] = useState("follow_up");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);

  const { data: templates = [] } = useQuery({
    queryKey: ["email-templates"],
    queryFn: () => base44.entities.EmailTemplate.list("-created_date"),
    enabled: open
  });

  const handleTemplateSelect = (templateId) => {
    setSelectedTemplate(templateId);
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setSubject(template.subject.replace(/\{\{client_name\}\}/g, clientName));
      setBody(template.body.replace(/\{\{client_name\}\}/g, clientName));
    }
  };

  const generateEmail = async () => {
    setGenerating(true);
    try {
      const result = await base44.functions.invoke('generateAIEmail', {
        client_id: clientId,
        email_type: emailType
      });
      setSubject(result.data.subject);
      setBody(result.data.body);
      toast.success("Email generated");
    } catch (error) {
      toast.error("Failed to generate email");
    } finally {
      setGenerating(false);
    }
  };

  const sendEmail = async () => {
    if (!subject || !body) {
      toast.error("Please fill in subject and body");
      return;
    }
    setSending(true);
    try {
      await base44.functions.invoke('sendClientEmail', {
        to: clientEmail,
        subject,
        body,
        clientId
      });
      toast.success("Email sent successfully");
      setSubject("");
      setBody("");
      onClose();
    } catch (error) {
      console.error("Email error:", error);
      toast.error("Failed to send email: " + (error.message || "Unknown error"));
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Compose Email to {clientName}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-3">
          <div>
            <Label className="text-xs mb-2 block flex items-center gap-2">
              <FileText className="w-3.5 h-3.5" />
              Use Template
            </Label>
            <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
              <SelectTrigger>
                <SelectValue placeholder="Select a template..." />
              </SelectTrigger>
              <SelectContent>
                {templates.filter(t => t.is_active).map(template => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or generate with AI</span>
            </div>
          </div>

          <div>
            <Label className="text-xs mb-2 block">AI Email Template</Label>
            <div className="flex gap-2">
              <Select value={emailType} onValueChange={setEmailType}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="follow_up">Follow-up Check-in</SelectItem>
                  <SelectItem value="meeting_confirmation">Meeting Confirmation</SelectItem>
                  <SelectItem value="progress_update">Progress Update</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={generateEmail} disabled={generating}>
                {generating ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 mr-2" />
                )}
                Generate
              </Button>
            </div>
          </div>

          <div>
            <Label className="text-xs">To</Label>
            <Input value={clientEmail} disabled className="bg-slate-50" />
          </div>

          <div>
            <Label className="text-xs">Subject *</Label>
            <Input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Email subject"
            />
          </div>

          <div>
            <Label className="text-xs">Body *</Label>
            <Textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Email body"
              rows={12}
              className="font-mono text-sm"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={sendEmail} disabled={sending}>
            {sending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            Send Email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}