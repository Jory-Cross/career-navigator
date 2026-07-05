import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Client creation disabled during the security remediation freeze.
 *
 * The legacy dialog directly created Client and Activity records in the
 * browser with browser-defined organization and assignment values. Re-enable
 * only after a server-authorized client-creation route is implemented.
 */
export default function NewClientDialog({ open, onOpenChange }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New client creation is temporarily unavailable</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-amber-900">
          Client creation is disabled while security remediation is in progress.
        </p>
      </DialogContent>
    </Dialog>
  );
}
