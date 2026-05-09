import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle, Trash2, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

const CLIENT_PORTAL_ROLES = new Set(["client", "pre_ets", "dspd"]);

async function permanentlyDeleteClient(client) {
  const clientId = client.id;
  const clientEmail = client.email?.toLowerCase().trim();
  const results = { deleted: [], errors: [] };

  // 1. Revoke PendingRoleAssignments
  try {
    const pras = await base44.entities.PendingRoleAssignment.filter({ client_id: clientId });
    for (const pra of pras || []) {
      await base44.entities.PendingRoleAssignment.update(pra.id, { status: "revoked" });
      results.deleted.push("PendingRoleAssignment:" + pra.id);
    }
  } catch (e) { results.errors.push("PendingRoleAssignment: " + e.message); }

  // 2. Strip portal access from linked Users (client_portal only — never touch staff/admin)
  try {
    const [byClientId, byEmail] = await Promise.all([
      base44.entities.User.filter({ linked_client_id: clientId }),
      clientEmail ? base44.entities.User.filter({ email: clientEmail }) : Promise.resolve([]),
    ]);
    const userMap = new Map();
    for (const u of [...(byClientId || []), ...(byEmail || [])]) userMap.set(u.id, u);
    for (const u of userMap.values()) {
      if (u.access_level === "client_portal" || CLIENT_PORTAL_ROLES.has(u.role)) {
        await base44.entities.User.update(u.id, {
          linked_client_id: null,
          access_level: null,
          role: "user",
        });
        results.deleted.push("UserStripped:" + u.email);
      }
    }
  } catch (e) { results.errors.push("User strip: " + e.message); }

  // 3. Delete related entity records in parallel
  const entityDeletes = [
    ["Activity", { client_id: clientId }],
    ["IntakeSection", { client_id: clientId }],
    ["Document", { client_id: clientId }],
    ["Assessment", { client_id: clientId }],
    ["Resume", { client_id: clientId }],
    ["Goal", { client_id: clientId }],
    ["SupportNote", { client_id: clientId }],
    ["Meeting", { client_id: clientId }],
    ["TimeEntry", { client_id: clientId }],
    ["OnboardingStep", { client_id: clientId }],
    ["JobApplication", { client_id: clientId }],
    ["InterviewSession", { client_id: clientId }],
    ["WBLEForm", { client_id: clientId }],
    ["Notification", { related_client_id: clientId }],
  ];

  await Promise.all(
    entityDeletes.map(async ([entityName, query]) => {
      try {
        const records = await base44.entities[entityName]?.filter(query);
        for (const r of records || []) {
          await base44.entities[entityName].delete(r.id);
          results.deleted.push(`${entityName}:${r.id}`);
        }
      } catch (e) {
        results.errors.push(`${entityName}: ${e.message}`);
      }
    })
  );

  // 4. Handle Task (uses client_ids array)
  try {
    const tasks = await base44.entities.Task.list();
    for (const t of tasks || []) {
      if ((t.client_ids || []).includes(clientId)) {
        const remaining = t.client_ids.filter(id => id !== clientId);
        if (remaining.length === 0) {
          await base44.entities.Task.delete(t.id);
          results.deleted.push("Task:" + t.id);
        } else {
          await base44.entities.Task.update(t.id, { client_ids: remaining });
          results.deleted.push("TaskUnlinked:" + t.id);
        }
      }
    }
  } catch (e) { results.errors.push("Task: " + e.message); }

  // 5. Finally delete the Client record itself
  await base44.entities.Client.delete(clientId);
  results.deleted.push("Client:" + clientId);

  return results;
}

export default function PermanentDeleteDialog({ open, onOpenChange, client, onDeleted }) {
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);

  const expectedText = "DELETE";
  const isConfirmed = confirmText.trim() === expectedText;

  const handleDelete = async () => {
    if (!isConfirmed) return;
    setLoading(true);
    try {
      const results = await permanentlyDeleteClient(client);
      if (results.errors.length > 0) {
        console.warn("[PermanentDelete] Some errors:", results.errors);
      }
      toast.success(`${client.first_name} ${client.last_name} permanently deleted.`);
      onOpenChange(false);
      setConfirmText("");
      if (onDeleted) onDeleted();
    } catch (e) {
      toast.error("Delete failed: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setConfirmText("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-700">
            <Trash2 className="w-5 h-5" />
            Permanently Delete Client
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
            <div className="text-xs text-red-800 space-y-1">
              <p className="font-semibold">This cannot be undone.</p>
              <p>
                Permanently deletes <strong>{client?.first_name} {client?.last_name}</strong> and removes all related records including activities, documents, assessments, time entries, tasks, intake sections, applications, and portal access.
              </p>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">
              Type <span className="font-mono font-bold text-red-600">DELETE</span> to confirm
            </label>
            <Input
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              placeholder="Type DELETE"
              className="border-red-200 focus-visible:ring-red-400"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>Cancel</Button>
          <Button
            onClick={handleDelete}
            disabled={!isConfirmed || loading}
            className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-40"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Deleting...</>
            ) : (
              <><Trash2 className="w-4 h-4 mr-2" /> Permanently Delete</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}