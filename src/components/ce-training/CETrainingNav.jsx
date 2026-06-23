import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { GraduationCap, Menu, X, LogOut, Eye, Camera, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const ceNavItems = {
  ce_instructor: [
    { label: 'Dashboard', path: '/CETrainingPortal' },
    { label: 'My Cohorts', path: '/Cohorts' },
  ],
  ce_student: [
    { label: 'Dashboard', path: '/CETrainingPortal' },
  ],
};

export default function CETrainingNav({ children, user }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const location = useLocation();

  const navItems = ceNavItems[user?.role] || [];

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.auth.updateMe({ avatar_url: file_url });
      toast.success('Avatar updated');
      window.location.reload();
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploadingAvatar(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-violet-50/20 to-slate-50">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-slate-200/60 shadow-sm">
        <div className="flex items-center justify-between h-14 px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden p-1.5"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div className="flex items-center gap-2">
              <GraduationCap className="w-6 h-6 text-violet-600" />
              <span className="font-bold text-slate-900">CE Training</span>
            </div>
          </div>

          <button
            onClick={() => document.querySelector('input[type=file]')?.click()}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <div className="w-8 h-8 rounded-lg overflow-hidden bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg text-white font-bold text-xs shrink-0">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                user?.full_name?.split(' ').map(n => n[0]).join('') || 'U'
              )}
            </div>
            <div className="text-left">
              <span className="font-bold text-slate-900 text-sm">{user?.full_name || 'Loading...'}</span>
              <span className="text-xs text-slate-500">
                {user?.role === 'ce_instructor' ? '👨‍🏫 Instructor' : user?.role === 'ce_student' ? '👨‍🎓 Student' : 'CE Training'}
              </span>
            </div>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
              disabled={uploadingAvatar}
            />
          </button>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={cn(
            'fixed lg:sticky top-14 left-0 z-30 h-[calc(100vh-3.5rem)] w-56 bg-gradient-to-b from-slate-900 to-slate-800 border-r border-slate-700 shadow-2xl transition-transform duration-300 lg:translate-x-0',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <nav className="p-3 flex flex-col h-full">
            <div className="flex-1 overflow-y-auto space-y-0.5">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      'flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                      isActive
                        ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/30'
                        : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
            <div className="pt-3 border-t border-slate-700">
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

        {/* Overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 bg-black/20 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Main Content */}
        <main className="flex-1 min-h-[calc(100vh-3.5rem)] p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}