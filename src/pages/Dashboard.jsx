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
  const [user, setUser] = React.useState(null);

  React.useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: clients = [] } = useQuery({
    queryKey: ["clients", user?.role],
    queryFn: async () => {
      const allClients = await base44.entities.Client.list("-created_date");
      if (!user) return allClients;
      if (user.role === 'management') return allClients;
      if (user.role === 'employee') {
        return allClients.filter(c => c.created_by === user.email);
      }
      return [];
    },
    enabled: !!user
  });

  const clientIds = clients.map(c => c.id);

  const { data: applications = [] } = useQuery({
    queryKey: ["applications", user?.role, clientIds.join(',')],
    queryFn: async () => {
      const apps = await base44.entities.JobApplication.list("-created_date");
      if (!user || user.role === 'management') return apps;
      if (user.role === 'employee') {
        return apps.filter(a => clientIds.includes(a.client_id));
      }
      return [];
    },
    enabled: !!user
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks", user?.role, clientIds.join(',')],
    queryFn: async () => {
      const allTasks = await base44.entities.Task.list("-created_date");
      if (!user || user.role === 'management') return allTasks;
      if (user.role === 'employee') {
        return allTasks.filter(t => t.client_ids?.some(id => clientIds.includes(id)));
      }
      return [];
    },
    enabled: !!user
  });

  const { data: timeEntries = [] } = useQuery({
    queryKey: ["timeEntries", user?.role, clientIds.join(',')],
    queryFn: async () => {
      const entries = await base44.entities.TimeEntry.list("-created_date");
      if (!user || user.role === 'management') return entries;
      if (user.role === 'employee') {
        return entries.filter(e => clientIds.includes(e.client_id));
      }
      return [];
    },
    enabled: !!user
  });

  const totalHours = Math.round(timeEntries.reduce((sum, t) => sum + (t.duration_minutes || 0), 0) / 60);
  const activeClients = clients.filter(c => !c.is_archived).length;
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