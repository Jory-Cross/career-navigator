import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { LayoutDashboard, Users, Clock, Menu, X, BarChart3, Calendar, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { base44 } from "@/api/base44Client";

const navItems = [
  { name: "Dashboard", icon: LayoutDashboard, page: "Dashboard" },
  { name: "Clients", icon: Users, page: "Clients" },
  { name: "Calendar", icon: Calendar, page: "Calendar" },
  { name: "Reports", icon: BarChart3, page: "Reports" },
  { name: "Time Tracking", icon: Clock, page: "TimeTracking" },
  { name: "Email Templates", icon: Mail, page: "EmailTemplates" },
];

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const navigate = useNavigate();

  React.useEffect(() => {
    base44.auth.me().then(user => {
      setUserRole(user?.role);
      // Redirect clients to their portal
      if (user?.role === 'client' && currentPageName !== 'ClientPortal') {
        navigate(createPageUrl('ClientPortal'));
      }
    }).catch(() => {});
  }, [currentPageName, navigate]);

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
              <span className="font-bold text-slate-900 text-sm tracking-tight">{user?.full_name || 'Loading...'}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className={cn(
          "fixed lg:sticky top-14 left-0 z-30 h-[calc(100vh-3.5rem)] w-56 bg-white/95 backdrop-blur-md border-r border-slate-200/60 shadow-xl transition-transform duration-300 lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          <nav className="p-3 space-y-0.5">
            {userRole === 'client' ? (
              <Link
                to={createPageUrl('ClientPortal')}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/30"
              >
                <Users className="w-4 h-4" />
                My Portal
              </Link>
            ) : (
              navItems.map(item => (
                <Link
                key={item.page}
                to={createPageUrl(item.page)}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                  currentPageName === item.page
                    ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/30"
                    : "text-slate-600 hover:text-slate-900 hover:bg-gradient-to-r hover:from-slate-50 hover:to-blue-50/50"
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.name}
              </Link>
              ))
            )}
          </nav>
        </aside>

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