import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, ArchiveRestore, Info } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

const PORTAL_OPTIONS = [
  { value: "none", label: "Do not restore portal access" },
  { value: "client", label: "Restore as Client Portal User", role: "client" },
  { value: "pre_ets", label: "Restore as Pre-ETS Client Portal User", role: "pre_ets" },
  { value: "dspd", label: "Restore as DSPD Client Portal User", role: "dspd" },
];

const STAFF_ROLES = new Set(["admin", "management", "employee", "pre_ets_employer"]);

export default function RestoreClientDialog({ open, onOpenChange, client, onRestored }) {
  const [portalOption, setPortalOption] = useState("none");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [portalUser, setPortalUser] = useState(null); // matched User record
  const [loadingUser, setLoadingUser] = useState(false);
  const [portalResult, setPortalResult] = useState(null); // summary after save

  // Look up existing portal user by email when dialog opens
  useEffect(() => {
    if (!open || !client?.email) return;
    setLoadingUser(true);
    setPortalUser(null);
    base44.entities.User.filter({ email: client.email.toLowerCase().trim() })
      .then(users => {
        const match = (users || []).find(u => !STAFF_ROLES.has(u.role));
        setPortalUser(match || null);
      })
      .catch(() => setPortalUser(null))
      .finally(() => setLoadingUser(false));
  }, [open, client?.email]);

  const handleRestore = async () => {
    setLoading(true);
    try {
      // 1. Restore client record
      await base44.entities.Client.update(client.id, {
        is_archived: false,
        status: "active",
      });

      // 2. Portal access update
      let accessSummary = "Portal access not changed.";
      const selected = PORTAL_OPTIONS.find(o => o.value === portalOption);

      if (portalOption !== "none" && selected?.role) {
        if (portalUser) {
          await base44.entities.User.update(portalUser.id, {
            role: selected.role,
            access_level: "client_portal",
            linked_client_id: client.id,
            org_id: client.org_id || portalUser.org_id,
          });
          accessSummary = `Portal access restored as ${selected.label.replace("Restore as ", "")}.`;
        } else {
          accessSummary = "No portal user found — send a new portal invite to grant access.";
        }
      }

      setPortalResult(accessSummary);
      setDone(true);
      if (onRestored) onRestored();
    } catch (e) {
      toast.error("Failed to restore client: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setDone(false);
    setPortalOption("none");
    setPortalResult(null);
    onOpenChange(false);
  };

  const noUserWarning = portalOption !== "none" && !loadingUser && !portalUser;

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
                Restoring <strong>{client?.first_name} {client?.last_name}</strong> will set their status to <strong>Active</strong> and move them back to the active client list.
              </p>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">Portal access</label>
                <Select value={portalOption} onValueChange={setPortalOption} disabled={loadingUser}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PORTAL_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {noUserWarning && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <Info className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-800">
                    No portal user found for <strong>{client?.email}</strong>. Restore the client first, then send a new portal invite to grant access.
                  </p>
                </div>
              )}

              {portalOption === "none" && (
                <div className="flex items-start gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-slate-600">
                    Portal access will remain disabled. You can re-invite this client from their profile at any time.
                  </p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button
                onClick={handleRestore}
                disabled={loading || loadingUser}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
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
                  <strong>{client?.first_name} {client?.last_name}</strong> has been restored as <strong>Active</strong>.
                </p>
              </div>
              <div className="flex items-start gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <Info className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                <p className="text-xs text-slate-600">{portalResult}</p>
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