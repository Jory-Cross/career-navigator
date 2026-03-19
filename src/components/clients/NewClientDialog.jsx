import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function NewClientDialog({ open, onOpenChange, onCreated }) {
  const [form, setForm] = useState({
    first_name: "", last_name: "", email: "", phone: "",
    target_role: "", industry: "", location: "", notes: "",
    client_type: "job_seeker"
  });
  const [saving, setSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  React.useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  const handleSave = async () => {
    if (!form.first_name || !form.last_name || !form.email) {
      toast.error("First name, last name, and email are required");
      return;
    }
    setSaving(true);
    try {
      const token = Math.random().toString(36).substring(2, 15);
      const client = await base44.entities.Client.create({ ...form, status: "active", access_token: token });
      
      // Log activity
      await base44.entities.Activity.create({
        client_id: client.id,
        activity_type: 'status_changed',
        title: 'Client created',
        description: `New client ${form.first_name} ${form.last_name} added to the system`
      });
      
      // Invite client - they'll register as 'user' role initially
      try {
        await base44.functions.invoke('inviteClient', { 
          email: form.email, 
          firstName: form.first_name,
          clientId: client.id,
          clientType: form.client_type
        });
        
        await base44.entities.Activity.create({
          client_id: client.id,
          activity_type: 'email_sent',
          title: 'Invitation email sent',
          description: `Registration invitation sent to ${form.email}`
        });
        
        toast.success("Client created and invitation sent to " + form.email);
      } catch (emailError) {
        console.error("Failed to send invitation:", emailError);
        toast.warning("Client created, but invitation email failed: " + emailError.message);
      }
      
      setSaving(false);
      setForm({ first_name: "", last_name: "", email: "", phone: "", target_role: "", industry: "", location: "", notes: "", client_type: "job_seeker" });
      onOpenChange(false);
      if (onCreated) onCreated();
    } catch (error) {
      setSaving(false);
      toast.error("Failed to create client: " + error.message);
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
          <div className="col-span-2 space-y-1.5">
            <Label className="text-xs text-slate-500">Client Type *</Label>
            <Select value={form.client_type} onValueChange={v => update("client_type", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="job_seeker">Job Seeker</SelectItem>
                <SelectItem value="pre_ets">Pre-ETS Student</SelectItem>
                <SelectItem value="dspd">DSPD</SelectItem>
                <SelectItem value="employed">Employed</SelectItem>
              </SelectContent>
            </Select>
          </div>
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