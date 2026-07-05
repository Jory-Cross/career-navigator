import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  LayoutDashboard,
  Users,
  Clock,
  Menu,
  X,
  BarChart3,
  Calendar,
  Mail,
  Shield,
  UserCog,
  Bot,
  ListChecks,
  Building2,
  GraduationCap,
  Camera,
  Loader2,
  Eye,
  LogOut,
} from "lucide-react";
import { useFeaturePermissions } from "@/lib/useFeaturePermissions";
import { cn, isAdmin } from "@/lib/utils";
import { base44 } from "@/api/base44Client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useViewAs } from "@/lib/ViewAsContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { COMMON_TIMEZONES } from "@/lib/timezoneUtils";

const navItems = [
  { name: "Dashboard", icon: LayoutDashboard, page: "Dashboard", featureKey: "dashboard" },
  { name: "Clients", icon: Users, page: "Clients", featureKey: "clients" },
  { name: "Job Seeker", icon: Users, page: "Clients", featureKey: "job_seeker", indent: true, roles: ["admin", "management", "employee"], param: "?type=job_seeker" },
  { name: "Employed", icon: Users, page: "Clients", featureKey: "employed", indent: true, roles: ["admin", "management", "employee"], param: "?type=employed" },
  { name: "Pre-ETS", icon: GraduationCap, page: "Clients", featureKey: "pre_ets", indent: true, roles: ["admin", "management", "employee"], param: "?type=pre_ets" },
  { name: "DSPD", icon: Users, page: "Clients", featureKey: "dspd", indent: true, roles: ["admin", "management", "employee"], param: "?type=dspd" },
  { name: "Customized Employment", icon: Users, page: "Clients", featureKey: "customized_employment", indent: true, roles: ["admin", "management", "employee"], param: "?type=customized_employment" },
  { name: "Employees", icon: UserCog, page: "EmployeePortal", featureKey: "employees", roles: ["admin", "management"] },
  { name: "Calendar", icon: Calendar, page: "Calendar", featureKey: "calendar" },
  { name: "Reports", icon: BarChart3, page: "Reports", featureKey: "reports" },
  { name: "Time Tracking", icon: Clock, page: "TimeTracking", featureKey: "time_tracking" },
  { name: "Pre-ETS Time Entries", icon: Clock, page: "PreEtsTimeEntries", featureKey: null, indent: true, roles: ["admin", "management", "employee"] },
  { name: "Tasks", icon: ListChecks, page: "Tasks", featureKey: "tasks" },
  { name: "Email Templates", icon: Mail, page: "EmailTemplates", featureKey: "email_templates" },
  { name: "AI Agents", icon: Bot, page: "Agents", featureKey: "ai_agents" },
  { name: "CE Cohorts", icon: GraduationCap, page: "Cohorts", featureKey: null, roles: ["admin", "management"] },
  { name: "App Analytics", icon: BarChart3, page: "AppAnalytics", featureKey: "app_analytics" },
  { name: "My Organization", icon: Building2, page: "OrgDashboard", featureKey: "org_dashboard", roles: ["admin"] },
  {
    name: "Platform Owner",
    icon: Building2,
    page: "PlatformOwnerOrganizations",
    featureKey: null,
    requiresPlatformOwner: true,
  },
  { name: "Permissions", icon: Shield, page: "FeaturePermissions", featureKey: null, roles: ["admin"] },
];

