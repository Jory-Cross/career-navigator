import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { LayoutDashboard, Users, Clock, Menu, X, BarChart3, Calendar, Mail, ChevronDown, Shield, UserCog } from "lucide-react";
import { cn } from "@/lib/utils";
import { base44 } from "@/api/base44Client";

const navItems = [
  { name: "Dashboard", icon: LayoutDashboard, page: "Dashboard" },
  { name: "Clients", icon: Users, page: "Clients" },
  { name: "Employees", icon: UserCog, page: "EmployeePortal", roles: ["admin", "management"] },
  { name: "Calendar", icon: Calendar, page: "Calendar" },
  { name: "Reports", icon: BarChart3, page: "Reports" },
  { name: "Time Tracking", icon: Clock, page: "TimeTracking" },
  { name: "Email Templates", icon: Mail, page: "EmailTemplates" },
];

const ROLE_LABELS = {
  admin: "Admin",
  management: "Management",
  employee: "Employee",
  client: "Client",
  pre_ets: "Pre-ETS",
  dspd: "DSPD"
};

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
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
      }
    }).catch(() => {});
  }, [currentPageName, navigate]);

  const switchRole = async (newRole) => {
    await base44.auth.updateMe({ role: newRole });
    setRoleMenuOpen(false);
    window.location.reload();
  };

  const availableRoles = user?.roles?.length > 1 ? user.roles : null;

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
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30 text-white font-bold text-xs">
                {user?.full_name ? user.full_name.split(' ').map(n => n[0]).join('') : <Users className="w-4 h-4" />}
              </div>
              <div>
                <span className="font-bold text-slate-900 text-sm tracking-tight">{user?.full_name || 'Loading...'}</span>
                {availableRoles && (
                  <div className="text-xs text-slate-500">{ROLE_LABELS[user.role] || user.role}</div>
                )}
              </div>
            </div>
          </div>

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
            <nav className="p-3 space-y-0.5">
              {navItems.filter(item => !item.roles || item.roles.includes(user?.role)).map(item => (
                <Link
                key={item.page}
                to={createPageUrl(item.page)}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                  currentPageName === item.page
                    ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/30"
                    : "text-slate-400 hover:text-white hover:bg-slate-700/50"
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.name}
              </Link>
              ))}
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
    </div>
  );
}