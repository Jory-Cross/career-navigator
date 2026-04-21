import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { LayoutDashboard, Users, Clock, Menu, X, BarChart3, Calendar, Mail, ChevronDown, Shield, UserCog, Bot, ListChecks, Building2, GraduationCap, Camera, Loader2, Eye, EyeOff, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useViewAs } from "@/lib/ViewAsContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { COMMON_TIMEZONES } from "@/lib/timezoneUtils";

const navItems = [
  { name: "Dashboard", icon: LayoutDashboard, page: "Dashboard" },
  { name: "Clients", icon: Users, page: "Clients" },
  { name: "Job Seeker", icon: Users, page: "Clients", indent: true, roles: ["admin", "management", "employee"], param: "?type=job_seeker" },
  { name: "Employed", icon: Users, page: "Clients", indent: true, roles: ["admin", "management", "employee"], param: "?type=employed" },
  { name: "Pre-ETS", icon: GraduationCap, page: "PreEtsPortal", indent: true, roles: ["admin", "management", "employee"] },
  { name: "DSPD", icon: Users, page: "DspdPortal", indent: true, roles: ["admin", "management", "employee"] },
  { name: "Employees", icon: UserCog, page: "EmployeePortal", roles: ["admin", "management"] },
  { name: "Calendar", icon: Calendar, page: "Calendar" },
  { name: "Reports", icon: BarChart3, page: "Reports" },
  { name: "Time Tracking", icon: Clock, page: "TimeTracking" },
  { name: "Tasks", icon: ListChecks, page: "Tasks" },
  { name: "Email Templates", icon: Mail, page: "EmailTemplates" },
  { name: "AI Agents", icon: Bot, page: "Agents" },
  { name: "App Analytics", icon: BarChart3, page: "AppAnalytics" },
  { name: "My Organization", icon: Building2, page: "OrgDashboard", roles: ["admin"] },
];

const ROLE_LABELS = {
  admin: "Admin",
  management: "Management",
  employee: "Employee",
  client: "Client",
  pre_ets: "Pre-ETS",
  dspd: "DSPD"
};

