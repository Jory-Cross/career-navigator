import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Mail, Users, ArrowRight } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import InviteStudentDialog from '@/components/cohorts/InviteStudentDialog';

export default function CEInstructorStudents() {
  const [user, setUser] = useState(null);
  const [showInviteStudentDialog, setShowInviteStudentDialog] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: cohorts = [], isLoading: cohortsLoading } = useQuery({
    queryKey: ['ce-cohorts-instructor', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const allCohorts = await base44.entities.CETrainingCohort.filter({
        org_id: user.org_id,
      });

      const memberships = await base44.entities.CETrainingCohortMember.filter({
        user_id: user.id,
        cohort_role: 'manager',
      });

      const managedCohortIds = memberships.map((membership) => membership.cohort_id);
      return allCohorts.filter((cohort) => managedCohortIds.includes(cohort.id));
    },
    enabled: !!user?.id,
  });

   const managedCohortIds = cohorts
    .map((cohort) => cohort.id)
    .sort()
    .join(',');

  const {
    data: studentsData = { active: [], pending: [] },
    isLoading: studentsLoading,
  } = useQuery({
    queryKey: [
      'ce-students-instructor',
      user?.org_id,
      managedCohortIds,
    ],
    queryFn: async () => {
      if (!user?.org_id) {
        return { active: [], pending: [] };
      }

      const [orgUsersResponse, pendingInvites] = await Promise.all([
        base44.functions.invoke('getOrgUsers', {}),
        base44.entities.PendingRoleAssignment.filter({
          org_id: user.org_id,
          role: 'ce_student',
          status: 'pending',
        }),
      ]);

      const activeUsers = Array.isArray(orgUsersResponse.data?.users)
        ? orgUsersResponse.data.users
        : [];

      const registeredStudents = activeUsers.filter(
        (orgUser) => orgUser.role === 'ce_student'
      );

      const activeMembersByCohort = await Promise.all(
        cohorts.map(async (cohort) => {
          const res = await base44.functions.invoke(
            'getCohortMemberships',
            {
              cohort_id: cohort.id,
            }
          );

          if (!res.data?.ok) {
            throw new Error(
              res.data?.error ||
                `Unable to load members for ${cohort.name || 'cohort'}`
            );
          }

          const memberships = Array.isArray(res.data?.memberships)
            ? res.data.memberships
            : [];

          return memberships
            .filter(
              (membership) =>
                membership.cohort_role === 'member' &&
                membership.is_active !== false
            )
            .map((membership) => ({
              ...membership,
              cohort,
            }));
        })
      );

      const cohortMemberships = activeMembersByCohort.flat();

      const cohortsByStudentId = cohortMemberships.reduce(
        (result, membership) => {
          if (!result[membership.user_id]) {
            result[membership.user_id] = [];
          }

          result[membership.user_id].push(membership.cohort);
          return result;
        },
        {}
      );

      const active = registeredStudents.map((student) => ({
        id: student.id,
        email: student.email,
        user: student,
        cohorts: cohortsByStudentId[student.id] || [],
        status: 'active',
      }));

      const pending = pendingInvites.map((invite) => ({
        id: invite.id,
        email: invite.email,
        user: null,
        cohorts: [],
        status: 'pending',
      }));

      return { active, pending };
    },
    enabled: !!user?.org_id && !cohortsLoading,
  });

  const allStudents = [
    ...(studentsData.active || []),
    ...(studentsData.pending || []),
  ];

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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">CE Students</h1>
          <p className="text-slate-600 mt-2">
            Invite CE students, track registration, and assign registered students to cohorts.
          </p>
        </div>

        <Button onClick={() => setShowInviteStudentDialog(true)} className="gap-2">
          <Mail className="w-4 h-4" />
          Invite Student
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4 border-violet-200">
          <div className="text-sm text-slate-600 mb-1">Total Students</div>
          <div className="text-3xl font-bold text-violet-600">{allStudents.length}</div>
          <div className="text-xs text-slate-500 mt-2">
            {studentsData.active?.length || 0} registered · {studentsData.pending?.length || 0} pending
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
          <div className="text-3xl font-bold text-slate-900">
            {studentsData.pending?.length || 0}
          </div>
          <p className="text-xs text-slate-500 mt-2">Awaiting registration</p>
        </Card>
      </div>

      {allStudents.length === 0 ? (
        <Card className="p-12 text-center border-slate-200">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-slate-900 mb-1">No Students Yet</h3>
          <p className="text-slate-600 mb-4">
            Invite a CE student here. Assign the student to a cohort after registration.
          </p>
          <Button onClick={() => setShowInviteStudentDialog(true)} className="gap-2">
            <Mail className="w-4 h-4" />
            Invite Student
          </Button>
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
                  <tr
                    key={student.id || student.email}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">
                        {student.user?.full_name || student.email?.split('@')[0] || '—'}
                      </div>

                      {!student.user && student.email && (
                        <div className="text-xs text-slate-500">Not yet registered</div>
                      )}
                    </td>

                    <td className="px-4 py-3 text-slate-600">
                      {student.email || student.user?.email || '—'}
                    </td>

                    <td className="px-4 py-3">
                      {student.cohorts?.length > 0 ? (
                        <div className="space-y-1">
                          {student.cohorts.map((cohort) => (
                            <div key={cohort.id}>
                              <div className="font-medium text-slate-900">{cohort.name}</div>
                              {cohort.code && (
                                <div className="text-xs text-slate-500">{cohort.code}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-500">
                          {student.status === 'pending' ? 'Assign after registration' : 'Unassigned'}
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {student.status === 'active' ? (
                        <Badge className="bg-green-100 text-green-800 border-green-300">
                          ✓ Registered
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-800 border-amber-300">
                          ⏳ Pending
                        </Badge>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {student.status === 'pending' ? (
                        <span className="text-xs text-slate-500">Awaiting registration</span>
                      ) : student.cohorts?.length > 0 ? (
                        <Link to={`/CohortDetail?cohort_id=${student.cohorts[0].id}`}>
                          <Button variant="outline" size="sm" className="gap-1">
                            View Cohort
                            <ArrowRight className="w-3 h-3" />
                          </Button>
                        </Link>
                      ) : (
                        <Link to="/Cohorts">
                          <Button variant="outline" size="sm" className="gap-1">
                            Assign to Cohort
                            <ArrowRight className="w-3 h-3" />
                          </Button>
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card className="p-6 bg-violet-50 border-violet-200">
        <h3 className="font-semibold text-violet-900 mb-2">📚 Managing Students</h3>
        <ol className="text-sm text-violet-800 space-y-1.5">
          <li><span className="font-medium">1. Invite Student</span> — Send the invitation from this Students page</li>
          <li><span className="font-medium">2. Registration</span> — The student registers for CE Training Portal access</li>
          <li><span className="font-medium">3. Open Cohort Detail</span> — Select the cohort after registration is complete</li>
          <li><span className="font-medium">4. Assign Registered Student</span> — Add the student from Cohort Detail</li>
        </ol>
      </Card>

      <InviteStudentDialog
        open={showInviteStudentDialog}
        onOpenChange={setShowInviteStudentDialog}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['ce-students-instructor'] });
        }}
      />
    </div>
  );
}
