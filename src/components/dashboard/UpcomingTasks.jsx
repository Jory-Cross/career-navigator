import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { format, isPast, isToday } from "date-fns";
import { cn } from "@/lib/utils";

const priorityConfig = {
  low: { color: "bg-slate-100 text-slate-600" },
  medium: { color: "bg-blue-100 text-blue-700" },
  high: { color: "bg-orange-100 text-orange-700" },
  urgent: { color: "bg-red-100 text-red-700" }
};

export default function UpcomingTasks({ tasks, clients, onComplete }) {
  const pendingTasks = tasks
    .filter(t => t.status === "pending" || t.status === "in_progress")
    .sort((a, b) => {
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date) - new Date(b.due_date);
    })
    .slice(0, 8);

  const getClientName = (id) => {
    const c = clients.find(c => c.id === id);
    return c ? `${c.first_name} ${c.last_name}` : "—";
  };

  return (
    <Card className="border-0 shadow-sm">
      <div className="p-5 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-800">Upcoming Tasks</h3>
      </div>
      <div className="divide-y divide-slate-50">
        {pendingTasks.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">No pending tasks</div>
        ) : (
          pendingTasks.map(task => {
            const overdue = task.due_date && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date));
            return (
              <div key={task.id} className="p-4 flex items-start gap-3 hover:bg-slate-25 transition-colors group">
                <button
                  onClick={() => onComplete(task)}
                  className="mt-0.5 w-5 h-5 rounded-full border-2 border-slate-200 flex items-center justify-center hover:border-emerald-400 hover:bg-emerald-50 transition-colors shrink-0"
                >
                  <CheckCircle2 className="w-3 h-3 text-transparent group-hover:text-emerald-400" />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{task.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{getClientName(task.client_id)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge className={cn("text-[10px] border-0", priorityConfig[task.priority]?.color)}>
                    {task.priority}
                  </Badge>
                  {task.due_date && (
                    <span className={cn(
                      "text-[10px] font-medium flex items-center gap-0.5",
                      overdue ? "text-red-500" : isToday(new Date(task.due_date)) ? "text-orange-500" : "text-slate-400"
                    )}>
                      {overdue && <AlertTriangle className="w-3 h-3" />}
                      {format(new Date(task.due_date), "MMM d")}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}