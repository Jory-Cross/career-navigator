import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Briefcase } from "lucide-react";
import Usor96TimeEntryForm from "./Usor96TimeEntryForm";

export default function Usor96Launcher({ clientId, onSuccess }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white"
      >
        <Briefcase className="w-4 h-4 mr-2" />
        Add USOR96 Entry
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New USOR96 Entry</DialogTitle>
          </DialogHeader>
          <Usor96TimeEntryForm
            clientId={clientId}
            onSuccess={(result) => {
              if (onSuccess) onSuccess(result);
              setOpen(false);
            }}
            onCancel={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}