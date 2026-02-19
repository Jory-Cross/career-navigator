import React from "react";
import { Card } from "@/components/ui/card";
import { Clock, Briefcase, FileText, CheckSquare } from "lucide-react";
import { format } from "date-fns";

export default function RecentActivity({ timeEntries, applications, tasks, clients }) {
  const getClientName = (id) => {
    const c = clients.find(c => c.id === id);
    return c ? `${c.first_name} ${c.last_name}` : "—";
  };

  const activities = [
    ...timeEntries.slice(0, 5).map(t => ({
      type: "time",
      icon: Clock,
      color: "text-emerald-600 bg-emerald-50",
      text: `${t.duration_minutes}min ${t.category?.replace(/_/g, " ")} with ${getClientName(t.client_id)}`,
      date: t.created_date
    })),
    ...applications.slice(0, 5).map(a => ({
      type: "application",
      icon: Briefcase,
      color: "text-blue-600 bg-blue-50",
      text: `${a.position} at ${a.company} — ${getClientName(a.client_id)}`,
      date: a.created_date
    })),
    ...tasks.filter(t => t.status === "completed").slice(0, 3).map(t => ({
      type: "task",
      icon: CheckSquare,
      color: "text-violet-600 bg-violet-50",
      text: `Completed: ${t.title}`,
      date: t.updated_date
    }))
  ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8);

  return (
    <Card className="border-0 shadow-sm">
      <div className="p-5 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-800">Recent Activity</h3>
      </div>
      <div className="divide-y divide-slate-50">
        {activities.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">No recent activity</div>
        ) : (
          activities.map((a, i) => (
            <div key={i} className="p-4 flex items-center gap-3">
              <div className={`p-2 rounded-lg ${a.color}`}>
                <a.icon className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-700 truncate">{a.text}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {a.date ? format(new Date(a.date), "MMM d, h:mm a") : ""}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}