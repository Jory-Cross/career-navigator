import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";
import DspdBimonthlyReportDialog from "@/components/dspd/DspdBimonthlyReportDialog";

export default function DspdBimonthlyReportButton({ client }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        className="gap-1.5"
      >
        <FileDown className="w-3.5 h-3.5" /> Bimonthly Report
      </Button>
      <DspdBimonthlyReportDialog
        client={client}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}