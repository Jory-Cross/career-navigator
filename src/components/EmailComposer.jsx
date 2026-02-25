import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Send, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function EmailComposer({ open, onClose, clientId, clientEmail, clientName }) {
  const [emailType, setEmailType] = useState("follow_up");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);

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
      await base44.integrations.Core.SendEmail({
        to: clientEmail,
        subject,
        body
      });
      toast.success("Email sent");
      onClose();
    } catch (error) {
      toast.error("Failed to send email");
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