import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { Plus, Trash2, ChevronDown, ChevronUp, Phone, Mail, Users } from "lucide-react";

const CONTACT_TYPES = [
  { value: "parent", label: "Parent" },
  { value: "guardian", label: "Guardian" },
  { value: "support_staff", label: "Support Staff" },
  { value: "other", label: "Other" },
];

const typeLabel = (c) => {
  if (c.type === "other") return c.label || "Other";
  return CONTACT_TYPES.find(t => t.value === c.type)?.label || c.type;
};

const emptyContact = () => ({ type: "parent", label: "", name: "", phone: "", email: "", notes: "" });

export default function ContactsSection({ client, onUpdate }) {
  const [expanded, setExpanded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newContact, setNewContact] = useState(emptyContact());
  const [saving, setSaving] = useState(false);

  const contacts = client.contacts || [];

  const u = (f, v) => setNewContact(p => ({ ...p, [f]: v }));

  const addContact = async () => {
    if (!newContact.name) { toast.error("Name is required"); return; }
    setSaving(true);
    await base44.entities.Client.update(client.id, {
      contacts: [...contacts, newContact]
    });
    toast.success("Contact added");
    setNewContact(emptyContact());
    setAdding(false);
    setSaving(false);
    onUpdate();
  };

  const removeContact = async (index) => {
    const updated = contacts.filter((_, i) => i !== index);
    await base44.entities.Client.update(client.id, { contacts: updated });
    toast.success("Contact removed");
    onUpdate();
  };

  return (
    <div className="mt-4 pt-4 border-t border-slate-100">
      <button
        onClick={() => setExpanded(e => !e)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-700">
            Additional Contacts {contacts.length > 0 && <span className="text-slate-400 font-normal">({contacts.length})</span>}
          </span>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {expanded && (
        <div className="mt-3 space-y-3">
          {contacts.map((c, i) => (
            <div key={i} className="bg-slate-50 rounded-lg p-3 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{typeLabel(c)}</span>
                <button onClick={() => removeContact(i)} className="text-slate-300 hover:text-red-400 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-sm font-medium text-slate-800">{c.name}</p>
              <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                {c.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{c.phone}</span>}
                {c.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{c.email}</span>}
              </div>
              {c.notes && <p className="text-xs text-slate-400 mt-1">{c.notes}</p>}
            </div>
          ))}

          {adding ? (
            <div className="bg-blue-50 rounded-lg p-3 space-y-2">
              <div className="flex gap-2">
                <Select value={newContact.type} onValueChange={v => u("type", v)}>
                  <SelectTrigger className="w-36 h-8 text-xs bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTACT_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {newContact.type === "other" && (
                  <Input
                    placeholder="Label (e.g. Case Manager)"
                    value={newContact.label}
                    onChange={e => u("label", e.target.value)}
                    className="h-8 text-xs bg-white flex-1"
                  />
                )}
              </div>
              <Input placeholder="Full Name *" value={newContact.name} onChange={e => u("name", e.target.value)} className="h-8 text-xs bg-white" />
              <div className="flex gap-2">
                <Input placeholder="Phone" value={newContact.phone} onChange={e => u("phone", e.target.value)} className="h-8 text-xs bg-white flex-1" />
                <Input placeholder="Email" value={newContact.email} onChange={e => u("email", e.target.value)} className="h-8 text-xs bg-white flex-1" />
              </div>
              <Input placeholder="Notes (optional)" value={newContact.notes} onChange={e => u("notes", e.target.value)} className="h-8 text-xs bg-white" />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => { setAdding(false); setNewContact(emptyContact()); }} className="h-7 text-xs">Cancel</Button>
                <Button size="sm" onClick={addContact} disabled={saving} className="h-7 text-xs">
                  {saving ? "Saving..." : "Add Contact"}
                </Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              <Plus className="w-3.5 h-3.5" /> Add Contact
            </button>
          )}
        </div>
      )}
    </div>
  );
}