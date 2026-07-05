import React from "react";
import { ShieldAlert } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * Disabled during the security remediation freeze.
 *
 * This legacy composer directly read EmailTemplate records in the browser and
 * initiated client email flows from a disabled client workspace. Restore email
 * composition only through a reviewed, server-authorized client communication
 * workflow.
 */
export default function EmailComposer({ open, onClose }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Client Email Unavailable</DialogTitle>
        </DialogHeader>
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <p>
            Client email composition is temporarily unavailable while security remediation is in progress.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
