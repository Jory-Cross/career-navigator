import React from 'react';
import { Card } from '@/components/ui/card';
import { Users, BookOpen } from 'lucide-react';

export default function CEStudentDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Welcome to CE Training</h1>
        <p className="text-slate-600 mt-2">Complete discovery work and develop your training clients.</p>
      </div>

      {/* Training Workspace Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* My CE Training Clients */}
        <Card className="p-6 border-violet-200 hover:border-violet-300 transition-colors">
          <div className="flex items-start justify-between mb-4">
            <Users className="w-8 h-8 text-violet-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">My CE Training Clients</h3>
          <p className="text-sm text-slate-600 mb-4">
            Create and manage training clients for discovery assessment and DSR development.
          </p>
          <div className="text-center py-6 bg-slate-50 rounded-lg">
            <p className="text-sm text-slate-500">No CE training clients yet.</p>
            <p className="text-xs text-slate-400 mt-1">Check back after your instructor adds you to a cohort.</p>
          </div>
        </Card>

        {/* Discovery & DSR Work */}
        <Card className="p-6 border-violet-200 hover:border-violet-300 transition-colors">
          <div className="flex items-start justify-between mb-4">
            <BookOpen className="w-8 h-8 text-blue-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Discovery & DSR Work</h3>
          <p className="text-sm text-slate-600 mb-4">
            Complete discovery interviews, activities, and develop Discovery Staging Records.
          </p>
          <div className="text-center py-6 bg-slate-50 rounded-lg">
            <p className="text-sm text-slate-500">No clients assigned yet.</p>
            <p className="text-xs text-slate-400 mt-1">Assessments will appear here once you create a client.</p>
          </div>
        </Card>
      </div>

      {/* Info Card */}
      <Card className="p-6 bg-violet-50 border-violet-200">
        <h3 className="font-semibold text-violet-900 mb-2">📚 About CE Training</h3>
               <p className="text-sm text-violet-800">
          You have access to the Customized Employment (CE) Training Portal. Your instructor will assign you to a
          cohort after registration and guide you through creating training clients and completing discovery
          assessments. This is a dedicated training environment separate from operational employment services.
        </p>
      </Card>
    </div>
  );
}
