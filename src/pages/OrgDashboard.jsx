import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Building2, Users, UserPlus, CheckCircle2, Crown, Zap, Loader2, Mail, Settings, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const TIER_COLORS = {
  trial: "bg-slate-100 text-slate-600",
  starter: "bg-blue-100 text-blue-700",
  professional: "bg-purple-100 text-purple-700",
  enterprise: "bg-emerald-100 text-emerald-700"
};

export default function OrgDashboard() {
  const [user, setUser] = useState(null);
  const [org, setOrg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showInviteEmployee, setShowInviteEmployee] = useState(false);
  const [showInviteClient, setShowInviteClient] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("employee");
  const [inviting, setInviting] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(async (u) => {
      setUser(u);
      const orgs = await base44.entities.Organization.filter({ owner_email: u.email });
      if (orgs.length > 0) setOrg(orgs[0]);
      setLoading(false);
    }).catch(() => { setLoading(false); base44.auth.redirectToLogin(window.location.href); });
  }, []);

  const { data: employees = [] } = useQuery({
    queryKey: ["org_users", org?.id],
    queryFn: () => base44.entities.User.list(),
    enabled: !!org
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["org_clients", org?.id],
    queryFn: () => base44.entities.Client.list(),
    enabled: !!org
  });

  const handleInviteEmployee = async () => {
    if (!inviteEmail.trim()) { toast.error("Email required"); return; }
    setInviting(true);
    try {
      await base44.users.inviteUser(inviteEmail, inviteRole);
      toast.success(`Invitation sent to ${inviteEmail}`);
      setInviteEmail("");
      setShowInviteEmployee(false);
      queryClient.invalidateQueries({ queryKey: ["org_users"] });
    } catch (e) {
      toast.error(e.message);
    } finally {
      setInviting(false);
    }
  };

  const handleInviteClient = async () => {
    if (!inviteEmail.trim()) { toast.error("Email required"); return; }
    setInviting(true);
    try {
      await base44.users.inviteUser(inviteEmail, "client");
      toast.success(`Client invitation sent to ${inviteEmail}`);
      setInviteEmail("");
      setShowInviteClient(false);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setInviting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  if (!org) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">No Organization Found</h2>
          <p className="text-slate-500 mb-4">You haven't created an organization yet.</p>
          <Button onClick={() => window.location.href = "/Pricing"}>View Plans</Button>
        </div>
      </div>
    );
  }

  const statusColor = org.subscription_status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700";

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Org Header */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-blue-500 via-purple-500 to-emerald-500" />
        <div className="p-6 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-lg shrink-0">
            <Building2 className="w-7 h-7 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-slate-900">{org.name}</h1>
            {org.industry && <p className="text-slate-500 text-sm">{org.industry}</p>}
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge className={TIER_COLORS[org.subscription_tier]}>{org.subscription_tier} plan</Badge>
              <Badge className={statusColor}>{org.subscription_status}</Badge>
              {org.trial_ends_at && org.subscription_status === "trialing" && (
                <Badge className="bg-amber-50 text-amber-700">Trial ends {format(new Date(org.trial_ends_at), "MMM d")}</Badge>
              )}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => window.location.href = "/Pricing"}>
            <Crown className="w-4 h-4 mr-1" /> Upgrade
          </Button>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Employees", value: employees.filter(u => u.role !== "client").length, max: org.max_employees, icon: Users, color: "text-blue-600 bg-blue-50" },
          { label: "Clients", value: clients.length, max: org.max_clients, icon: Users, color: "text-purple-600 bg-purple-50" },
          { label: "Plan", value: org.subscription_tier, icon: Zap, color: "text-emerald-600 bg-emerald-50" },
          { label: "Status", value: org.subscription_status, icon: CheckCircle2, color: "text-slate-600 bg-slate-50" },
        ].map(s => (
          <Card key={s.label} className="border-0 shadow-sm p-4">
            <div className={`w-8 h-8 rounded-lg ${s.color} flex items-center justify-center mb-2`}>
              <s.icon className="w-4 h-4" />
            </div>
            <div className="text-xl font-bold text-slate-900 capitalize">{s.value}{s.max ? `/${s.max}` : ""}</div>
            <div className="text-xs text-slate-500">{s.label}</div>
          </Card>
        ))}
      </div>

      {/* Team Management */}
      <div className="grid sm:grid-cols-2 gap-6">
        {/* Employees */}
        <Card className="border-0 shadow-sm">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">Team Members</h3>
            <Button size="sm" onClick={() => { setInviteRole("employee"); setShowInviteEmployee(true); }}>
              <UserPlus className="w-3.5 h-3.5 mr-1" /> Invite
            </Button>
          </div>
          <div className="divide-y divide-slate-50 max-h-64 overflow-y-auto">
            {employees.filter(u => u.role !== "client").length === 0 ? (
              <p className="p-6 text-center text-sm text-slate-400">No team members yet</p>
            ) : employees.filter(u => u.role !== "client").map(emp => (
              <div key={emp.id} className="p-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-400 flex items-center justify-center text-white text-xs font-semibold shrink-0">
                  {emp.full_name?.split(' ').map(n => n[0]).join('') || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{emp.full_name}</p>
                  <p className="text-xs text-slate-400 truncate">{emp.email}</p>
                </div>
                <Badge className="text-[10px] bg-slate-100 text-slate-600 border-0 capitalize">{emp.role}</Badge>
              </div>
            ))}
          </div>
        </Card>

        {/* Clients */}
        <Card className="border-0 shadow-sm">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">Clients</h3>
            <Button size="sm" onClick={() => { setShowInviteClient(true); }}>
              <UserPlus className="w-3.5 h-3.5 mr-1" /> Invite
            </Button>
          </div>
          <div className="divide-y divide-slate-50 max-h-64 overflow-y-auto">
            {clients.length === 0 ? (
              <p className="p-6 text-center text-sm text-slate-400">No clients yet</p>
            ) : clients.slice(0, 10).map(c => (
              <div key={c.id} className="p-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-400 flex items-center justify-center text-white text-xs font-semibold shrink-0">
                  {c.first_name?.[0]}{c.last_name?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{c.first_name} {c.last_name}</p>
                  <p className="text-xs text-slate-400 truncate">{c.email}</p>
                </div>
                <Badge className={`text-[10px] border-0 capitalize ${c.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{c.status}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Invite Employee Dialog */}
      <Dialog open={showInviteEmployee} onOpenChange={setShowInviteEmployee}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Invite Team Member</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Email</Label>
              <Input type="email" placeholder="colleague@example.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="management">Management</SelectItem>
                  <SelectItem value="employee">Employee</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInviteEmployee(false)}>Cancel</Button>
            <Button onClick={handleInviteEmployee} disabled={inviting}>
              {inviting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
              Send Invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite Client Dialog */}
      <Dialog open={showInviteClient} onOpenChange={setShowInviteClient}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Invite Client</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Client Email</Label>
              <Input type="email" placeholder="client@example.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
            </div>
            <p className="text-xs text-slate-400">The client will receive an email to set up their portal access.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInviteClient(false)}>Cancel</Button>
            <Button onClick={handleInviteClient} disabled={inviting}>
              {inviting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
              Send Invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}