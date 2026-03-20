import React, { useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Download, FileText, ChevronDown, ChevronRight } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";

const now = new Date();
const nowYear = now.getFullYear();
const nowMonth = now.getMonth();

const PERIODS = [
  {
    label: `${format(new Date(nowYear, nowMonth, 1), "MMM")} 1–15`,
    start: format(new Date(nowYear, nowMonth, 1), "yyyy-MM-dd"),
    end: format(new Date(nowYear, nowMonth, 15), "yyyy-MM-dd"),
  },
  {
    label: `${format(new Date(nowYear, nowMonth, 16), "MMM")} 16–End`,
    start: format(new Date(nowYear, nowMonth, 16), "yyyy-MM-dd"),
    end: format(new Date(nowYear, nowMonth + 1, 0), "yyyy-MM-dd"),
  },
  {
    label: `${format(new Date(nowYear, nowMonth - 1, 1), "MMM")} 1–15`,
    start: format(new Date(nowYear, nowMonth - 1, 1), "yyyy-MM-dd"),
    end: format(new Date(nowYear, nowMonth - 1, 15), "yyyy-MM-dd"),
  },
  {
    label: `${format(new Date(nowYear, nowMonth - 1, 16), "MMM")} 16–End`,
    start: format(new Date(nowYear, nowMonth - 1, 16), "yyyy-MM-dd"),
    end: format(new Date(nowYear, nowMonth, 0), "yyyy-MM-dd"),
  },
  { label: "Custom", start: "", end: "" },
];

export default function PayrollReport({ timeEntries, allUsers, clients }) {
  const [selectedPeriod, setSelectedPeriod] = useState("0");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [expandedEmployee, setExpandedEmployee] = useState(null);

  const period = PERIODS[parseInt(selectedPeriod)];
  const isCustom = period?.label === "Custom";
  const startDate = isCustom ? customStart : period?.start;
  const endDate = isCustom ? customEnd : period?.end;

  const periodEntries = useMemo(() => {
    return timeEntries.filter(e => {
      if (!e.date) return false;
      if (startDate && e.date < startDate) return false;
      if (endDate && e.date > endDate) return false;
      return true;
    });
  }, [timeEntries, startDate, endDate]);

  // Group by employee email
  const byEmployee = useMemo(() => {
    const map = {};
    periodEntries.forEach(e => {
      const email = e.created_by || "unknown";
      if (!map[email]) map[email] = { entries: [], minutes: 0 };
      map[email].entries.push(e);
      map[email].minutes += e.duration_minutes || 0;
    });
    return map;
  }, [periodEntries]);

  const getEmployeeName = (email) => {
    const u = allUsers.find(u => u.email === email);
    return u?.full_name || email;
  };

  const getClientName = (id) => {
    const c = clients.find(c => c.id === id);
    return c ? `${c.first_name} ${c.last_name}` : "Unknown";
  };

  // Per-employee breakdown by client
  const getClientBreakdown = (entries) => {
    const map = {};
    entries.forEach(e => {
      if (!map[e.client_id]) map[e.client_id] = 0;
      map[e.client_id] += e.duration_minutes || 0;
    });
    return Object.entries(map).map(([id, mins]) => ({
      name: getClientName(id),
      hours: Math.round(mins / 60 * 100) / 100,
      minutes: mins,
      entries: entries.filter(e => e.client_id === id).length
    })).sort((a, b) => b.minutes - a.minutes);
  };

  const exportCSV = () => {
    const rows = [["Employee", "Client", "Sessions", "Minutes", "Hours", "Period Start", "Period End"]];
    Object.entries(byEmployee).forEach(([email, data]) => {
      const empName = getEmployeeName(email);
      const breakdown = getClientBreakdown(data.entries);
      breakdown.forEach(row => {
        rows.push([empName, row.name, row.entries, row.minutes, row.hours, startDate, endDate]);
      });
    });
    const csv = rows.map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payroll_${startDate}_${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalHours = Math.round(Object.values(byEmployee).reduce((s, d) => s + d.minutes, 0) / 60 * 10) / 10;

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" />
          <CardTitle className="text-base">Payroll Report</CardTitle>
        </div>
        <Button size="sm" variant="outline" onClick={exportCSV} disabled={Object.keys(byEmployee).length === 0}>
          <Download className="w-3.5 h-3.5 mr-1" /> Export CSV
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Period Selector */}
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <Label className="text-xs text-slate-500 mb-1 block">Pay Period</Label>
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-52 border-slate-200 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PERIODS.map((p, i) => (
                  <SelectItem key={i} value={String(i)}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {isCustom && (
            <>
              <div>
                <Label className="text-xs text-slate-500 mb-1 block">Start Date</Label>
                <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="w-40 text-sm border-slate-200" />
              </div>
              <div>
                <Label className="text-xs text-slate-500 mb-1 block">End Date</Label>
                <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="w-40 text-sm border-slate-200" />
              </div>
            </>
          )}
          <div className="text-sm text-slate-500 pb-1">
            <span className="font-semibold text-slate-800">{totalHours}h</span> total · <span className="font-semibold text-slate-800">{Object.keys(byEmployee).length}</span> employees
          </div>
        </div>

        {/* Employee Rows */}
        {Object.keys(byEmployee).length === 0 ? (
          <div className="text-center text-sm text-slate-400 py-8">No time entries found for this period.</div>
        ) : (
          <div className="divide-y divide-slate-100 border border-slate-100 rounded-lg overflow-hidden">
            {Object.entries(byEmployee)
              .sort(([, a], [, b]) => b.minutes - a.minutes)
              .map(([email, data]) => {
                const hrs = Math.round(data.minutes / 60 * 100) / 100;
                const isExpanded = expandedEmployee === email;
                const breakdown = getClientBreakdown(data.entries);
                return (
                  <div key={email}>
                    <button
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                      onClick={() => setExpandedEmployee(isExpanded ? null : email)}
                    >
                      <div className="flex items-center gap-3">
                        {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                        <div>
                          <p className="text-sm font-medium text-slate-800">{getEmployeeName(email)}</p>
                          <p className="text-xs text-slate-400">{email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className="bg-blue-50 text-blue-700 border-0 text-xs">{data.entries.length} sessions</Badge>
                        <span className="text-sm font-bold text-slate-800 w-16 text-right">{hrs}h</span>
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="bg-slate-50 border-t border-slate-100">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-slate-400 uppercase tracking-wider">
                              <th className="px-8 py-2 text-left font-medium">Client</th>
                              <th className="px-4 py-2 text-right font-medium">Sessions</th>
                              <th className="px-4 py-2 text-right font-medium">Hours</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {breakdown.map((row, i) => (
                              <tr key={i} className="bg-white">
                                <td className="px-8 py-2 text-slate-700 font-medium">{row.name}</td>
                                <td className="px-4 py-2 text-right text-slate-500">{row.entries}</td>
                                <td className="px-4 py-2 text-right text-slate-800 font-semibold">{row.hours}h</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}