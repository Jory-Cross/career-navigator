import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { GraduationCap, Menu, X, LogOut } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const ceNavItems = {
  ce_instructor: [
    { label: 'Dashboard', path: '/CETrainingPortal' },
    { label: 'My Cohorts', path: '/Cohorts' },
    { label: 'Students', path: '/CEInstructorStudents' },
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

  const handleAvatarUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);

    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const response = await base44.functions.invoke(
        'updateAuthorizedUserProfile',
        { profile: { avatar_url: file_url } }
      );
      const payload = response?.data ?? response ?? {};

      if (!payload?.ok) {
        throw new Error(payload?.error || 'Avatar could not be updated.');
      }

      toast.success('Avatar updated');
      window.location.reload();
    } catch (error) {
      toast.error(error?.message || 'Avatar upload failed.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-violet-50/20 to-slate-50">
      <header className="sticky top-0 z-40 border-b border-slate-200/60 bg-white/90 shadow-sm backdrop-blur-xl">
        <div className="flex h-14 items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <button
              className="p-1.5 lg:hidden"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <div className="flex items-center gap-2">
              <GraduationCap className="h-6 w-6 text-violet-600" />
              <span className="font-bold text-slate-900">CE Training</span>
            </div>
          </div>

          <button
            onClick={() => document.querySelector('input[type=file]')?.click()}
            className="flex items-center gap-2 transition-opacity hover:opacity-80"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 text-xs font-bold text-white shadow-lg">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="avatar" className="h-full w-full object-cover" />
              ) : (
                user?.full_name?.split(' ').map((name) => name[0]).join('') || 'U'
              )}
            </div>
            <div className="text-left">
              <span className="block text-sm font-bold text-slate-900">{user?.full_name || 'Loading...'}</span>
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
        <aside
          className={cn(
            'fixed left-0 top-14 z-30 h-[calc(100vh-3.5rem)] w-56 border-r border-slate-700 bg-gradient-to-b from-slate-900 to-slate-800 shadow-2xl transition-transform duration-300 lg:sticky lg:translate-x-0',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <nav className="flex h-full flex-col p-3">
            <div className="flex-1 space-y-0.5 overflow-y-auto">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      'flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                      isActive
                        ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/30'
                        : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
            <div className="border-t border-slate-700 pt-3">
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

        {sidebarOpen && (
          <div className="fixed inset-0 z-20 bg-black/20 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        <main className="min-h-[calc(100vh-3.5rem)] flex-1 p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
