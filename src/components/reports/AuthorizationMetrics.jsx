import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Calendar, Clock, AlertCircle } from "lucide-react";

export default function AuthorizationMetrics() {
  const [metrics, setMetrics] = useState({
    hoursNearExhaustion: 0,
    expiredAuthorizations: 0,
    entriesOutsideDates: 0,
    activeAuthorizations: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    try {
      const [authorizations, entries] = await Promise.all([
        base44.entities.ServiceAuthorization.list(),
        base44.entities.TimeEntry.list()
      ]);

      const now = new Date();
      
      // Hours nearing exhaustion (80%+ used)
      const nearExhaustion = authorizations.filter(a => {
        const used = a.used_hours || 0;
        const total = a.total_authorized_hours || 0;
        return total > 0 && (used / total) >= 0.8;
      }).length;

      // Expired authorizations
      const expired = authorizations.filter(a => {
        const endDate = a.service_end_date ? new Date(a.service_end_date) : null;
        return endDate && endDate < now && a.status !== 'closed';
      }).length;

      // Entries outside authorization dates
      const outsideDates = entries.filter(e => {
        const auth = authorizations.find(a => a.id === e.service_authorization_id);
        if (!auth) return false;
        const entryDate = new Date(e.date);
        const startDate = auth.service_start_date ? new Date(auth.service_start_date) : null;
        const endDate = auth.service_end_date ? new Date(auth.service_end_date) : null;
        return (startDate && entryDate < startDate) || (endDate && entryDate > endDate);
      }).length;

      // Active authorizations
      const active = authorizations.filter(a => a.status === 'active').length;

      setMetrics({
        hoursNearExhaustion: nearExhaustion,
        expiredAuthorizations: expired,
        entriesOutsideDates: outsideDates,
        activeAuthorizations: active
      });
    } catch (error) {
      console.error("Failed to load authorization metrics:", error);
    } finally {
      setLoading(false);
    }
  };

  const metricCards = [
    {
      label: "Hours Nearing Exhaustion",
      value: metrics.hoursNearExhaustion,
      icon: AlertTriangle,
      color: "amber",
      trend: "80%+ utilized",
      severity: "warning"
    },
    {
      label: "Expired Authorizations",
      value: metrics.expiredAuthorizations,
      icon: Calendar,
      color: "red",
      trend: "Action required",
      severity: "critical"
    },
    {
      label: "Entries Outside Auth Dates",
      value: metrics.entriesOutsideDates,
      icon: AlertCircle,
      color: "red",
      trend: "Invalid entries",
      severity: "critical"
    },
    {
      label: "Active Authorizations",
      value: metrics.activeAuthorizations,
      icon: Clock,
      color: "green",
      trend: "Current and valid",
      severity: "normal"
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
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Authorization Management</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {metricCards.map((card, idx) => {
            const Icon = card.icon;
            return (
              <Card key={idx} className={`border-0 shadow-sm ${card.severity === 'critical' ? 'ring-1 ring-red-200 bg-red-50/30' : ''}`}>
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