import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Clock, Activity, Briefcase, CheckSquare, Link as LinkIcon, Filter, ChevronDown, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { cn } from "@/lib/utils";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";

const catColors = {
  consultation: "bg-emerald-50 text-emerald-700",
  resume_work: "bg-blue-50 text-blue-700",
  job_search: "bg-violet-50 text-violet-700",
  interview_prep: "bg-amber-50 text-amber-700",
  follow_up: "bg-cyan-50 text-cyan-700",
  admin: "bg-slate-50 text-slate-600",
  other: "bg-gray-50 text-gray-600"
};

const statusColors = {
  active: "bg-emerald-100 text-emerald-700",
  inactive: "bg-slate-100 text-slate-500",
  completed: "bg-blue-100 text-blue-700",
};

const activityIcons = {
  email_sent: "📧",
  task_created: "✅",
  task_completed: "✅",
  application_created: "📋",
  application_updated: "📋",
  document_uploaded: "📄",
  meeting_scheduled: "📅",
  time_logged: "⏱️",
  note_added: "📝",
  status_changed: "🔄",
  onboarding_step: "🚀",
};

export default function EmployeeDetail({ employee, currentUser }) {
  const [timePeriod, setTimePeriod] = useState("all");
  const [timeClientFilter, setTimeClientFilter] = useState("all");
  const [expandedClient, setExpandedClient] = useState(null);
  const initials = `${employee.full_name?.split(' ')[0]?.[0] || ''}${employee.full_name?.split(' ')[1]?.[0] || ''}`;

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-for-employee", employee.id],
    queryFn: async () => {
      const all = await base44.entities.Client.list();
      return all.filter(c => c.assigned_employee_id === employee.id);
    }
  });

  const clientIds = clients.map(c => c.id);

  const { data: timeEntries = [] } = useQuery({
    queryKey: ["time-for-employee-detail", employee.id],
    queryFn: async () => {
      const all = await base44.entities.TimeEntry.list("-created_date");
      return all.filter(t => clientIds.includes(t.client_id));
    },
    enabled: clientIds.length > 0
  });

  const { data: activities = [] } = useQuery({
    queryKey: ["activity-for-employee", employee.id],
    queryFn: async () => {
      const all = await base44.entities.Activity.list("-created_date", 100);
      return all.filter(a => clientIds.includes(a.client_id));
    },
    enabled: clientIds.length > 0
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks-for-employee", employee.id],
    queryFn: async () => {
      const all = await base44.entities.Task.list("-created_date");
      return all.filter(t => t.client_ids?.some(id => clientIds.includes(id)));
    },
    enabled: clientIds.length > 0
  });

  const totalHours = Math.round(timeEntries.reduce((s, t) => s + (t.duration_minutes || 0), 0) / 60);
  const activeClients = clients.filter(c => !c.is_archived).length;
  const pendingTasks = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length;

  const getClientName = (clientId) => {
    const c = clients.find(c => c.id === clientId);
    return c ? `${c.first_name} ${c.last_name}` : "Unknown";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-0 shadow-sm p-6">
        <div className="flex items-start gap-5">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-white font-bold text-lg shrink-0">
            {initials || '?'}
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">{employee.full_name || employee.email}</h2>
            <p className="text-sm text-slate-500">{employee.email}</p>
            <Badge className="mt-1 text-xs bg-purple-100 text-purple-700 border-0">{employee.role}</Badge>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-5 border-t border-slate-100">
          {[
            { label: "Active Clients", value: activeClients, icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
            { label: "Total Clients", value: clients.length, icon: Users, color: "text-slate-600", bg: "bg-slate-50" },
            { label: "Hours Logged", value: `${totalHours}h`, icon: Clock, color: "text-emerald-600", bg: "bg-emerald-50" },
            { label: "Pending Tasks", value: pendingTasks, icon: CheckSquare, color: "text-orange-600", bg: "bg-orange-50" },
          ].map(stat => (
            <div key={stat.label} className={cn("rounded-xl p-4", stat.bg)}>
              <stat.icon className={cn("w-5 h-5 mb-2", stat.color)} />
              <div className="text-2xl font-bold text-slate-900">{stat.value}</div>
              <div className="text-xs text-slate-500 mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="clients">
        <TabsList className="bg-white border border-slate-200 shadow-sm">
          <TabsTrigger value="clients">Assigned Clients ({clients.length})</TabsTrigger>
          <TabsTrigger value="activity">Activity ({activities.length})</TabsTrigger>
          <TabsTrigger value="time">Time Entries ({timeEntries.length})</TabsTrigger>
          <TabsTrigger value="tasks">Tasks ({tasks.length})</TabsTrigger>
        </TabsList>

        {/* Clients Tab */}
        <TabsContent value="clients" className="mt-4">
          <div className="space-y-3">
            {clients.length === 0 && <p className="text-slate-400 text-sm text-center py-8">No clients assigned</p>}
            {clients.map(client => (
              <Link key={client.id} to={createPageUrl("ClientDetail") + `?id=${client.id}`}>
                <Card className="border-0 shadow-sm hover:shadow-md transition-all p-4 cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white text-xs font-semibold shrink-0">
                      {client.first_name?.[0]}{client.last_name?.[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900 text-sm">{client.first_name} {client.last_name}</span>
                        <Badge className={cn("text-[10px] border-0", statusColors[client.status])}>{client.status}</Badge>
                        {client.is_archived && <Badge className="text-[10px] border-0 bg-slate-100 text-slate-400">archived</Badge>}
                      </div>
                      <p className="text-xs text-slate-400 truncate">{client.email}</p>
                    </div>
                    <div className="flex items-center gap-1 text-slate-300">
                      <LinkIcon className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="mt-4">
          <Card className="border-0 shadow-sm p-4">
            <div className="space-y-3">
              {activities.length === 0 && <p className="text-slate-400 text-sm text-center py-8">No activity yet</p>}
              {activities.slice(0, 50).map(act => (
                <div key={act.id} className="flex items-start gap-3 py-2 border-b border-slate-50 last:border-0">
                  <span className="text-lg shrink-0">{activityIcons[act.activity_type] || "📌"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800">{act.title}</p>
                    {act.description && <p className="text-xs text-slate-400 mt-0.5">{act.description}</p>}
                    <p className="text-xs text-slate-300 mt-1">
                      {getClientName(act.client_id)} · {act.created_date ? format(new Date(act.created_date), "MMM d, yyyy h:mm a") : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* Time Tab */}
        <TabsContent value="time" className="mt-4">
          <TimeEntriesDrillDown
            timeEntries={timeEntries}
            clients={clients}
            timePeriod={timePeriod}
            setTimePeriod={setTimePeriod}
            timeClientFilter={timeClientFilter}
            setTimeClientFilter={setTimeClientFilter}
            expandedClient={expandedClient}
            setExpandedClient={setExpandedClient}
            getClientName={getClientName}
          />
        </TabsContent>

        {/* Tasks Tab */}
        <TabsContent value="tasks" className="mt-4">
          <Card className="border-0 shadow-sm p-4">
            <div className="space-y-3">
              {tasks.length === 0 && <p className="text-slate-400 text-sm text-center py-8">No tasks yet</p>}
              {tasks.map(task => (
                <div key={task.id} className="flex items-start justify-between py-2 border-b border-slate-50 last:border-0 gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800">{task.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {task.category} {task.due_date ? `· Due ${format(new Date(task.due_date), "MMM d")}` : ""}
                    </p>
                  </div>
                  <Badge className={cn("border-0 text-xs shrink-0", {
                    "bg-orange-100 text-orange-700": task.status === 'pending',
                    "bg-blue-100 text-blue-700": task.status === 'in_progress',
                    "bg-emerald-100 text-emerald-700": task.status === 'completed',
                    "bg-slate-100 text-slate-500": task.status === 'cancelled',
                  })}>
                    {task.status?.replace('_', ' ')}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}