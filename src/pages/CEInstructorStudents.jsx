import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Mail, Users, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

export default function CEInstructorStudents() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  // Fetch instructor's cohorts
  const { data: cohorts = [], isLoading: cohortsLoading } = useQuery({
    queryKey: ['ce-cohorts-instructor', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      // Get all cohorts the instructor manages
      const allCohorts = await base44.entities.CETrainingCohort.filter({
        org_id: user.org_id,
      });
      // Filter to only those where user is a manager
      const memberships = await base44.entities.CETrainingCohortMember.filter({
        user_id: user.id,
        cohort_role: 'manager',
      });
      const managedCohortIds = memberships.map(m => m.cohort_id);
      return allCohorts.filter(c => managedCohortIds.includes(c.id));
    },
    enabled: !!user?.id,
  });

  // Fetch all students (members and pending) across cohorts
  const { data: studentsData = { active: [], pending: [] }, isLoading: studentsLoading } = useQuery({
    queryKey: ['ce-students-instructor', cohorts.map(c => c.id).join(',')],
    queryFn: async () => {
      if (cohorts.length === 0) return { active: [], pending: [] };

      const cohortIds = cohorts.map(c => c.id);

      // Get active members (students)
      const activeMembers = await Promise.all(
        cohortIds.map(cohortId =>
          base44.entities.CETrainingCohortMember.filter({
            cohort_id: cohortId,
            cohort_role: 'student',
            is_active: true,
          })
        )
      ).then(results => results.flat());

      // Get user details for active members
      const activeWithDetails = await Promise.all(
        activeMembers.map(async (member) => {
          const cohort = cohorts.find(c => c.id === member.cohort_id);
          try {
            const userDetail = await base44.entities.User.get(member.user_id);
            return { ...member, cohort, user: userDetail, status: 'active' };
          } catch {
            return { ...member, cohort, user: null, status: 'active' };
          }
        })
      );

      // Get pending invites (CE students only)
      const pendingInvites = await base44.entities.PendingRoleAssignment.filter({
        role: 'ce_student',
        status: 'pending',
      });

      // Filter to only those in instructor's cohorts
      const pendingForInstructor = pendingInvites
        .filter(p => cohortIds.includes(p.cohort_id))
        .map(p => ({
          ...p,
          cohort: cohorts.find(c => c.id === p.cohort_id),
          status: 'pending',
        }));

      return {
        active: activeWithDetails,
        pending: pendingForInstructor,
      };
    },
    enabled: cohorts.length > 0,
  });

  const allStudents = [...(studentsData.active || []), ...(studentsData.pending || [])];
  const isLoading = cohortsLoading || studentsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">CE Students</h1>
        <p className="text-slate-600 mt-2">
          Manage students across your {cohorts.length} cohort{cohorts.length !== 1 ? 's' : ''}.
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4 border-violet-200">
          <div className="text-sm text-slate-600 mb-1">Total Students</div>
          <div className="text-3xl font-bold text-violet-600">{allStudents.length}</div>
          <div className="text-xs text-slate-500 mt-2">
            {studentsData.active?.length || 0} active · {studentsData.pending?.length || 0} pending
          </div>
        </Card>
        <Card className="p-4 border-blue-200">
          <div className="text-sm text-slate-600 mb-1">Your Cohorts</div>
          <div className="text-3xl font-bold text-blue-600">{cohorts.length}</div>
          <Link to="/Cohorts">
            <Button variant="outline" size="sm" className="w-full mt-2">
              View Cohorts
            </Button>
          </Link>
        </Card>
        <Card className="p-4 border-slate-200">
          <div className="text-sm text-slate-600 mb-1">Pending Invitations</div>
          <div className="text-3xl font-bold text-slate-900">{studentsData.pending?.length || 0}</div>
          <p className="text-xs text-slate-500 mt-2">Awaiting registration</p>
        </Card>
      </div>

      {/* Students Table */}
      {allStudents.length === 0 ? (
        <Card className="p-12 text-center border-slate-200">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-slate-900 mb-1">No Students Yet</h3>
          <p className="text-slate-600 mb-4">
            You haven't invited any students. Create a cohort and invite students to get started.
          </p>
          <Link to="/Cohorts">
            <Button>Create Cohort & Invite Students</Button>
          </Link>
        </Card>
      ) : (
        <Card className="border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 text-left font-semibold text-slate-900">Name</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-900">Email</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-900">Cohort</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-900">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-900">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {allStudents.map((student) => (
                  <tr key={student.id || student.email} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">
                        {student.user?.full_name || student.email?.split('@')[0] || '—'}
                      </div>
                      {!student.user && student.email && (
                        <div className="text-xs text-slate-500">Not yet registered</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {student.email || (student.user?.email || '—')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-slate-900 font-medium">{student.cohort?.name || '—'}</div>
                      {student.cohort?.code && (
                        <div className="text-xs text-slate-500">{student.cohort.code}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {student.status === 'active' ? (
                        <Badge className="bg-green-100 text-green-800 border-green-300">
                          ✓ Active
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-800 border-amber-300">
                          ⏳ Pending
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Link to={`/CohortDetail?cohort_id=${student.cohort?.id}`}>
                        <Button variant="outline" size="sm" className="gap-1">
                          View
                          <ArrowRight className="w-3 h-3" />
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Info Card */}
      <Card className="p-6 bg-violet-50 border-violet-200">
        <h3 className="font-semibold text-violet-900 mb-2">📚 Managing Students</h3>
        <ol className="text-sm text-violet-800 space-y-1.5">
          <li><span className="font-medium">1. Go to Cohorts</span> — Create or select a cohort</li>
          <li><span className="font-medium">2. Invite Students</span> — Use the "Invite Student" button in cohort detail</li>
          <li><span className="font-medium">3. Track Status</span> — See pending and active students here</li>
          <li><span className="font-medium">4. Open Cohort</span> — Click "View" to manage students for a cohort</li>
        </ol>
      </Card>
    </div>
  );
}