import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Archive } from "lucide-react";
import ClientCard from "@/components/clients/ClientCard";
import NewClientDialog from "@/components/clients/NewClientDialog";

export default function Clients() {
  const location = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  useEffect(() => {
    // Sync type filter with URL parameter whenever location changes
    const urlParams = new URLSearchParams(location.search);
    const typeParam = urlParams.get("type");
    setTypeFilter(typeParam || "all");
  }, [location.search]);

  const { data: allUsers = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => base44.entities.User.list(),
    enabled: !!user
  });

  const { data: clients = [], refetch } = useQuery({
    queryKey: ["clients", user?.id, user?.role],
    queryFn: async () => {
      const allClients = await base44.entities.Client.list("-created_date");
      if (!user) return allClients;
      // Admin sees all clients
      if (user.role === 'admin') return allClients;
      // Management sees clients assigned to employees under them
      if (user.role === 'management') {
        const myEmployeeIds = allUsers.filter(u => u.manager_id === user.id).map(u => u.id);
        return allClients.filter(c => myEmployeeIds.includes(c.assigned_employee_id));
      }
      // Employees see only clients assigned to them
      return allClients.filter(c => c.assigned_employee_id === user.id);
    },
    enabled: !!user && allUsers.length >= 0
  });

  const { data: timeEntries = [] } = useQuery({
    queryKey: ["timeEntries"],
    queryFn: () => base44.entities.TimeEntry.list()
  });

  const { data: applications = [] } = useQuery({
    queryKey: ["applications"],
    queryFn: () => base44.entities.JobApplication.list()
  });

  const getClientHours = (clientId) => {
    const mins = timeEntries.filter(t => t.client_id === clientId).reduce((s, t) => s + (t.duration_minutes || 0), 0);
    return Math.round(mins / 60 * 10) / 10;
  };

  const getClientApps = (clientId) => applications.filter(a => a.client_id === clientId).length;

  const activeClientsCount = clients.filter(c => !c.is_archived).length;

  const filtered = clients.filter(c => {
    const matchSearch = `${c.first_name} ${c.last_name} ${c.email}`.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    const matchType = typeFilter === "all" || (c.client_type || "job_seeker") === typeFilter;
    const matchArchived = showArchived ? c.is_archived : !c.is_archived;
    const matchEmployee = employeeFilter === "all" || c.assigned_employee_id === employeeFilter;
    return matchSearch && matchStatus && matchType && matchArchived && matchEmployee;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Clients</h1>
          <p className="text-sm text-slate-500 mt-1">{activeClientsCount} active clients</p>
        </div>
        <Button onClick={() => setShowNew(true)} className="bg-slate-900 hover:bg-slate-800 text-white">
          <Plus className="w-4 h-4 mr-2" /> New Client
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search clients..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 border-slate-200"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 border-slate-200">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40 border-slate-200">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="job_seeker">Job Seeker</SelectItem>
            <SelectItem value="pre_ets">Pre-ETS</SelectItem>
            <SelectItem value="dspd">DSPD</SelectItem>
            <SelectItem value="employed">Employed</SelectItem>
          </SelectContent>
        </Select>
        {(user?.role === 'admin' || user?.role === 'management') && (() => {
          const visibleEmployees = user.role === 'admin'
            ? allUsers.filter(u => u.role === 'employee')
            : allUsers.filter(u => u.role === 'employee' && u.manager_id === user.id);
          return visibleEmployees.length > 0 ? (
            <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
              <SelectTrigger className="w-44 border-slate-200">
                <SelectValue placeholder="All Employees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employees</SelectItem>
                {visibleEmployees.map(e => (
                  <SelectItem key={e.id} value={e.id}>{e.full_name || e.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null;
        })()}
        <Button
          variant={showArchived ? "default" : "outline"}
          onClick={() => setShowArchived(!showArchived)}
          className="gap-2"
        >
          <Archive className="w-4 h-4" />
          {showArchived ? "Active" : "Archived"}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(client => (
          <ClientCard
            key={client.id}
            client={client}
            totalHours={getClientHours(client.id)}
            applicationCount={getClientApps(client.id)}
            onArchiveToggle={refetch}
            canAssign={user?.role === 'admin' || user?.role === 'management'}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <p className="text-slate-400 text-sm">No clients found</p>
        </div>
      )}

      <NewClientDialog open={showNew} onOpenChange={setShowNew} onCreated={refetch} />
    </div>
  );
}