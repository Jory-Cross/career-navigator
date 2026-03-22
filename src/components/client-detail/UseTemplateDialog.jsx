import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Mail, ChevronLeft, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const categoryColors = {
  follow_up: "bg-blue-100 text-blue-700",
  interview_scheduling: "bg-purple-100 text-purple-700",
  application_update: "bg-emerald-100 text-emerald-700",
  networking: "bg-orange-100 text-orange-700",
  welcome: "bg-amber-100 text-amber-700",
  check_in: "bg-pink-100 text-pink-700",
  general: "bg-slate-100 text-slate-700"
};

function interpolate(text, vars) {
  if (!text) return "";
  return text
    .replace(/\{\{client_name\}\}/g, vars.client_name || "")
    .replace(/\{\{first_name\}\}/g, vars.first_name || "")
    .replace(/\{\{company\}\}/g, vars.company || "")
    .replace(/\{\{position\}\}/g, vars.position || "")
    .replace(/\{\{contact_name\}\}/g, vars.contact_name || "");
}

export default function UseTemplateDialog({ open, onClose, client, application }) {
  const [selected, setSelected] = useState(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const { data: templates = [] } = useQuery({
    queryKey: ["email-templates"],
    queryFn: () => base44.entities.EmailTemplate.filter({ is_active: true }, "name"),
    enabled: open
  });

  const vars = {
    client_name: client ? `${client.first_name} ${client.last_name}` : "",
    first_name: client?.first_name || "",
    company: application?.company || "",
    position: application?.position || "",
    contact_name: application?.contact_name || ""
  };

  const selectTemplate = (t) => {
    setSelected(t);
    setSubject(interpolate(t.subject, vars));
    setBody(interpolate(t.body, vars));
  };

  const handleSend = async () => {
    if (!client?.email) {
      toast.error("Client has no email address");
      return;
    }
    setSending(true);
    try {
      await base44.integrations.Core.SendEmail({
        to: client.email,
        subject,
        body
      });
      toast.success(`Email sent to ${client.email}`);
      handleClose();
    } catch (err) {
      toast.error("Failed to send email");
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setSelected(null);
    setSubject("");
    setBody("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-blue-600" />
            {selected ? "Compose Email" : "Choose a Template"}
          </DialogTitle>
        </DialogHeader>

        {!selected ? (
          <div className="space-y-2 py-2">
            {templates.length === 0 ? (
              <div className="text-center py-8 text-sm text-slate-400">
                No templates yet. Create them in <strong>Email Templates</strong> settings.
              </div>
            ) : (
              templates.map(t => (
                <button
                  key={t.id}
                  onClick={() => selectTemplate(t)}
                  className="w-full text-left p-3 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm text-slate-800">{t.name}</span>
                    <Badge className={cn("text-[10px] border-0 shrink-0", categoryColors[t.category])}>
                      {t.category.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 truncate">{t.subject}</p>
                </button>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-3 py-2">
            <button
              onClick={() => setSelected(null)}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Back to templates
            </button>
            <div className="text-xs text-slate-500 bg-slate-50 rounded-lg p-2">
              Sending to: <strong>{client?.email || "No email on file"}</strong>
              {application && <span className="ml-2">• Re: {application.position} at {application.company}</span>}
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Subject</Label>
              <Input value={subject} onChange={e => setSubject(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Body</Label>
              <Textarea value={body} onChange={e => setBody(e.target.value)} rows={12} className="text-sm" />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          {selected && (
            <Button onClick={handleSend} disabled={sending || !subject || !body}>
              {sending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
              Send Email
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}