function ViewAsSwitcher({ viewAsUser, setViewAsUser }) {
  const [allUsers, setAllUsers] = React.useState([]);

  React.useEffect(() => {
    setAllUsers([]);
  }, []);

  if (allUsers.length === 0) return null;

  const managers = allUsers.filter((user) => user.role === "management");
  const employees = allUsers.filter((user) => user.role === "employee");

  return (
    <div className="flex items-center gap-2">
      {viewAsUser && (
        <div className="flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
          <Eye className="h-3.5 w-3.5" />
          Viewing as {viewAsUser.full_name || viewAsUser.email}
        </div>
      )}
      <Select
        value={viewAsUser?.id || "admin"}
        onValueChange={(value) => {
          if (value === "admin") setViewAsUser(null);
          else setViewAsUser(allUsers.find((user) => user.id === value) || null);
        }}
      >
        <SelectTrigger className={cn("h-8 w-44 border text-xs", viewAsUser ? "border-amber-300 bg-amber-50 text-amber-800" : "border-slate-200")}>
          <Eye className="mr-1 h-3.5 w-3.5 shrink-0" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="admin">My View (Admin)</SelectItem>
          {managers.length > 0 && <div className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-slate-400">Managers</div>}
          {managers.map((user) => <SelectItem key={user.id} value={user.id}>👤 {user.full_name || user.email}</SelectItem>)}
          {employees.length > 0 && <div className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-slate-400">Employees</div>}
          {employees.map((user) => <SelectItem key={user.id} value={user.id}>👤 {user.full_name || user.email}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * Staff layout constrained during the security remediation freeze.
 *
 * Personal profile changes go through updateAuthorizedUserProfile. Browser role
 * switching and manager reassignment are intentionally unavailable because
 * those fields are server-authorized organization controls.
 */
export default function Layout({ children, currentPageName }) {
  const { viewAsUser, setViewAsUser } = useViewAs();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState(null);
  const { canView } = useFeaturePermissions(user);
  const [showProfile, setShowProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({});
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [isPlatformOwner, setIsPlatformOwner] = useState(false);
  const navigate = useNavigate();

  React.useEffect(() => {
    base44.auth.me().then((currentUser) => {
      setUser(currentUser);

      const role = currentUser?.role;
      const access = currentUser?.access_level;
      const canonicalStaffAccess = {
        admin: "admin",
        management: "staff",
        employee: "staff",
      };

      if (canonicalStaffAccess[role] && canonicalStaffAccess[role] !== access) {
        return;
      }

      if (role === "client" && access === "client_portal" && currentPageName !== "ClientPortal") {
        navigate("/ClientPortal");
      } else if (role === "pre_ets" && access === "client_portal" && currentPageName !== "PreEtsPortal") {
        navigate(createPageUrl("PreEtsPortal"));
      } else if (role === "pre_ets_employer" && access === "pre_ets_employer_portal" && currentPageName !== "PreEtsEmployerPortal") {
        navigate("/PreEtsEmployerPortal");
      }
    }).catch(() => {});
  }, [currentPageName, navigate]);

  React.useEffect(() => {
    let cancelled = false;

    async function loadPlatformOwnerAccess() {
      if (!user?.id) {
        if (!cancelled) setIsPlatformOwner(false);
        return;
      }

      try {
        const result = await base44.functions.invoke("getMyPlatformAccess", {});
        if (!cancelled) {
          setIsPlatformOwner(result?.data?.is_platform_owner === true);
        }
      } catch {
        if (!cancelled) setIsPlatformOwner(false);
      }
    }

    loadPlatformOwnerAccess();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const openProfile = () => {
    setProfileForm({
      phone: user?.phone || "",
      title: user?.title || "",
      avatar_url: user?.avatar_url || "",
      timezone: user?.timezone || "",
    });
    setShowProfile(true);
  };

  const handleAvatarUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setProfileForm((current) => ({ ...current, avatar_url: file_url }));
    } catch {
      toast.error("Profile image upload failed.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const saveProfile = async () => {
    setSavingProfile(true);

    try {
      const response = await base44.functions.invoke("updateAuthorizedUserProfile", {
        profile: {
          title: profileForm.title || "",
          phone: profileForm.phone || "",
          avatar_url: profileForm.avatar_url || "",
          timezone: profileForm.timezone || "",
        },
      });
      const payload = response?.data ?? response ?? {};

      if (!payload?.ok || !payload?.profile) {
        throw new Error(payload?.error || "Profile could not be updated.");
      }

      setUser((currentUser) => ({ ...currentUser, ...payload.profile }));
      toast.success("Profile updated.");
      setShowProfile(false);
    } catch (error) {
      toast.error(error?.message || "Profile could not be updated.");
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

      <header className="sticky top-0 z-40 border-b border-slate-200/60 bg-white/90 shadow-sm backdrop-blur-xl">
        <div className="flex h-14 items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <button className="p-1.5 lg:hidden" onClick={() => setSidebarOpen(!sidebarOpen)}>
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <button onClick={openProfile} className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-600 text-xs font-bold text-white shadow-lg shadow-blue-500/30">
                {user?.avatar_url
                  ? <img src={user.avatar_url} alt="avatar" className="h-full w-full object-cover" />
                  : (user?.full_name ? user.full_name.split(" ").map((name) => name[0]).join("") : <Users className="h-4 w-4" />)
                }
              </div>
              <div className="text-left">
                <span className="text-sm font-bold tracking-tight text-slate-900">{user?.full_name || "Loading..."}</span>
              </div>
            </button>
          </div>

          {isAdmin(user) && (
            <ViewAsSwitcher viewAsUser={viewAsUser} setViewAsUser={setViewAsUser} />
          )}
        </div>
      </header>

      <div className="flex">
        {user?.role !== "client" && user?.role !== "pre_ets" && user?.role !== "dspd" && user?.role !== "pre_ets_employer" && (
          <aside className={cn(
            "fixed left-0 top-14 z-30 h-[calc(100vh-3.5rem)] w-56 border-r border-slate-700 bg-gradient-to-b from-slate-900 to-slate-800 shadow-2xl transition-transform duration-300 lg:sticky lg:translate-x-0",
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}>
            <nav className="flex h-full flex-col p-3">
              <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto">
                {navItems.filter((item) => {
                  if (!user) return false;

                  const userIsAdmin = isAdmin(user);
                  if (item.roles) {
                    const allowed = item.roles.some((role) => {
                      if (role === "admin") return userIsAdmin;
                      return user.role === role;
                    });
                    if (!allowed) return false;
                  }

                  if (item.requiresPlatformOwner && !isPlatformOwner) return false;
                  if (item.featureKey !== null && item.featureKey !== undefined && !canView(item.featureKey)) {
                    return false;
                  }

                  return true;
                }).map((item) => {
                  const currentSearch = window.location.search;
                  const active = currentPageName === item.page && (
                    item.param ? currentSearch === item.param : !currentSearch
                  );

                  return (
                    <Link
                      key={item.page + (item.param || "")}
                      to={createPageUrl(item.page) + (item.param || "")}
                      onClick={() => setSidebarOpen(false)}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                        item.indent && "ml-4 text-xs",
                        active
                          ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/30"
                          : "text-slate-400 hover:bg-slate-700/50 hover:text-white"
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.name}
                    </Link>
                  );
                })}
              </div>
              <div className="mt-3 border-t border-slate-700 pt-3">
                <button
                  onClick={() => base44.auth.logout()}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 transition-all hover:bg-red-600/20 hover:text-white"
                >
                  <LogOut className="h-4 w-4" />
                  Log Out
                </button>
              </div>
            </nav>
          </aside>
        )}

        {sidebarOpen && (
          <div className="fixed inset-0 z-20 bg-black/20 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        <main className="min-h-[calc(100vh-3.5rem)] max-w-7xl flex-1 p-4 lg:p-8">
          {children}
        </main>
      </div>

      <Dialog open={showProfile} onOpenChange={setShowProfile}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-600 text-2xl font-bold text-white">
                  {profileForm.avatar_url
                    ? <img src={profileForm.avatar_url} alt="avatar" className="h-full w-full object-cover" />
                    : (user?.full_name ? user.full_name.split(" ").map((name) => name[0]).join("") : "")
                  }
                </div>
                <label className="absolute -bottom-1 -right-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-slate-800 transition-colors hover:bg-slate-700">
                  {uploadingAvatar ? <Loader2 className="h-3.5 w-3.5 animate-spin text-white" /> : <Camera className="h-3.5 w-3.5 text-white" />}
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
                onChange={(event) => setProfileForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="e.g. Employment Specialist"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Phone</Label>
              <Input
                value={profileForm.phone || ""}
                onChange={(event) => setProfileForm((current) => ({ ...current, phone: event.target.value }))}
                placeholder="e.g. 801-555-1234"
              />
            </div>
            {(user?.role === "admin" || user?.role === "management") && (
              <div className="space-y-1">
                <Label className="text-xs">Timezone</Label>
                <Select
                  value={profileForm.timezone || ""}
                  onValueChange={(value) => setProfileForm((current) => ({ ...current, timezone: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select timezone..." />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMON_TIMEZONES.map((timezone) => (
                      <SelectItem key={timezone.value} value={timezone.value}>{timezone.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => base44.auth.logout()} className="text-red-600 border-red-200 hover:bg-red-50 sm:mr-auto">
              <LogOut className="mr-1 h-4 w-4" /> Log Out
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
