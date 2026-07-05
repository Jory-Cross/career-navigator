import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Legacy client assignment dialog disabled during the security remediation freeze.
 *
 * The prior dialog directly listed User records in the browser before invoking
 * a legacy assignment route. Client assignment must remain unavailable until a
 * server-authorized roster and mutation workflow is implemented.
 */
export default function AssignClientDialog({ open, onOpenChange }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Client assignment is temporarily unavailable</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-amber-900">
          Client assignment is protected while security remediation is in progress.
        </p>
      </DialogContent>
    </Dialog>
  );
}
