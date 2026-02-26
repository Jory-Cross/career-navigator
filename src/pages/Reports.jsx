import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Users, Briefcase, CheckCircle, Clock, TrendingUp, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function Reports() {
  const [user, setUser] = useState(null);
  const [clients, setClients] = useState([]);
  const [applications, setApplications] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const [allClients, allApps, allTasks, allEntries, allMeetings] = await Promise.all([
        base44.entities.Client.list(),
        base44.entities.JobApplication.list(),
        base44.entities.Task.list(),
        base44.entities.TimeEntry.list(),
        base44.entities.Meeting.list()
      ]);

      // Filter data based on user role
      const filteredClients = user.role === 'management' 
        ? allClients 
        : allClients.filter(c => c.created_by === user.email);
      
      const clientIds = filteredClients.map(c => c.id);

      const filteredApps = user.role === 'management'
        ? allApps
        : allApps.filter(a => clientIds.includes(a.client_id));

      const filteredTasks = user.role === 'management'
        ? allTasks
        : allTasks.filter(t => t.client_ids?.some(id => clientIds.includes(id)));

      const filteredEntries = user.role === 'management'
        ? allEntries
        : allEntries.filter(e => clientIds.includes(e.client_id));

      const filteredMeetings = user.role === 'management'
        ? allMeetings
        : allMeetings.filter(m => clientIds.includes(m.client_id));

      setClients(filteredClients);
      setApplications(filteredApps);
      setTasks(filteredTasks);
      setTimeEntries(filteredEntries);
      setMeetings(filteredMeetings);
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

  const totalClients = clients.length;
  const activeClients = clients.filter(c => c.status === 'active').length;
  const totalApplications = applications.length;
  const totalHours = Math.round(timeEntries.reduce((sum, e) => sum + (e.duration_minutes || 0), 0) / 60);
  const successfulApps = applications.filter(a => ['offer', 'accepted'].includes(a.status)).length;
  const successRate = totalApplications > 0 ? Math.round((successfulApps / totalApplications) * 100) : 0;

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-slate-400">Loading analytics...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Analytics & Reports</h1>
        <p className="text-sm text-slate-500 mt-1">Key metrics and performance insights</p>
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
                <Badge className="mt-2 bg-violet-100 text-violet-700 text-xs">{timeEntries.length} entries</Badge>
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
      </div>
    </div>
  );
}