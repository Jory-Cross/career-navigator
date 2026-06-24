import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2 } from 'lucide-react';
import CEInstructorDashboard from '@/components/ce-training/CEInstructorDashboard';
import CEStudentDashboard from '@/components/ce-training/CEStudentDashboard';

export default function CETrainingPortal() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        console.error('Error loading CE Training Portal data:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
      </div>
    );
  }

  const isInstructor = user?.role === 'ce_instructor';
  const isStudent = user?.role === 'ce_student';

  if (isInstructor) {
    return <CEInstructorDashboard />;
  }

  if (isStudent) {
    return <CEStudentDashboard />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-violet-50 p-6">
      {/* Default fallback for admin users */}
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">🎓 CE Training Portal</h1>
          <p className="text-slate-600 mt-2">Customized Employment Training Environment</p>
        </div>
        <p className="text-slate-600">
          This is a dedicated CE training environment. Please log in as a CE Instructor or CE Student to access your workspace.
        </p>
      </div>
    </div>
  );
}