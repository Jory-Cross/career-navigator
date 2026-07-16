import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, FileDown } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { jsPDF } from "jspdf";
import { toast } from "sonner";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function getBimonthlyPeriod(year, month, half) {
  if (half === "first") {
    return {
      start: new Date(year, month, 1),
      end: new Date(year, month, 15, 23, 59, 59),
    };
  }
  const lastDay = new Date(year, month + 1, 0).getDate();
  return {
    start: new Date(year, month, 16),
    end: new Date(year, month, lastDay, 23, 59, 59),
  };
}

function fmtDate(d) {
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtShortDate(d) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function DspdBimonthlyReportDialog({
  client,
  open,
  onOpenChange,
}) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [half, setHalf] = useState(now.getDate() <= 15 ? "first" : "second");
  const [generating, setGenerating] = useState(false);

  const period = useMemo(
    () => getBimonthlyPeriod(year, month, half),
    [year, month, half]
  );

  const generate = async () => {
    setGenerating(true);
    try {
      const entries = await base44.entities.TimeEntry.filter({
        client_id: client.id,
      });

      const periodEntries = entries
        .filter((e) => {
          if (!e?.date) return false;
          const d = new Date(e.date);
          return d >= period.start && d <= period.end;
        })
        .sort((a, b) => new Date(a.date) - new Date(b.date));

      const totalMinutes = periodEntries.reduce(
        (s, e) => s + (e.duration_minutes || 0),
        0
      );
      const totalHours = (totalMinutes / 60).toFixed(1);

      const doc = new jsPDF({ unit: "mm", format: "letter" });

      // Header
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("DSPD Bimonthly Hours Report", 14, 18);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.text(
        `Client: ${client.first_name || ""} ${client.last_name || ""}`,
        14,
        28
      );
      doc.text(
        `Period: ${fmtDate(period.start)} – ${fmtDate(period.end)}`,
        14,
        35
      );
      if (client.dspd_auth_number) {
        doc.text(`Auth #: ${client.dspd_auth_number}`, 14, 42);
      }
      doc.text(`Total Hours: ${totalHours}`, 120, 42);
      if (client.dspd_monthly_authorized_hours) {
        doc.text(
          `Monthly Authorized: ${client.dspd_monthly_authorized_hours} hrs`,
          14,
          49
        );
      }

      // Table header
      let y = 60;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("Date", 14, y);
      doc.text("Start", 50, y);
      doc.text("End", 68, y);
      doc.text("Hours", 86, y);
      doc.text("Description", 110, y);
      y += 2;
      doc.setDrawColor(200);
      doc.line(14, y, 200, y);
      y += 6;

      // Rows
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      for (const entry of periodEntries) {
        if (y > 245) {
          doc.addPage();
          y = 20;
        }
        const entryDate = fmtShortDate(new Date(entry.date));
        doc.text(entryDate, 14, y);
        doc.text(entry.start_time || "—", 50, y);
        doc.text(entry.end_time || "—", 68, y);
        doc.text(
          ((entry.duration_minutes || 0) / 60).toFixed(1),
          86,
          y
        );
        const desc = (entry.description || "Support session").substring(
          0,
          55
        );
        doc.text(desc, 110, y);
        y += 6;
      }

      if (periodEntries.length === 0) {
        doc.text("No time entries recorded for this period.", 14, y);
      }

      // Total
      y += 4;
      doc.setDrawColor(120);
      doc.line(14, y, 200, y);
      y += 6;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(`Total: ${totalHours} hours`, 14, y);

      // Signature lines
      y += 18;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.line(14, y, 80, y);
      doc.text("Staff Signature", 14, y + 5);
      doc.line(120, y, 186, y);
      doc.text("Date", 120, y + 5);

      const startStr = period.start.toISOString().split("T")[0];
      const endStr = period.end.toISOString().split("T")[0];
      const safeName = `${client.first_name || ""}_${client.last_name || ""}`.replace(/\s/g, "");
      doc.save(`DSPD_Report_${safeName}_${startStr}_to_${endStr}.pdf`);
      toast.success("Report downloaded");
    } catch (error) {
      console.error("[DSPD Report] Failed:", error);
      toast.error("Failed to generate report");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Bimonthly Hours Report</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="text-sm text-slate-600">
            <p className="font-medium text-slate-800">
              {client?.first_name} {client?.last_name}
            </p>
            {client?.dspd_auth_number && (
              <p className="text-xs text-slate-400">
                Auth #: {client.dspd_auth_number}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Month</Label>
              <Select
                value={String(month)}
                onValueChange={(v) => setMonth(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => (
                    <SelectItem key={i} value={String(i)}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Year</Label>
              <Select
                value={String(year)}
                onValueChange={(v) => setYear(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(
                    (y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Period</Label>
            <Select value={half} onValueChange={setHalf}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="first">1st – 15th</SelectItem>
                <SelectItem value="second">16th – End of Month</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded border border-slate-100">
            Report period: {fmtDate(period.start)} – {fmtDate(period.end)}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={generate} disabled={generating} className="gap-2">
            {generating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileDown className="w-4 h-4" />
            )}
            Download PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}