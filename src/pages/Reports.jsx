import React, { useEffect, useState } from "react";
import { useViewAs } from "@/lib/ViewAsContext";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Users, Briefcase, CheckCircle, Clock, TrendingUp, Calendar } from "lucide-react";
import PayrollReport from "@/components/reports/PayrollReport";
import PDFReportGenerator from "@/components/reports/PDFReportGenerator";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function Reports() {
  const { viewAsUser } = useViewAs();
  const [user, setUser] = useState(null);
  const [clients, setClients] = useState([]);
  const [applications, setApplications] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState("all");
  const [allUsers, setAllUsers] = useState([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const effectiveUser = (user?.role === 'admin' && viewAsUser) ? viewAsUser : user;

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, viewAsUser]);

  const loadData = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const [allClients, allApps, allTasks, allEntries, allMeetings, users] = await Promise.all([
        base44.entities.Client.list(),
        base44.entities.JobApplication.list(),
        base44.entities.Task.list(),
        base44.entities.TimeEntry.list(),
        base44.entities.Meeting.list(),
        base44.entities.User.list()
      ]);

      setAllUsers(users);

      // Use effectiveUser to scope data
      const eff = (user.role === 'admin' && viewAsUser) ? viewAsUser : user;
      let filteredClients;
      if (eff.role === 'admin') {
        filteredClients = allClients;
      } else if (eff.role === 'management') {
        const empIds = users.filter(u => u.manager_id === eff.id).map(u => u.id);
        filteredClients = allClients.filter(c => empIds.includes(c.assigned_employee_id));
      } else {
        filteredClients = allClients.filter(c => c.assigned_employee_id === eff.id || c.created_by === eff.email);
      }
      
      const clientIds = filteredClients.map(c => c.id);

      setClients(filteredClients);
      setApplications(allApps.filter(a => clientIds.includes(a.client_id)));
      setTasks(allTasks.filter(t => t.client_ids?.some(id => clientIds.includes(id))));
      setTimeEntries(eff.role === 'admin' ? allEntries : allEntries.filter(e => clientIds.includes(e.client_id)));
      setMeetings(allMeetings.filter(m => clientIds.includes(m.client_id)));
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Client Acquisition Rate (last 6 months)
  const getClientAcquisition = () => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      months.push({
        month: d.toLocaleString('default', { month: 'short' }),
        count: clients.filter(c => {
          const created = new Date(c.created_date);
          return created.getMonth() === d.getMonth() && created.getFullYear() === d.getFullYear();
        }).length
      });
    }
    return months;
  };

  // Onboarding Completion Time
  const getOnboardingStats = () => {
    const completed = clients.filter(c => c.onboarding_status === 'completed' && c.onboarding_started_date && c.onboarding_completed_date);
    const avgDays = completed.length > 0 
      ? Math.round(completed.reduce((sum, c) => {
          const start = new Date(c.onboarding_started_date);
          const end = new Date(c.onboarding_completed_date);
          return sum + ((end - start) / (1000 * 60 * 60 * 24));
        }, 0) / completed.length)
      : 0;
    
    return {
      avgDays,
      completed: completed.length,
      inProgress: clients.filter(c => c.onboarding_status === 'in_progress').length,
      notStarted: clients.filter(c => c.onboarding_status === 'not_started').length
    };
  };

  // Application Success Rate
  const getApplicationStats = () => {
    const statusCounts = applications.reduce((acc, app) => {
      acc[app.status] = (acc[app.status] || 0) + 1;
      return acc;
    }, {});
    
    return Object.entries(statusCounts).map(([status, count]) => ({
      name: status.replace(/_/g, ' '),
      value: count
    }));
  };

  // Time Logged Per Client
  const getTimePerClient = () => {
    const clientTime = {};
    timeEntries.forEach(entry => {
      if (!clientTime[entry.client_id]) {
        clientTime[entry.client_id] = 0;
      }
      clientTime[entry.client_id] += entry.duration_minutes || 0;
    });
    
    return Object.entries(clientTime)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([clientId, minutes]) => {
        const client = clients.find(c => c.id === clientId);
        return {
          name: client ? `${client.first_name} ${client.last_name}` : 'Unknown',
          hours: Math.round(minutes / 60 * 10) / 10
        };
      });
  };

  const onboardingStats = getOnboardingStats();
  const clientAcquisition = getClientAcquisition();
  const applicationStats = getApplicationStats();
  const timePerClient = getTimePerClient();

  // Filter time entries by date range and employee
  const filteredTimeEntries = timeEntries.filter(e => {
    const employeeMatch = selectedEmployee === 'all' || e.created_by === selectedEmployee;
    
    if (!startDate && !endDate) return employeeMatch;
    
    const entryDate = e.date;
    const dateMatch = (!startDate || entryDate >= startDate) && (!endDate || entryDate <= endDate);
    
    return employeeMatch && dateMatch;
  });

  // Hours by employee
  const getHoursByEmployee = () => {
    const employeeHours = {};
    filteredTimeEntries.forEach(entry => {
      const email = entry.created_by;
      if (!employeeHours[email]) {
        employeeHours[email] = 0;
      }
      employeeHours[email] += entry.duration_minutes || 0;
    });

    return Object.entries(employeeHours)
      .map(([email, minutes]) => {
        const employee = allUsers.find(u => u.email === email);
        return {
          name: employee ? employee.full_name : email,
          email,
          hours: Math.round(minutes / 60 * 10) / 10
        };
      })
      .sort((a, b) => b.hours - a.hours);
  };

  const totalClients = clients.length;
  const activeClients = clients.filter(c => c.status === 'active').length;
  const totalApplications = applications.length;
  const totalHours = Math.round(filteredTimeEntries.reduce((sum, e) => sum + (e.duration_minutes || 0), 0) / 60);
  const successfulApps = applications.filter(a => ['offer', 'accepted'].includes(a.status)).length;
  const successRate = totalApplications > 0 ? Math.round((successfulApps / totalApplications) * 100) : 0;
  const hoursByEmployee = getHoursByEmployee();

  // Compute which employees/management are visible based on hierarchy
  const visibleUsers = (() => {
    if (!effectiveUser) return [];
    if (effectiveUser.role === 'admin') {
      return allUsers.filter(u => u.role === 'employee' || u.role === 'management');
    }
    if (effectiveUser.role === 'management') {
      return allUsers.filter(u => u.role === 'employee' && u.manager_id === effectiveUser.id);
    }
    return [];
  })();

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-slate-400">Loading analytics...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Analytics & Reports</h1>
          <p className="text-sm text-slate-500 mt-1">Key metrics and performance insights</p>
        </div>
        {(user?.role === 'management' || user?.role === 'admin') && (
          <div className="flex gap-3">
            <div className="w-48">
              <Label className="text-xs text-slate-600 mb-1.5 block">Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="border-slate-200 text-sm"
              />
            </div>
            <div className="w-48">
              <Label className="text-xs text-slate-600 mb-1.5 block">End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="border-slate-200 text-sm"
              />
            </div>
            <div className="w-64">
              <Label className="text-xs text-slate-600 mb-1.5 block">Filter by Employee</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger className="border-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Employees</SelectItem>
                  {visibleUsers.map(u => (
                    <SelectItem key={u.id} value={u.email}>
                      {u.full_name || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 mb-1">Total Clients</p>
                <p className="text-2xl font-bold text-slate-900">{totalClients}</p>
                <Badge className="mt-2 bg-green-100 text-green-700 text-xs">{activeClients} active</Badge>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 mb-1">Applications</p>
                <p className="text-2xl font-bold text-slate-900">{totalApplications}</p>
                <Badge className="mt-2 bg-blue-100 text-blue-700 text-xs">{successRate}% success</Badge>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Briefcase className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 mb-1">Total Hours Logged</p>
                <p className="text-2xl font-bold text-slate-900">{totalHours}h</p>
                <Badge className="mt-2 bg-violet-100 text-violet-700 text-xs">
                  {selectedEmployee === 'all' ? 'All employees' : 'Filtered'}
                </Badge>
              </div>
              <div className="w-12 h-12 bg-violet-100 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-violet-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 mb-1">Avg. Onboarding</p>
                <p className="text-2xl font-bold text-slate-900">{onboardingStats.avgDays} days</p>
                <Badge className="mt-2 bg-amber-100 text-amber-700 text-xs">{onboardingStats.completed} completed</Badge>
              </div>
              <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Client Acquisition (Last 6 Months)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={clientAcquisition}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Application Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={applicationStats}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {applicationStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Time Logged per Client (Top 10)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={timePerClient} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="hours" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Onboarding Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-medium text-slate-700">Completed</span>
                </div>
                <span className="text-xl font-bold text-green-700">{onboardingStats.completed}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-blue-600" />
                  <span className="text-sm font-medium text-slate-700">In Progress</span>
                </div>
                <span className="text-xl font-bold text-blue-700">{onboardingStats.inProgress}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-slate-600" />
                  <span className="text-sm font-medium text-slate-700">Not Started</span>
                </div>
                <span className="text-xl font-bold text-slate-700">{onboardingStats.notStarted}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {(user?.role === 'management' || user?.role === 'admin') && (
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Hours by Employee</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={hoursByEmployee}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={80} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="hours" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* PDF Report Generator */}
      {(user?.role === 'admin' || user?.role === 'management' || user?.role === 'employee') && (
        <PDFReportGenerator userRole={user?.role} />
      )}

      {/* Payroll Report - Admin/Management only */}
      {(user?.role === 'admin' || user?.role === 'management') && (
        <PayrollReport
          timeEntries={timeEntries}
          allUsers={visibleUsers}
          clients={clients}
        />
      )}
    </div>
  );
}