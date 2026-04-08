import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Zap, X } from "lucide-react";
import JobCoachingTimeEntryForm from "./JobCoachingTimeEntryForm";

/**
 * JobCoachingLauncher - Direct launcher for Job Coaching entries
 * Opens JobCoachingTimeEntryForm immediately without generic wrapper
 */
export default function JobCoachingLauncher({ clientId, onSuccess }) {
  const [showDialog, setShowDialog] = useState(false);

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="border-orange-200 text-orange-700 hover:bg-orange-50 gap-1.5"
        onClick={() => setShowDialog(true)}
      >
        <Zap className="w-3.5 h-3.5" />
        Add Job Coaching Entry
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Job Coaching Entry</DialogTitle>
          </DialogHeader>
          <JobCoachingTimeEntryForm
            clientId={clientId}
            onSuccess={() => {
              setShowDialog(false);
              onSuccess?.();
            }}
            onCancel={() => setShowDialog(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}