import React from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, BookOpen, Plus, GraduationCap } from 'lucide-react';

export default function CEInstructorDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Instructor Dashboard</h1>
        <p className="text-slate-600 mt-2">Manage CE training cohorts and review student work.</p>
      </div>

      {/* Action Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* My Cohorts */}
        <Card className="p-6 border-violet-200 hover:border-violet-300 transition-colors hover:shadow-lg">
          <div className="flex items-start justify-between mb-4">
            <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-violet-600" />
            </div>
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">My Cohorts</h3>
          <p className="text-sm text-slate-600 mb-6">
            Create and manage CE training cohorts, invite students, and track progress.
          </p>
          <Link to="/Cohorts">
            <Button className="w-full gap-2">
              <Plus className="w-4 h-4" /> View Cohorts
            </Button>
          </Link>
        </Card>

        {/* Student Discovery Work */}
        <Card className="p-6 border-blue-200 hover:border-blue-300 transition-colors hover:shadow-lg">
          <div className="flex items-start justify-between mb-4">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Student Discovery Work</h3>
          <p className="text-sm text-slate-600 mb-6">
            Review student-created CE training clients and discovery records.
          </p>
          <Button variant="outline" className="w-full gap-2" disabled>
            Coming Soon
          </Button>
        </Card>
      </div>

      {/* Info Card */}
      <Card className="p-6 bg-violet-50 border-violet-200">
        <h3 className="font-semibold text-violet-900 mb-2">👨‍🏫 Instructor Workflow</h3>
        <ol className="text-sm text-violet-800 space-y-2">
          <li><span className="font-medium">1. Create Cohort:</span> Start a new CE training cohort for your students.</li>
          <li><span className="font-medium">2. Invite Students:</span> Add students to your cohort via email invitation.</li>
          <li><span className="font-medium">3. Monitor Progress:</span> Track student client creation and discovery work.</li>
          <li><span className="font-medium">4. Provide Feedback:</span> Review and provide feedback on student assessments.</li>
        </ol>
      </Card>
    </div>
  );
}