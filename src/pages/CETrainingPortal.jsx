import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GraduationCap, Users, BookOpen, Sparkles, Loader2 } from 'lucide-react';

export default function CETrainingPortal() {
  const [user, setUser] = useState(null);
  const [cohort, setCohort] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);

        // Load cohort data if assigned
        if (currentUser?.cohort_id) {
          const cohortData = await base44.entities.CETrainingCohort.get(currentUser.cohort_id);
          setCohort(cohortData);
        }
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

  const isInstructor = user?.cohort_role === 'instructor';
  const isStudent = user?.cohort_role === 'student';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-violet-50 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 flex items-center gap-3">
              <GraduationCap className="w-8 h-8 text-violet-600" />
              CE Training Portal
            </h1>
            {cohort && (
              <p className="text-lg text-slate-600 mt-2">
                {cohort.name}
                {cohort.code && <span className="text-slate-500 ml-2">({cohort.code})</span>}
              </p>
            )}
          </div>
          <Badge className="bg-violet-600 text-white text-base px-4 py-2">
            {isInstructor ? '👨‍🏫 Instructor' : isStudent ? '👨‍🎓 Student' : 'CE Training'}
          </Badge>
        </div>

        {/* Role-Specific Navigation */}
        <div className="grid gap-6 md:grid-cols-2">
          {isInstructor && (
            <>
              {/* Instructor: Cohorts */}
              <Card className="p-6 hover:shadow-lg transition-shadow border-violet-200 hover:border-violet-300">
                <div className="flex items-start justify-between mb-4">
                  <Users className="w-8 h-8 text-violet-600" />
                  <Badge variant="outline" className="border-violet-200">Instructor</Badge>
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-2">My Cohorts</h3>
                <p className="text-sm text-slate-600 mb-4">
                  Manage your CE training cohorts, review student progress, and provide feedback on discovery work.
                </p>
                <a
                  href="/Cohorts"
                  className="inline-block px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors text-sm font-medium"
                >
                  View Cohorts
                </a>
              </Card>

              {/* Instructor: Student Discovery Work */}
              <Card className="p-6 hover:shadow-lg transition-shadow border-violet-200 hover:border-violet-300">
                <div className="flex items-start justify-between mb-4">
                  <BookOpen className="w-8 h-8 text-blue-600" />
                  <Badge variant="outline" className="border-blue-200">Review</Badge>
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-2">Student Discovery Work</h3>
                <p className="text-sm text-slate-600 mb-4">
                  Review CE student client cases, discovery records, vocational themes, and DSR development.
                </p>
                <button
                  disabled
                  className="inline-block px-4 py-2 bg-slate-200 text-slate-500 rounded-lg cursor-not-allowed text-sm font-medium"
                >
                  Coming Soon
                </button>
              </Card>
            </>
          )}

          {isStudent && (
            <>
              {/* Student: My CE Clients */}
              <Card className="p-6 hover:shadow-lg transition-shadow border-violet-200 hover:border-violet-300">
                <div className="flex items-start justify-between mb-4">
                  <Users className="w-8 h-8 text-violet-600" />
                  <Badge variant="outline" className="border-violet-200">Clients</Badge>
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-2">My CE Training Clients</h3>
                <p className="text-sm text-slate-600 mb-4">
                  Access your CE training clients. Create new training clients and conduct discovery assessments.
                </p>
                <button
                  disabled
                  className="inline-block px-4 py-2 bg-slate-200 text-slate-500 rounded-lg cursor-not-allowed text-sm font-medium"
                >
                  Coming Soon
                </button>
              </Card>

              {/* Student: Discovery Work */}
              <Card className="p-6 hover:shadow-lg transition-shadow border-violet-200 hover:border-violet-300">
                <div className="flex items-start justify-between mb-4">
                  <BookOpen className="w-8 h-8 text-blue-600" />
                  <Badge variant="outline" className="border-blue-200">Work</Badge>
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-2">Discovery & DSR Work</h3>
                <p className="text-sm text-slate-600 mb-4">
                  Complete discovery interviews, activities, and develop Discovery Staging Records for your clients.
                </p>
                <button
                  disabled
                  className="inline-block px-4 py-2 bg-slate-200 text-slate-500 rounded-lg cursor-not-allowed text-sm font-medium"
                >
                  Coming Soon
                </button>
              </Card>
            </>
          )}
        </div>

        {/* Info Card */}
        <Card className="p-6 bg-violet-50 border-violet-200">
          <div className="flex items-start gap-4">
            <Sparkles className="w-6 h-6 text-violet-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-violet-900 mb-1">CE Training Portal</h3>
              <p className="text-sm text-violet-800">
                This is a dedicated CE (Customized Employment) training environment separate from operational employment services. 
                All work conducted here is for CE training and certification purposes only.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}