function ViewAsSwitcher({ user, viewAsUser, setViewAsUser }) {
  const [allUsers, setAllUsers] = React.useState([]);

  React.useEffect(() => {
  setAllUsers([]);
}, []);

  if (allUsers.length === 0) return null;

  const managers = allUsers.filter(u => u.role === 'management');
  const employees = allUsers.filter(u => u.role === 'employee');

  return (
    <div className="flex items-center gap-2">
      {viewAsUser && (
        <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-100 border border-amber-300 rounded-lg text-amber-800 text-xs font-medium">
          <Eye className="w-3.5 h-3.5" />
          Viewing as {viewAsUser.full_name || viewAsUser.email}
        </div>
      )}
      <Select
        value={viewAsUser?.id || "admin"}
        onValueChange={val => {
          if (val === "admin") setViewAsUser(null);
          else setViewAsUser(allUsers.find(u => u.id === val) || null);
        }}
      >
        <SelectTrigger className={cn("w-44 text-xs border h-8", viewAsUser ? "bg-amber-50 border-amber-300 text-amber-800" : "border-slate-200")}>
          <Eye className="w-3.5 h-3.5 mr-1 shrink-0" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="admin">My View (Admin)</SelectItem>
          {managers.length > 0 && <div className="px-2 py-1 text-xs text-slate-400 font-medium uppercase tracking-wide">Managers</div>}
          {managers.map(u => <SelectItem key={u.id} value={u.id}>👤 {u.full_name || u.email}</SelectItem>)}
          {employees.length > 0 && <div className="px-2 py-1 text-xs text-slate-400 font-medium uppercase tracking-wide">Employees</div>}
          {employees.map(u => <SelectItem key={u.id} value={u.id}>👤 {u.full_name || u.email}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

export default function Layout({ children, currentPageName }) {
  const { viewAsUser, setViewAsUser } = useViewAs();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({});
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [managers, setManagers] = useState([]);
  const navigate = useNavigate();

  React.useEffect(() => {
    base44.auth.me().then(currentUser => {
      setUser(currentUser);
      if (currentUser?.role === 'client' && currentPageName !== 'ClientPortal') {
        navigate('/ClientPortal');
      } else if (currentUser?.role === 'pre_ets' && currentPageName !== 'PreEtsPortal') {
        navigate(createPageUrl('PreEtsPortal'));
      } else if (currentUser?.role === 'dspd' && currentPageName !== 'DspdPortal') {
        navigate(createPageUrl('DspdPortal'));
      } else if (currentUser?.role === 'pre_ets_employer' && currentPageName !== 'PreEtsEmployerPortal') {
        navigate('/PreEtsEmployerPortal');
      }
    }).catch(() => {});
  }, [currentPageName, navigate]);

  const switchRole = async (newRole) => {
    await base44.auth.updateMe({ role: newRole });
    setRoleMenuOpen(false);
    window.location.reload();
  };

  const availableRoles = user?.roles?.length > 1 ? user.roles : null;

  const openProfile = async () => {
    setProfileForm({ phone: user?.phone || "", title: user?.title || "", avatar_url: user?.avatar_url || "", manager_id: user?.manager_id || "", timezone: user?.timezone || "" });
    setShowProfile(true);
    try {
     setManagers([]);
    } catch {}
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setProfileForm(p => ({ ...p, avatar_url: file_url }));
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      await base44.auth.updateMe(profileForm);
      setUser(u => ({ ...u, ...profileForm }));
      toast.success("Profile updated");
      setShowProfile(false);
    } catch {
      toast.error("Failed to save");
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20">
      <style>{`
        :root {
          --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
        }
        body { font-family: var(--font-sans); }
      `}</style>

      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-slate-200/60 shadow-sm">
        <div className="flex items-center justify-between h-14 px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <button className="lg:hidden p-1.5" onClick={() => setSidebarOpen(!sidebarOpen)}>
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <button onClick={openProfile} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 rounded-lg overflow-hidden bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30 text-white font-bold text-xs shrink-0">
                {user?.avatar_url
                  ? <img src={user.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                  : (user?.full_name ? user.full_name.split(' ').map(n => n[0]).join('') : <Users className="w-4 h-4" />)
                }
              </div>
              <div className="text-left">
                <span className="font-bold text-slate-900 text-sm tracking-tight">{user?.full_name || 'Loading...'}</span>
                {availableRoles && (
                  <div className="text-xs text-slate-500">{ROLE_LABELS[user.role] || user.role}</div>
                )}
              </div>
            </button>
          </div>

          {/* View As Switcher - Admin only */}
          {user?.role === 'admin' && (
            <ViewAsSwitcher user={user} viewAsUser={viewAsUser} setViewAsUser={setViewAsUser} />
          )}

          {/* Role Switcher */}
          {availableRoles && (
            <div className="relative">
              <button
                onClick={() => setRoleMenuOpen(o => !o)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200"
              >
                <Shield className="w-3.5 h-3.5 text-purple-600" />
                <span className="text-slate-700">{ROLE_LABELS[user.role] || user.role}</span>
                <ChevronDown className="w-3 h-3 text-slate-500" />
              </button>
              {roleMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setRoleMenuOpen(false)} />
                  <div className="absolute right-0 mt-1 w-44 bg-white border border-slate-200 rounded-lg shadow-xl z-50 py-1">
                    <p className="px-3 py-1.5 text-xs text-slate-400 font-medium uppercase tracking-wide">Switch Role</p>
                    {availableRoles.map(role => (
                      <button
                        key={role}
                        onClick={() => switchRole(role)}
                        className={cn(
                          "w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors flex items-center gap-2",
                          role === user.role ? "text-purple-600 font-medium bg-purple-50" : "text-slate-700"
                        )}
                      >
                        {role === user.role && <div className="w-1.5 h-1.5 rounded-full bg-purple-600" />}
                        {role !== user.role && <div className="w-1.5 h-1.5 rounded-full bg-transparent" />}
                        {ROLE_LABELS[role] || role}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        {user?.role !== 'client' && user?.role !== 'pre_ets' && user?.role !== 'dspd' && (
          <aside className={cn(
            "fixed lg:sticky top-14 left-0 z-30 h-[calc(100vh-3.5rem)] w-56 bg-gradient-to-b from-slate-900 to-slate-800 border-r border-slate-700 shadow-2xl transition-transform duration-300 lg:translate-x-0",
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}>
            <nav className="p-3 space-y-0.5 flex flex-col h-full">
              <div className="flex-1 space-y-0.5">
              {navItems.filter(item => !item.roles || item.roles.includes(user?.role)).map(item => {
                const currentSearch = window.location.search;
                const isActive = currentPageName === item.page && (
                  item.param ? currentSearch === item.param : !currentSearch
                );
                return (
                <Link
                key={item.page + (item.param || '')}
                to={createPageUrl(item.page) + (item.param || '')}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                  item.indent && "ml-4 text-xs",
                  isActive
                    ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/30"
                    : "text-slate-400 hover:text-white hover:bg-slate-700/50"
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.name}
              </Link>
              );
              })}
              </div>
              {/* Logout at bottom of sidebar */}
              <div className="pt-3 mt-3 border-t border-slate-700">
                <button
                  onClick={() => base44.auth.logout()}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-red-600/20 transition-all duration-200"
                >
                  <LogOut className="w-4 h-4" />
                  Log Out
                </button>
              </div>
            </nav>
          </aside>
        )}

        {/* Overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 bg-black/20 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Main */}
        <main className="flex-1 min-h-[calc(100vh-3.5rem)] p-4 lg:p-8 max-w-7xl">
          {children}
        </main>
      </div>

      {/* Profile Edit Dialog */}
      <Dialog open={showProfile} onOpenChange={setShowProfile}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Avatar */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <div className="w-20 h-20 rounded-full overflow-hidden bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-600 flex items-center justify-center text-white text-2xl font-bold">
                  {profileForm.avatar_url
                    ? <img src={profileForm.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                    : (user?.full_name ? user.full_name.split(' ').map(n => n[0]).join('') : '')
                  }
                </div>
                <label className="absolute -bottom-1 -right-1 w-7 h-7 bg-slate-800 hover:bg-slate-700 rounded-full flex items-center justify-center cursor-pointer transition-colors">
                  {uploadingAvatar ? <Loader2 className="w-3.5 h-3.5 text-white animate-spin" /> : <Camera className="w-3.5 h-3.5 text-white" />}
                  <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploadingAvatar} />
                </label>
              </div>
              <p className="text-xs text-slate-500">Click the camera icon to upload a photo</p>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Name</Label>
              <Input value={user?.full_name || ""} disabled className="bg-slate-50 text-slate-500" />
              <p className="text-xs text-slate-400">Name is managed by your account settings</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Job Title</Label>
              <Input
                value={profileForm.title || ""}
                onChange={e => setProfileForm(p => ({ ...p, title: e.target.value }))}
                placeholder="e.g. Employment Specialist"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Phone</Label>
              <Input
                value={profileForm.phone || ""}
                onChange={e => setProfileForm(p => ({ ...p, phone: e.target.value }))}
                placeholder="e.g. 801-555-1234"
              />
            </div>
            {managers.length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs">Assigned Manager / Admin</Label>
                <Select
                  value={profileForm.manager_id || "unset"}
                  onValueChange={val => setProfileForm(p => ({ ...p, manager_id: val === "unset" ? "" : val }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a manager..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unset">— None —</SelectItem>
                    {managers.map(m => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.full_name} <span className="text-slate-400 text-xs ml-1">({ROLE_LABELS[m.role] || m.role})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {(user?.role === 'admin' || user?.role === 'management') && (
              <div className="space-y-1">
                <Label className="text-xs">Timezone</Label>
                <Select
                  value={profileForm.timezone || ""}
                  onValueChange={val => setProfileForm(p => ({ ...p, timezone: val }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select timezone..." />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMON_TIMEZONES.map(tz => (
                      <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => base44.auth.logout()} className="text-red-600 border-red-200 hover:bg-red-50 sm:mr-auto">
              <LogOut className="w-4 h-4 mr-1" /> Log Out
            </Button>
            <Button variant="outline" onClick={() => setShowProfile(false)}>Cancel</Button>
            <Button onClick={saveProfile} disabled={savingProfile || uploadingAvatar}>
              {savingProfile ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
