import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ShieldAlert } from "lucide-react";

export default function PermanentDeleteDialog({
  open,
  onOpenChange,
  client,
}) {
  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          handleClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-700">
            <ShieldAlert className="w-5 h-5" />
            Permanent Deletion Unavailable
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
            <div className="text-xs text-amber-900 space-y-1">
              <p className="font-semibold">
                Permanent client deletion is temporarily unavailable.
              </p>
              <p>
                This action is disabled during security remediation because the
                legacy deletion route could modify related records outside a
                verified server-side authorization workflow.
              </p>
            </div>
          </div>

          <div className="text-xs text-slate-600">
            <p>
              <strong>
                {client?.first_name} {client?.last_name}
              </strong>{" "}
              remains archived and can still be restored through the normal
              restore workflow.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
