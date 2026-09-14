import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ListChecks } from "lucide-react";

const priorityColors = {
  low: "bg-slate-100 text-slate-500",
  medium: "bg-blue-50 text-blue-600",
  high: "bg-amber-50 text-amber-700",
  urgent: "bg-red-50 text-red-600",
};

export default function EmployeeTasksSection({ employeeId, employeeClientIds, clientsById }) {
  const { data: tasks = [], isLoading, error } = useQuery({
    queryKey: ["employee-workspace", employeeId, "tasks"],
    queryFn: async () => {
      const all = await base44.entities.Task.list();
      const clientIds = new Set(employeeClientIds);
      return all
        .filter(task =>
          !task.is_archived &&
          ["pending", "in_progress"].includes(task.status) &&
          (
            (Array.isArray(task.client_ids) && task.client_ids.some(id => clientIds.has(id))) ||
            task.created_by_id === employeeId
          )
        )
        .sort((a, b) => (a.due_date || "9999-12-31").localeCompare(b.due_date || "9999-12-31"))
        .slice(0, 8);
    },
    enabled: !!employeeId,
  });

  const clientName = (id) => {
    const c = id ? clientsById.get(id) : null;
    return c ? `${c.first_name || ''} ${c.last_name || ''}`.trim() : null;
  };

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <ListChecks className="w-4 h-4 text-slate-400" /> Open Tasks
        </h3>
        <Badge className="bg-slate-100 text-slate-600 border-0 text-xs">{tasks.length}</Badge>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-400 py-2">Loading tasks…</p>
      ) : error ? (
        <p className="text-sm text-red-500 py-2">{error.message || "Tasks could not be loaded."}</p>
      ) : tasks.length === 0 ? (
        <p className="text-sm text-slate-400 py-2">No open tasks for this employee's clients.</p>
      ) : (
        <div className="space-y-1.5">
          {tasks.map(task => (
            <div key={task.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-100 bg-slate-50/60">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700 truncate">{task.title}</p>
                <p className="text-xs text-slate-400 truncate">
                  {Array.isArray(task.client_ids) && task.client_ids.length > 0
                    ? (clientName(task.client_ids[0]) || `${task.client_ids.length} client(s)`)
                    : "General"}
                  {task.due_date ? ` · Due ${task.due_date}` : ""}
                </p>
              </div>
              {task.priority && (
                <Badge className={`border-0 text-[10px] shrink-0 ${priorityColors[task.priority] || "bg-slate-100 text-slate-500"}`}>
                  {task.priority}
                </Badge>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}