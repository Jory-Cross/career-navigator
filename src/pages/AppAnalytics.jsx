import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, FunnelChart, Funnel, LabelList, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from "recharts";
import { Briefcase, TrendingUp, Trophy, AlertCircle, Users, Target } from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";

const STATUS_ORDER = ["saved", "applied", "phone_screen", "interview", "final_round", "offer", "accepted"];
const STATUS_LABELS = {
  saved: "Saved", applied: "Applied", phone_screen: "Phone Screen",
  interview: "Interview", final_round: "Final Round", offer: "Offer",
  accepted: "Accepted", rejected: "Rejected", withdrawn: "Withdrawn"
};
const STATUS_COLORS = {
  saved: "#94a3b8", applied: "#3b82f6", phone_screen: "#06b6d4",
  interview: "#8b5cf6", final_round: "#f59e0b", offer: "#10b981",
  accepted: "#22c55e", rejected: "#ef4444", withdrawn: "#9ca3af"
};
const FUNNEL_COLORS = ["#3b82f6", "#06b6d4", "#8b5cf6", "#f59e0b", "#10b981", "#22c55e"];

export default function AppAnalytics() {
  const { data: applications = [], isLoading } = useQuery({
    queryKey: ["all-applications-analytics"],
    queryFn: () => base44.entities.JobApplication.list("-created_date", 500),
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-analytics"],
    queryFn: () => base44.entities.Client.list(),
  });

  const clientMap = useMemo(() => {
    return clients.reduce((acc, c) => { acc[c.id] = c; return acc; }, {});
  }, [clients]);

  const stats = useMemo(() => {
    const total = applications.length;
    const active = applications.filter(a => ["applied", "phone_screen", "interview", "final_round"].includes(a.status)).length;
    const offers = applications.filter(a => ["offer", "accepted"].includes(a.status)).length;
    const rejected = applications.filter(a => a.status === "rejected").length;
    const offerRate = total > 0 ? Math.round((offers / total) * 100) : 0;
    const interviewRate = total > 0 ? Math.round((applications.filter(a => ["interview", "final_round", "offer", "accepted"].includes(a.status)).length / total) * 100) : 0;
    return { total, active, offers, rejected, offerRate, interviewRate };
  }, [applications]);

  const pipelineData = useMemo(() => {
    return STATUS_ORDER.map(s => ({
      name: STATUS_LABELS[s],
      count: applications.filter(a => a.status === s).length,
      fill: FUNNEL_COLORS[STATUS_ORDER.indexOf(s)] || "#94a3b8"
    })).filter(d => d.count > 0);
  }, [applications]);

  const statusBreakdown = useMemo(() => {
    return Object.entries(STATUS_LABELS).map(([k, v]) => ({
      name: v,
      value: applications.filter(a => a.status === k).length,
      color: STATUS_COLORS[k]
    })).filter(d => d.value > 0);
  }, [applications]);

  const monthlyData = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(new Date(), 5 - i);
      return { month: format(d, "MMM"), start: startOfMonth(d), end: endOfMonth(d), count: 0, offers: 0 };
    });
    applications.forEach(app => {
      if (!app.applied_date) return;
      const d = new Date(app.applied_date);
      months.forEach(m => {
        if (isWithinInterval(d, { start: m.start, end: m.end })) {
          m.count++;
          if (["offer", "accepted"].includes(app.status)) m.offers++;
        }
      });
    });
    return months.map(m => ({ month: m.month, Applications: m.count, Offers: m.offers }));
  }, [applications]);

  const topEmployers = useMemo(() => {
    const counts = {};
    applications.forEach(a => {
      if (a.company) counts[a.company] = (counts[a.company] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([company, count]) => ({ company, count }));
  }, [applications]);

  const clientActivity = useMemo(() => {
    const counts = {};
    applications.forEach(a => {
      if (a.client_id) counts[a.client_id] = (counts[a.client_id] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([id, count]) => {
        const c = clientMap[id];
        return { name: c ? `${c.first_name} ${c.last_name}` : "Unknown", count };
      });
  }, [applications, clientMap]);

  const needsFollowUp = useMemo(() => {
    const today = new Date();
    return applications.filter(a => {
      if (!a.follow_up_date) return false;
      return new Date(a.follow_up_date) <= today && !["rejected", "withdrawn", "accepted"].includes(a.status);
    }).length;
  }, [applications]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Application Analytics</h1>
        <p className="text-sm text-slate-500 mt-1">Overview of all job applications across clients</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: "Total Apps", value: stats.total, icon: Briefcase, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Active Pipeline", value: stats.active, icon: TrendingUp, color: "text-violet-600", bg: "bg-violet-50" },
          { label: "Offers", value: stats.offers, icon: Trophy, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Offer Rate", value: `${stats.offerRate}%`, icon: Target, color: "text-amber-600", bg: "bg-amber-50" },
          { label: "Interview Rate", value: `${stats.interviewRate}%`, icon: Users, color: "text-cyan-600", bg: "bg-cyan-50" },
          { label: "Follow-ups Due", value: needsFollowUp, icon: AlertCircle, color: "text-red-600", bg: "bg-red-50" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label} className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center mb-3`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <p className="text-2xl font-bold text-slate-900">{value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Trend */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700">Applications Over Time (6 months)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="Applications" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="Offers" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Status Breakdown Pie */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700">Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-4">
            <ResponsiveContainer width="50%" height={180}>
              <PieChart>
                <Pie data={statusBreakdown} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value">
                  {statusBreakdown.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={(v, n) => [v, n]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-1.5">
              {statusBreakdown.map(item => (
                <div key={item.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: item.color }} />
                    <span className="text-slate-600">{item.name}</span>
                  </div>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{item.value}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline Funnel */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700">Pipeline Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pipelineData.map((item, i) => (
                <div key={item.name} className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 w-24 shrink-0">{item.name}</span>
                  <div className="flex-1 bg-slate-100 rounded-full h-6 relative overflow-hidden">
                    <div
                      className="h-full rounded-full flex items-center px-2 transition-all"
                      style={{
                        width: `${pipelineData[0].count > 0 ? (item.count / pipelineData[0].count) * 100 : 0}%`,
                        background: item.fill,
                        minWidth: item.count > 0 ? "2rem" : 0
                      }}
                    >
                      <span className="text-white text-[10px] font-semibold">{item.count}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top Employers */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700">Top Employers Applied To</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={topEmployers} layout="vertical" margin={{ left: 8 }}>
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="company" tick={{ fontSize: 10 }} width={90} />
                <Tooltip />
                <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Client Activity */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-700">Most Active Clients</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {clientActivity.map(({ name, count }) => (
              <div key={name} className="bg-slate-50 rounded-xl p-3 text-center">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white flex items-center justify-center text-sm font-bold mx-auto mb-2">
                  {name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                </div>
                <p className="text-xs font-medium text-slate-700 truncate">{name}</p>
                <p className="text-lg font-bold text-slate-900">{count}</p>
                <p className="text-[10px] text-slate-400">applications</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}