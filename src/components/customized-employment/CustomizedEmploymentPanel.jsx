import React from "react";
import { Card } from "@/components/ui/card";
import { FileText, Home, MessageSquare, MapPin, BriefcaseBusiness } from "lucide-react";

export default function CustomizedEmploymentPanel({ client, currentUser }) {
  return (
    <Card className="border-0 shadow-sm">
      <div className="p-6 space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Customized Employment
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            Discovery workflow for building the Discovery Staging Record, vocational themes, and customized job development plan.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <Home className="h-4 w-4 text-indigo-600" />
              <h4 className="font-medium text-slate-900">
                Home & Community Discovery
              </h4>
            </div>
            <p className="text-sm text-slate-500 mt-2">
              Home observation, daily routines, community activities, neighborhood mapping, natural supports, interests, and observable skills.
            </p>
            <p className="text-xs text-slate-400 mt-3">
              Coming next
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-indigo-600" />
              <h4 className="font-medium text-slate-900">
                Discovery Interviews
              </h4>
            </div>
            <p className="text-sm text-slate-500 mt-2">
              Interviews with family, staff, friends, teachers, providers, employers, and other people who know the client well.
            </p>
            <p className="text-xs text-slate-400 mt-3">
              Coming soon
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-indigo-600" />
              <h4 className="font-medium text-slate-900">
                Discovery Activities
              </h4>
            </div>
            <p className="text-sm text-slate-500 mt-2">
              Task-based discovery activities in familiar and unfamiliar settings, including observed skills, supports, interests, and ecological fit.
            </p>
            <p className="text-xs text-slate-400 mt-3">
              Coming soon
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <BriefcaseBusiness className="h-4 w-4 text-indigo-600" />
              <h4 className="font-medium text-slate-900">
                Vocational Themes
              </h4>
            </div>
            <p className="text-sm text-slate-500 mt-2">
              Emerging vocational themes based on interests, talents, skills, discovery activities, and informational interviews.
            </p>
            <p className="text-xs text-slate-400 mt-3">
              Coming soon
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 md:col-span-2">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-indigo-600" />
              <h4 className="font-medium text-slate-900">
                Discovery Staging Record
              </h4>
            </div>
            <p className="text-sm text-slate-500 mt-2">
              Generated CE intake packet using Discovery evidence, existing assessments, uploaded documents, transportation findings, work observations, and CE-specific discovery records.
            </p>
            <p className="text-xs text-slate-400 mt-3">
              Coming soon
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
