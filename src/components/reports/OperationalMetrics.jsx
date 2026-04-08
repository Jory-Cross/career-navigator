import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, Clock, AlertTriangle } from "lucide-react";

export default function OperationalMetrics() {
  const [metrics, setMetrics] = useState({
    totalEntries: 0,
    draftEntries: 0,
    missingFields: 0,
    pendingApprovals: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    try {
      const [entries, fieldAnswers] = await Promise.all([
        base44.entities.TimeEntry.list(),
        base44.entities.ReportFieldAnswer.list()
      ]);

      const drafts = entries.filter(e => e.status === 'draft').length;
      const pending = entries.filter(e => e.status === 'submitted' && !e.report_ready).length;
      const incomplete = fieldAnswers.filter(f => !f.required_fields_complete).length;

      setMetrics({
        totalEntries: entries.length,
        draftEntries: drafts,
        missingFields: incomplete,
        pendingApprovals: pending
      });
    } catch (error) {
      console.error("Failed to load operational metrics:", error);
    } finally {
      setLoading(false);
    }
  };

  const metricCards = [
    {
      label: "Total Time Entries",
      value: metrics.totalEntries,
      icon: Clock,
      color: "blue",
      trend: "All entries"
    },
    {
      label: "Draft Entries",
      value: metrics.draftEntries,
      icon: AlertTriangle,
      color: "amber",
      trend: "Unsaved work"
    },
    {
      label: "Missing Required Fields",
      value: metrics.missingFields,
      icon: AlertCircle,
      color: "red",
      trend: "Action needed"
    },
    {
      label: "Pending Approvals",
      value: metrics.pendingApprovals,
      icon: CheckCircle,
      color: "purple",
      trend: "Awaiting review"
    }
  ];

  const colorMap = {
    blue: "bg-blue-100 text-blue-700",
    amber: "bg-amber-100 text-amber-700",
    red: "bg-red-100 text-red-700",
    purple: "bg-purple-100 text-purple-700"
  };

  if (loading) {
    return <div className="text-slate-400 text-sm">Loading metrics...</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Operational Status</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {metricCards.map((card, idx) => {
            const Icon = card.icon;
            return (
              <Card key={idx} className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">{card.label}</p>
                      <p className="text-2xl font-bold text-slate-900">{card.value}</p>
                      <Badge className={`mt-2 text-xs ${colorMap[card.color]} bg-opacity-20`}>
                        {card.trend}
                      </Badge>
                    </div>
                    <div className={`w-10 h-10 ${colorMap[card.color]} bg-opacity-10 rounded-lg flex items-center justify-center`}>
                      <Icon className="w-5 h-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}