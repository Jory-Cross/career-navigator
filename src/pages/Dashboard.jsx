import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Users, Briefcase, Clock, ListChecks } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import ActiveTimer from "@/components/dashboard/ActiveTimer";
import QuickTimeLog from "@/components/dashboard/QuickTimeLog";
import UpcomingTasks from "@/components/dashboard/UpcomingTasks";
import RecentActivity from "@/components/dashboard/RecentActivity";

export default function Dashboard() {
  const queryClient = useQueryClient();

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: () => base44.entities.Client.list("-created_date")
  });

  const { data: applications = [] } = useQuery({
    queryKey: ["applications"],
    queryFn: () => base44.entities.JobApplication.list("-created_date")
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks"],
    queryFn: () => base44.entities.Task.list("-created_date")
  });

  const { data: timeEntries = [] } = useQuery({
    queryKey: ["timeEntries"],
    queryFn: () => base44.entities.TimeEntry.list("-created_date")
  });

  const totalHours = Math.round(timeEntries.reduce((sum, t) => sum + (t.duration_minutes || 0), 0) / 60);
  const activeClients = clients.filter(c => c.status === "active").length;
  const pendingTasks = tasks.filter(t => t.status === "pending" || t.status === "in_progress").length;

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["timeEntries"] });
  };

  const handleCompleteTask = async (task) => {
    await base44.entities.Task.update(task.id, { status: "completed" });
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">Overview of your client management activity</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Active Clients" value={activeClients} icon={Users} color="text-blue-600" bgColor="bg-blue-50" />
        <StatCard label="Applications" value={applications.length} icon={Briefcase} color="text-violet-600" bgColor="bg-violet-50" />
        <StatCard label="Hours Logged" value={`${totalHours}h`} icon={Clock} color="text-emerald-600" bgColor="bg-emerald-50" />
        <StatCard label="Pending Tasks" value={pendingTasks} icon={ListChecks} color="text-orange-600" bgColor="bg-orange-50" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <UpcomingTasks tasks={tasks} clients={clients} onComplete={handleCompleteTask} />
          <RecentActivity timeEntries={timeEntries} applications={applications} tasks={tasks} clients={clients} />
        </div>
        <div className="space-y-6">
          <ActiveTimer clients={clients} onTimeSaved={handleRefresh} />
          <QuickTimeLog clients={clients} onTimeSaved={handleRefresh} />
        </div>
      </div>
    </div>
  );
}