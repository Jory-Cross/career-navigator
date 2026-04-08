import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, FileText, AlertTriangle, Users } from "lucide-react";

export default function ComplianceMetrics() {
  const [metrics, setMetrics] = useState({
    reportReady: 0,
    generatedThisMonth: 0,
    failedReports: 0,
    clientsMissingData: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    try {
      const [entries, reports, clients] = await Promise.all([
        base44.entities.TimeEntry.list(),
        base44.entities.GeneratedReport.list(),
        base44.entities.Client.list()
      ]);

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      
      const reportReady = entries.filter(e => e.report_ready).length;
      const thisMonth = reports.filter(r => {
        const rDate = new Date(r.generated_at);
        return rDate >= monthStart;
      }).length;
      const failed = reports.filter(r => r.is_final && r.locked === false).length;
      const missingData = clients.filter(c => !c.vocational_facts_profile || !c.authorization_summary).length;

      setMetrics({
        reportReady,
        generatedThisMonth: thisMonth,
        failedReports: failed,
        clientsMissingData: missingData
      });
    } catch (error) {
      console.error("Failed to load compliance metrics:", error);
    } finally {
      setLoading(false);
    }
  };

  const metricCards = [
    {
      label: "Report-Ready Entries",
      value: metrics.reportReady,
      icon: CheckCircle2,
      color: "green",
      trend: "Ready to report"
    },
    {
      label: "Generated This Month",
      value: metrics.generatedThisMonth,
      icon: FileText,
      color: "blue",
      trend: `Since ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    },
    {
      label: "Failed Batch Reports",
      value: metrics.failedReports,
      icon: AlertTriangle,
      color: "red",
      trend: "Requires retry"
    },
    {
      label: "Clients Missing Report Data",
      value: metrics.clientsMissingData,
      icon: Users,
      color: "amber",
      trend: "Incomplete setup"
    }
  ];

  const colorMap = {
    green: "bg-green-100 text-green-700",
    blue: "bg-blue-100 text-blue-700",
    red: "bg-red-100 text-red-700",
    amber: "bg-amber-100 text-amber-700"
  };

  if (loading) {
    return <div className="text-slate-400 text-sm">Loading metrics...</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Compliance & Reporting</h3>
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