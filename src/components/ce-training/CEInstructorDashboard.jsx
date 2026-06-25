import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, BookOpen, Plus, GraduationCap, Loader2, ArrowRight } from 'lucide-react';
import CohortFormDialog from '@/components/cohorts/CohortFormDialog';

export default function CEInstructorDashboard() {
  const [user, setUser] = useState(null);
  const [showCreateCohort, setShowCreateCohort] = useState(false);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  // Fetch instructor's cohorts
  const { data: cohorts = [], isLoading: cohortsLoading, refetch: refetchCohorts } = useQuery({
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

    // Fetch assigned registered-student counts for each cohort.
  const { data: cohortStats = {} } = useQuery({
    queryKey: ['ce-cohort-stats', cohorts.map(c => c.id).join(',')],
    queryFn: async () => {
      const stats = {};

      await Promise.all(
        cohorts.map(async (cohort) => {
          const activeMembers = await base44.entities.CETrainingCohortMember.filter({
            cohort_id: cohort.id,
            cohort_role: 'member',
            is_active: true,
          });

          stats[cohort.id] = {
            activeStudents: activeMembers.length,
          };
        })
      );

      return stats;
    },
    enabled: cohorts.length > 0,
  });
  const isLoading = cohortsLoading;

  return (
    <div className="space-y-6">
      {/* Create Cohort Dialog */}
         <CohortFormDialog
        open={showCreateCohort}
        onOpenChange={setShowCreateCohort}
        cohort={null}
        onSubmit={async (payload) => {
          const created = await base44.entities.CETrainingCohort.create({
            ...payload,
            org_id: user.org_id,
          });

          await base44.entities.CETrainingCohortMember.create({
            org_id: user.org_id,
            cohort_id: created.id,
            user_id: user.id,
            cohort_role: "manager",
            is_active: true,
            joined_at: new Date().toISOString(),
            added_by: user.id,
          });

          await refetchCohorts();
        }}
        saving={false}
      />

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Instructor Dashboard</h1>
          <p className="text-slate-600 mt-2">Manage CE training cohorts and your students.</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4 bg-gradient-to-br from-violet-50 to-violet-100 border-violet-200">
          <div className="text-sm text-violet-900 font-medium mb-2">Your Cohorts</div>
          <div className="text-3xl font-bold text-violet-600 mb-3">{cohorts.length}</div>
          <Link to="/Cohorts">
            <Button size="sm" className="w-full gap-2">
              <Users className="w-4 h-4" /> View All
            </Button>
          </Link>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <div className="text-sm text-blue-900 font-medium mb-2">Total Students</div>
          <div className="text-3xl font-bold text-blue-600 mb-3">
            {isLoading ? '—' : cohorts.reduce((sum, c) => sum + (cohortStats[c.id]?.activeStudents || 0), 0)}
          </div>
          <Link to="/CEInstructorStudents">
            <Button size="sm" variant="outline" className="w-full gap-2">
              <Users className="w-4 h-4" /> View Students
            </Button>
          </Link>
        </Card>

               <Card className="p-4 bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <div className="text-sm text-amber-900 font-medium mb-2">Student Invitations</div>
          <div className="text-sm text-amber-800 mb-3">
            Invite students from the Students page. Assign them to a cohort after registration.
          </div>
          <Link to="/CEInstructorStudents">
            <Button size="sm" variant="outline" className="w-full gap-2">
              <Users className="w-4 h-4" /> Invite Students
            </Button>
          </Link>
        </Card>
      </div>

      {/* My Cohorts Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">My Cohorts</h2>
          <Button size="sm" onClick={() => setShowCreateCohort(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Create Cohort
          </Button>
        </div>

        {isLoading ? (
          <Card className="p-8 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-violet-600" />
          </Card>
        ) : cohorts.length === 0 ? (
          <Card className="p-12 text-center border-slate-200">
            <GraduationCap className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-slate-900 mb-1">No Cohorts Yet</h3>
                        <p className="text-slate-600 mb-4">
              Create your first CE training cohort. Registered students can be assigned from Cohort Detail.
            </p>
            <Button onClick={() => setShowCreateCohort(true)} className="gap-2">
              <Plus className="w-4 h-4" /> Create Cohort
            </Button>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {cohorts.map((cohort) => {
                            const stats = cohortStats[cohort.id] || { activeStudents: 0 };
              return (
                <Card key={cohort.id} className="p-6 border-violet-200 hover:border-violet-300 hover:shadow-md transition-all">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-slate-900">{cohort.name}</h3>
                      {cohort.code && <p className="text-sm text-slate-500">{cohort.code}</p>}
                    </div>
                    <Badge className="ml-2" variant="outline">
                      {cohort.status || 'planned'}
                    </Badge>
                  </div>

                  {cohort.description && (
                    <p className="text-sm text-slate-600 mb-3 line-clamp-2">{cohort.description}</p>
                  )}
                  <div className="mb-4 py-3 border-y border-slate-200 text-center">
                    <div className="text-2xl font-bold text-violet-600">{stats.activeStudents}</div>
                    <div className="text-xs text-slate-500">Assigned Registered Students</div>
                  </div>

                  <Link to={`/CohortDetail?cohort_id=${cohort.id}`}>
                    <Button className="w-full gap-2">
                      Open Cohort
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Student Discovery Work Section */}
      {cohorts.length > 0 && (
        <Card className="p-6 border-blue-200 bg-blue-50">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-blue-900 mb-1">📖 Student Discovery Work</h3>
              <p className="text-sm text-blue-800 mb-3">
                Once students create training clients, you'll be able to review their discovery work, provide feedback, and track progress.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Info Card */}
      <Card className="p-6 bg-gradient-to-r from-violet-50 to-purple-50 border-violet-200">
        <h3 className="font-semibold text-slate-900 mb-3">👨‍🏫 Instructor Workflow</h3>
        <ol className="text-sm text-slate-700 space-y-2">
          <li><span className="font-medium text-violet-900">1. Create Cohort:</span> Use "Create Cohort" to start a new CE training group.</li>
          <li><span className="font-medium text-violet-900">2. Open Cohort:</span> Click on your cohort to manage it.</li>
          <li><span className="font-medium text-violet-900">3. Invite Students:</span> Use "Invite Student" button in cohort detail to add students.</li>
          <li><span className="font-medium text-violet-900">4. Track Students:</span> View your student roster and invitation status.</li>
        </ol>
      </Card>
    </div>
  );
}
