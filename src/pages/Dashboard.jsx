import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Users, Briefcase, Clock, ListChecks } from "lucide-react";
import { useNavigate } from "react-router-dom";
import StatCard from "@/components/dashboard/StatCard";
import { useOrg } from "@/lib/useOrg";
import OrgGate from "@/lib/OrgGate";
import ActiveTimer from "@/components/dashboard/ActiveTimer";

import UpcomingTasks from "@/components/dashboard/UpcomingTasks";
import RecentActivity from "@/components/dashboard/RecentActivity";
import AccessRequestsPanel from "@/components/dashboard/AccessRequestsPanel";

const DEFAULT_WIDGETS = {
  stats: true,
  quickLog: true,
  tasks: true,
  activity: true,
};

export default function Dashboard() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { orgId } = useOrg();
  const [user, setUser] = React.useState(null);
  const [widgets, setWidgets] = React.useState(DEFAULT_WIDGETS);

  React.useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});

    const saved = localStorage.getItem("dashboardWidgets");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setWidgets({
          ...DEFAULT_WIDGETS,
          ...parsed,
        });
      } catch {
        setWidgets(DEFAULT_WIDGETS);
      }
    }
  }, []);

  const toggleWidget = (key) => {
    const updated = { ...widgets, [key]: !widgets[key] };
    setWidgets(updated);
    localStorage.setItem("dashboardWidgets", JSON.stringify(updated));
  };

  const { data: allUsers = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => base44.entities.User.list(),
    enabled: !!user,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients", user?.id, user?.role, orgId],
    queryFn: async () => {
      const allClients = orgId
        ? await base44.entities.Client.filter({ org_id: orgId }, "-created_date")
        : await base44.entities.Client.list("-created_date");

      if (!user) return [];
      if (user.role === "admin") return allClients;

      if (user.role === "management") {
        const myEmployeeIds = allUsers
          .filter((u) => u.manager_id === user.id)
          .map((u) => u.id);

        return allClients.filter((c) =>
          myEmployeeIds.includes(c.assigned_employee_id)
        );
      }

      if (user.role === "employee") {
        return allClients.filter((c) => c.assigned_employee_id === user.id);
      }

      return [];
    },
    enabled: !!user && allUsers.length >= 0,
  });

  const clientIds = clients.map((c) => c.id);

  const { data: applications = [] } = useQuery({
    queryKey: ["applications", user?.role, orgId],
    queryFn: async () => {
      const apps = orgId
        ? await base44.entities.JobApplication.filter({ org_id: orgId }, "-created_date")
        : await base44.entities.JobApplication.list("-created_date");

      if (!user || user.role === "management") return apps;

      if (user.role === "employee") {
        return apps.filter((a) => clientIds.includes(a.client_id));
      }

      return [];
    },
    enabled: !!user,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks", user?.role, orgId],
    queryFn: async () => {
      const allTasks = orgId
        ? await base44.entities.Task.filter({ org_id: orgId }, "-created_date")
        : await base44.entities.Task.list("-created_date");

      if (!user || user.role === "management") return allTasks;

      if (user.role === "employee") {
        return allTasks.filter((t) =>
          t.client_ids?.some((id) => clientIds.includes(id))
        );
      }

      return [];
    },
    enabled: !!user,
  });

  const { data: timeEntries = [] } = useQuery({
    queryKey: ["timeEntries", user?.role, orgId],
    queryFn: async () => {
      const entries = orgId
        ? await base44.entities.TimeEntry.filter({ org_id: orgId }, "-created_date")
        : await base44.entities.TimeEntry.list("-created_date");

      if (!user || user.role === "management") return entries;

      if (user.role === "employee") {
        return entries.filter((e) => clientIds.includes(e.client_id));
      }

      return [];
    },
    enabled: !!user,
  });

  const now = new Date();
  const day = now.getDate();
  const year = now.getFullYear();
  const month = now.getMonth();

  const payrollPeriodStart =
    day <= 15 ? new Date(year, month, 1) : new Date(year, month, 16);

  const payrollPeriodEnd =
    day <= 15
      ? new Date(year, month, 15, 23, 59, 59)
      : new Date(year, month + 1, 0, 23, 59, 59);

  const payrollLabel =
    day <= 15
      ? `${now.toLocaleString("default", { month: "short" })} 1–15`
      : `${now.toLocaleString("default", { month: "short" })} 16–End`;

  const payrollEntries = timeEntries.filter((e) => {
    if (!e.date) return false;
    const d = new Date(e.date);
    return d >= payrollPeriodStart && d <= payrollPeriodEnd;
  });

  const totalHours = Math.round(
    payrollEntries.reduce((sum, t) => sum + (t.duration_minutes || 0), 0) / 60
  );

  const activeClients = clients.filter((c) => !c.is_archived).length;
  const pendingTasks = tasks.filter(
    (t) => t.status === "pending" || t.status === "in_progress"
  ).length;

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["timeEntries"] });
  };

  const handleCompleteTask = async (task) => {
    await base44.entities.Task.update(task.id, { status: "completed" });
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
  };

  return (
    <OrgGate>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Dashboard
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Overview of your client management activity
            </p>
          </div>

          <details className="relative">
            <summary className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg cursor-pointer">
              Customize Widgets
            </summary>
            <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-lg shadow-xl p-2 z-10">
              {Object.entries(widgets).map(([key, enabled]) => (
                <label
                  key={key}
                  className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={() => toggleWidget(key)}
                    className="rounded"
                  />
                  <span className="text-xs text-slate-700 capitalize">{key}</span>
                </label>
              ))}
            </div>
          </details>
        </div>

        {(user?.role === "admin" ||
          user?.role === "management" ||
          user?.role === "employee") && <AccessRequestsPanel />}

        {widgets.stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="cursor-pointer" onClick={() => navigate("/Clients")}>
              <StatCard
                label="Active Clients"
                value={activeClients}
                max={clients.length}
                icon={Users}
                color="text-blue-600"
                bgColor="bg-blue-50"
              />
            </div>

            <div className="cursor-pointer" onClick={() => navigate("/Clients")}>
              <StatCard
                label="Applications"
                value={applications.length}
                max={applications.length}
                icon={Briefcase}
                color="text-violet-600"
                bgColor="bg-violet-50"
              />
            </div>

            <div className="cursor-pointer" onClick={() => navigate("/TimeTracking")}>
              <StatCard
                label={`Hours (${payrollLabel})`}
                value={`${totalHours}h`}
                max={totalHours}
                icon={Clock}
                color="text-emerald-600"
                bgColor="bg-emerald-50"
              />
            </div>

            <div className="cursor-pointer" onClick={() => navigate("/Tasks")}>
              <StatCard
                label="Pending Tasks"
                value={pendingTasks}
                max={tasks.length}
                icon={ListChecks}
                color="text-orange-600"
                bgColor="bg-orange-50"
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {widgets.tasks && (
              <UpcomingTasks
                tasks={tasks}
                clients={clients}
                onComplete={handleCompleteTask}
              />
            )}
            {widgets.activity && (
              <RecentActivity
                timeEntries={timeEntries}
                applications={applications}
                tasks={tasks}
                clients={clients}
              />
            )}
          </div>

          <div className="space-y-6">
            <ActiveTimer clients={clients} onTimeSaved={handleRefresh} />

            {widgets.quickLog && (
              <QuickTimeLog clients={clients} onTimeSaved={handleRefresh} />
            )}
          </div>
        </div>
      </div>
    </OrgGate>
  );
}
