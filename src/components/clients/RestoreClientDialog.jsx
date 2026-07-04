import React from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArchiveRestore } from "lucide-react";

export default function RestoreClientDialog({
  open,
  onOpenChange,
  client,
}) {
  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArchiveRestore className="w-5 h-5 text-slate-500" />
            Restore Client
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-amber-900">
                Client restoration is temporarily unavailable.
              </p>
              <p className="text-sm text-amber-800">
                Restoring {client?.first_name} {client?.last_name} is disabled
                during security remediation while the secure server-authorized
                restoration workflow is being completed.
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-500">
            This safeguard prevents browser-side changes to client status,
            organization access, and portal account roles.
          </p>
        </div>

        <DialogFooter>
          <Button onClick={handleClose}>Close</Button>
          <Button disabled className="bg-slate-300 text-slate-600">
            Restore Client
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
