import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Offboarding disabled during the security remediation freeze.
 *
 * The legacy dialog directly read assigned client records in the browser and
 * initiated an access-changing workflow. Restore it only after a fully scoped
 * server-authorized offboarding workspace is implemented and audited.
 */
export default function EmployeeOffboardingDialog({ open, onOpenChange }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Employee offboarding is temporarily unavailable</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-amber-900">
          This access-changing workflow is disabled while security remediation is in progress.
        </p>
      </DialogContent>
    </Dialog>
  );
}
