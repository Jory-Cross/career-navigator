import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Mail } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const categoryColors = {
  follow_up: "bg-blue-100 text-blue-700",
  interview_scheduling: "bg-purple-100 text-purple-700",
  application_update: "bg-emerald-100 text-emerald-700",
  welcome: "bg-amber-100 text-amber-700",
  check_in: "bg-pink-100 text-pink-700",
  general: "bg-slate-100 text-slate-700"
};

export default function EmailTemplates() {
  const [showDialog, setShowDialog] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["email-templates"],
    queryFn: () => base44.entities.EmailTemplate.list("-created_date")
  });

  const openNew = () => {
    setForm({ name: "", category: "general", subject: "", body: "", is_active: true });
    setEditId(null);
    setShowDialog(true);
  };

  const openEdit = (template) => {
    setForm({ ...template });
    setEditId(template.id);
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.subject || !form.body) {
      toast.error("Please fill in all required fields");
      return;
    }
    setSaving(true);
    try {
      if (editId) {
        await base44.entities.EmailTemplate.update(editId, form);
        toast.success("Template updated");
      } else {
        await base44.entities.EmailTemplate.create(form);
        toast.success("Template created");
      }
      queryClient.invalidateQueries({ queryKey: ["email-templates"] });
      setShowDialog(false);
    } catch (error) {
      toast.error("Failed to save: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this template?")) return;
    await base44.entities.EmailTemplate.delete(id);
    toast.success("Template deleted");
    queryClient.invalidateQueries({ queryKey: ["email-templates"] });
  };

  const u = (f, v) => setForm(p => ({ ...p, [f]: v }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Email Templates</h1>
          <p className="text-sm text-slate-500 mt-1">Create and manage reusable email templates</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="w-4 h-4 mr-2" /> New Template
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-slate-400">Loading templates...</div>
      ) : templates.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Mail className="w-12 h-12 text-slate-300 mb-3" />
            <p className="text-slate-500 mb-4">No email templates yet</p>
            <Button onClick={openNew} variant="outline">
              <Plus className="w-4 h-4 mr-2" /> Create Your First Template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map(template => (
            <Card key={template.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate">{template.name}</CardTitle>
                    <Badge className={cn("mt-2 text-xs border-0", categoryColors[template.category])}>
                      {template.category.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <div className="flex gap-1 ml-2">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(template)} className="h-8 w-8">
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => handleDelete(template.id)} className="h-8 w-8 text-red-500 hover:text-red-600">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Subject:</p>
                    <p className="text-sm font-medium text-slate-700 truncate">{template.subject}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Body Preview:</p>
                    <p className="text-xs text-slate-600 line-clamp-3">{template.body}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Template" : "New Email Template"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Template Name *</Label>
                <Input value={form.name || ""} onChange={e => u("name", e.target.value)} placeholder="e.g., Client Follow-Up" />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={form.category || "general"} onValueChange={v => u("category", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="follow_up">Follow Up</SelectItem>
                    <SelectItem value="interview_scheduling">Interview Scheduling</SelectItem>
                    <SelectItem value="application_update">Application Update</SelectItem>
                    <SelectItem value="welcome">Welcome</SelectItem>
                    <SelectItem value="check_in">Check In</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Subject Line *</Label>
              <Input value={form.subject || ""} onChange={e => u("subject", e.target.value)} placeholder="Email subject..." />
            </div>
            <div className="space-y-2">
              <Label>Email Body *</Label>
              <Textarea
                value={form.body || ""}
                onChange={e => u("body", e.target.value)}
                placeholder="Write your email template here... Use {{client_name}} for dynamic content."
                rows={12}
                className="font-mono text-sm"
              />
              <p className="text-xs text-slate-500">
                Tip: Use <code className="bg-slate-100 px-1 py-0.5 rounded">{"{{client_name}}"}</code> to insert the client's name dynamically
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}