import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Archive, CheckCircle2, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function ArchiveClientDialog({ open, onOpenChange, client, onArchived }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleArchive = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('archiveClient', { client_id: client.id });
      const data = res.data;

      if (data?.success) {
        setDone(true);
        onArchived?.();
      } else {
        toast.error(data?.error || "Archive failed");
      }
    } catch (err) {
      toast.error("Archive failed: " + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setDone(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-700">
            <Archive className="w-5 h-5" />
            Archive Client
          </DialogTitle>
        </DialogHeader>

        {done ? (
          <div className="py-6 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
            <p className="text-base font-semibold text-slate-800">Client Archived</p>
            <p className="text-sm text-slate-500">
              <strong>{client?.first_name} {client?.last_name}</strong> has been archived.
              All historical records have been preserved.
            </p>
            <p className="text-xs text-slate-400">
              Portal access has been revoked. The client will not appear in active client lists.
            </p>
            <Button onClick={handleClose} className="mt-2">Close</Button>
          </div>
        ) : (
          <>
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                  {client?.first_name?.[0]}{client?.last_name?.[0]}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{client?.first_name} {client?.last_name}</p>
                  <p className="text-xs text-slate-400">{client?.email}</p>
                </div>
              </div>

              <div className="space-y-2 text-sm text-slate-600">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-500 shrink-0" />
                  <span>All records (documents, assessments, time entries, tasks) will be preserved.</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-500 shrink-0" />
                  <span>Client will be hidden from active lists (use the Archived filter to find them).</span>
                </div>
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-500 shrink-0" />
                  <span>Portal access will be revoked immediately. The client cannot sign in.</span>
                </div>
              </div>

              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                  This can be undone — use <strong>Restore Client</strong> from the client list to reactivate.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose} disabled={loading}>Cancel</Button>
              <Button
                onClick={handleArchive}
                disabled={loading}
                className="bg-amber-600 hover:bg-amber-700 text-white shadow-none"
              >
                {loading
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Archiving...</>
                  : <><Archive className="w-4 h-4 mr-2" /> Archive Client</>
                }
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}