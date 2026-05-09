import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, ArchiveRestore } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function RestoreClientDialog({ open, onOpenChange, client, onRestored }) {
  const [status, setStatus] = useState("active");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleRestore = async () => {
    setLoading(true);
    try {
      await base44.entities.Client.update(client.id, {
        is_archived: false,
        status,
      });
      setDone(true);
      if (onRestored) onRestored();
    } catch {
      toast.error("Failed to restore client");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setDone(false);
    setStatus("active");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArchiveRestore className="w-5 h-5 text-emerald-600" />
            Restore Client
          </DialogTitle>
        </DialogHeader>

        {!done ? (
          <>
            <div className="space-y-4 py-2">
              <p className="text-sm text-slate-600">
                Restoring <strong>{client?.first_name} {client?.last_name}</strong> will move them back to the active client list.
              </p>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">Restore with status</label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-800">
                  <strong>Portal access is NOT restored.</strong> When this client was archived, their portal access was revoked. You must intentionally re-invite them or manually grant access after restoring.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleRestore} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                {loading ? "Restoring..." : "Restore Client"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-3 py-2">
              <div className="flex items-start gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                <ArchiveRestore className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                <p className="text-xs text-emerald-800">
                  <strong>{client?.first_name} {client?.last_name}</strong> has been restored with status: <strong>{status}</strong>.
                </p>
              </div>
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="text-xs text-amber-800 space-y-1">
                  <p className="font-semibold">Portal access was not restored.</p>
                  <p>Next steps — choose one:</p>
                  <ul className="list-disc ml-3 space-y-0.5">
                    <li>Re-invite the client via the Portal Access panel on their profile</li>
                    <li>Assign new portal access manually</li>
                    <li>Leave portal access disabled</li>
                  </ul>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}