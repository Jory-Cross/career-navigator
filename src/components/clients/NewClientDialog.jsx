import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function NewClientDialog({ open, onOpenChange, onCreated }) {
  const [form, setForm] = useState({
    first_name: "", last_name: "", email: "", phone: "",
    target_role: "", industry: "", location: "", notes: ""
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.first_name || !form.last_name || !form.email) {
      toast.error("First name, last name, and email are required");
      return;
    }
    setSaving(true);
    try {
      const token = Math.random().toString(36).substring(2, 15);
      const client = await base44.entities.Client.create({ ...form, status: "active", access_token: token });
      
      // Send welcome email to client
      const portalUrl = `${window.location.origin}/ClientPortal`;
      await base44.integrations.Core.SendEmail({
        to: form.email,
        subject: "Welcome to ClientFlow - Access Your Portal",
        body: `Hi ${form.first_name},\n\nWelcome to ClientFlow! We're excited to work with you.\n\nYou now have access to your personal client portal where you can:\n• Track your job applications\n• Practice for interviews with AI\n• Manage your tasks\n• View your documents\n\nTo get started, please sign up for your account at:\n${portalUrl}\n\nUse this email address (${form.email}) to sign up.\n\nIf you have any questions, feel free to reach out!\n\nBest regards,\nThe ClientFlow Team`
      });
      
      setSaving(false);
      setForm({ first_name: "", last_name: "", email: "", phone: "", target_role: "", industry: "", location: "", notes: "" });
      onOpenChange(false);
      toast.success("Client created and welcome email sent");
      if (onCreated) onCreated();
    } catch (error) {
      setSaving(false);
      toast.error("Failed to create client");
    }
  };

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">New Client</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500">First Name *</Label>
            <Input value={form.first_name} onChange={e => update("first_name", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500">Last Name *</Label>
            <Input value={form.last_name} onChange={e => update("last_name", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500">Email *</Label>
            <Input type="email" value={form.email} onChange={e => update("email", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500">Phone</Label>
            <Input value={form.phone} onChange={e => update("phone", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500">Target Role</Label>
            <Input value={form.target_role} onChange={e => update("target_role", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500">Industry</Label>
            <Input value={form.industry} onChange={e => update("industry", e.target.value)} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label className="text-xs text-slate-500">Location</Label>
            <Input value={form.location} onChange={e => update("location", e.target.value)} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label className="text-xs text-slate-500">Notes</Label>
            <Textarea value={form.notes} onChange={e => update("notes", e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-slate-900 hover:bg-slate-800 text-white">
            {saving ? "Creating..." : "Create Client"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}