import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Phone,
  Mail,
  Users,
} from "lucide-react";

import { updateClientContacts } from "@/lib/api/clientPortalApi";

const CONTACT_TYPES = [
  { value: "parent", label: "Parent" },
  { value: "guardian", label: "Guardian" },
  { value: "support_staff", label: "Support Staff" },
  { value: "other", label: "Other" },
];

function getTypeLabel(contact) {
  if (contact?.type === "other") return contact?.label || "Other";
  return CONTACT_TYPES.find((t) => t.value === contact?.type)?.label || contact?.type || "Other";
}

function emptyContact() {
  return {
    type: "parent",
    label: "",
    name: "",
    phone: "",
    email: "",
    notes: "",
  };
}

export default function ContactsSection({ client, onUpdate }) {
  const [expanded, setExpanded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removingIndex, setRemovingIndex] = useState(null);
  const [newContact, setNewContact] = useState(emptyContact());

  const contacts = useMemo(() => {
    return Array.isArray(client?.contacts) ? client.contacts : [];
  }, [client?.contacts]);

  const updateNewContact = (field, value) => {
    setNewContact((prev) => ({ ...prev, [field]: value }));
  };

  const resetAddForm = () => {
    setNewContact(emptyContact());
    setAdding(false);
  };

  const buildContactPayload = (contact) => ({
    type: contact?.type || "other",
    label: contact?.type === "other" ? (contact?.label || "").trim() : "",
    name: (contact?.name || "").trim(),
    phone: (contact?.phone || "").trim(),
    email: (contact?.email || "").trim(),
    notes: (contact?.notes || "").trim(),
  });

  const addContact = async () => {
    const payload = buildContactPayload(newContact);

    if (!payload.name) {
      toast.error("Name is required");
      return;
    }

    if (payload.type === "other" && !payload.label) {
      toast.error("Label is required for Other contacts");
      return;
    }

    setSaving(true);

    try {
      await updateClientContacts(client.id, [...contacts, payload]);
      toast.success("Contact added");
      resetAddForm();
      onUpdate?.();
    } catch (error) {
      console.error("Failed to add contact:", error);
      toast.error("Failed to add contact");
    } finally {
      setSaving(false);
    }
  };

  const removeContact = async (index) => {
    setRemovingIndex(index);

    try {
      const updatedContacts = contacts.filter((_, i) => i !== index);
      await updateClientContacts(client.id, updatedContacts);
      toast.success("Contact removed");
      onUpdate?.();
    } catch (error) {
      console.error("Failed to remove contact:", error);
      toast.error("Failed to remove contact");
    } finally {
      setRemovingIndex(null);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-slate-500" />
          <span className="font-medium text-slate-900">
            Additional Contacts {contacts.length > 0 ? `(${contacts.length})` : ""}
          </span>
        </div>

        {expanded ? (
          <ChevronUp className="h-4 w-4 text-slate-500" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-500" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-slate-100 px-4 py-4">
          <div className="space-y-3">
            {contacts.map((contact, index) => (
              <div
                key={`${contact?.name || "contact"}-${index}`}
                className="rounded-lg border border-slate-200 bg-slate-50 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      {getTypeLabel(contact)}
                    </div>

                    <div className="mt-1 text-sm font-medium text-slate-900">
                      {contact?.name || "Unnamed contact"}
                    </div>

                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                      {contact?.phone ? (
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5" />
                          <span>{contact.phone}</span>
                        </div>
                      ) : null}

                      {contact?.email ? (
                        <div className="flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5" />
                          <span>{contact.email}</span>
                        </div>
                      ) : null}
                    </div>

                    {contact?.notes ? (
                      <div className="mt-2 text-sm text-slate-600">{contact.notes}</div>
                    ) : null}
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-slate-400 hover:text-red-500"
                    disabled={removingIndex === index}
                    onClick={() => removeContact(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}

            {adding ? (
              <div className="space-y-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
                <div className="flex gap-2">
                  <Select
                    value={newContact.type}
                    onValueChange={(value) => updateNewContact("type", value)}
                  >
                    <SelectTrigger className="h-9 bg-white text-sm">
                      <SelectValue placeholder="Contact type" />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTACT_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {newContact.type === "other" && (
                    <Input
                      value={newContact.label}
                      onChange={(e) => updateNewContact("label", e.target.value)}
                      placeholder="Custom label"
                      className="h-9 bg-white text-sm"
                    />
                  )}
                </div>

                <Input
                  value={newContact.name}
                  onChange={(e) => updateNewContact("name", e.target.value)}
                  placeholder="Name"
                  className="h-9 bg-white text-sm"
                />

                <div className="grid gap-2 md:grid-cols-2">
                  <Input
                    value={newContact.phone}
                    onChange={(e) => updateNewContact("phone", e.target.value)}
                    placeholder="Phone"
                    className="h-9 bg-white text-sm"
                  />
                  <Input
                    value={newContact.email}
                    onChange={(e) => updateNewContact("email", e.target.value)}
                    placeholder="Email"
                    className="h-9 bg-white text-sm"
                  />
                </div>

                <Input
                  value={newContact.notes}
                  onChange={(e) => updateNewContact("notes", e.target.value)}
                  placeholder="Notes"
                  className="h-9 bg-white text-sm"
                />

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={resetAddForm}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    className="h-8 text-xs"
                    onClick={addContact}
                    disabled={saving}
                  >
                    {saving ? "Saving..." : "Add Contact"}
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                <Plus className="h-4 w-4" />
                Add Contact
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
