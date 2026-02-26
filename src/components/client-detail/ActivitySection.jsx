import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Mail, 
  CheckSquare, 
  FileText, 
  Calendar, 
  Clock, 
  LogIn, 
  StickyNote,
  TrendingUp,
  Plus
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const activityIcons = {
  email_sent: { icon: Mail, color: "text-blue-600 bg-blue-50" },
  task_created: { icon: Plus, color: "text-green-600 bg-green-50" },
  task_updated: { icon: CheckSquare, color: "text-amber-600 bg-amber-50" },
  task_completed: { icon: CheckSquare, color: "text-green-600 bg-green-50" },
  application_created: { icon: FileText, color: "text-purple-600 bg-purple-50" },
  application_updated: { icon: FileText, color: "text-purple-600 bg-purple-50" },
  document_uploaded: { icon: FileText, color: "text-slate-600 bg-slate-50" },
  meeting_scheduled: { icon: Calendar, color: "text-indigo-600 bg-indigo-50" },
  time_logged: { icon: Clock, color: "text-teal-600 bg-teal-50" },
  client_login: { icon: LogIn, color: "text-emerald-600 bg-emerald-50" },
  note_added: { icon: StickyNote, color: "text-amber-600 bg-amber-50" },
  status_changed: { icon: TrendingUp, color: "text-blue-600 bg-blue-50" },
  onboarding_step: { icon: CheckSquare, color: "text-green-600 bg-green-50" }
};

export default function ActivitySection({ clientId }) {
  const { data: activities = [], isLoading } = useQuery({
    queryKey: ["activities", clientId],
    queryFn: () => base44.entities.Activity.filter({ client_id: clientId }, "-created_date"),
    enabled: !!clientId
  });

  if (isLoading) {
    return <div className="text-center py-8 text-slate-400">Loading activities...</div>;
  }

  if (activities.length === 0) {
    return (
      <Card className="p-8 text-center border-slate-100">
        <p className="text-slate-400 text-sm">No activities yet</p>
      </Card>
    );
  }

  return (
    <Card className="border-slate-100">
      <div className="p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-6">Activity Timeline</h3>
        <div className="space-y-4">
          {activities.map((activity, index) => {
            const config = activityIcons[activity.activity_type] || activityIcons.note_added;
            const Icon = config.icon;
            const isLast = index === activities.length - 1;

            return (
              <div key={activity.id} className="relative">
                {!isLast && (
                  <div className="absolute left-5 top-12 bottom-0 w-px bg-slate-100" />
                )}
                <div className="flex gap-4">
                  <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", config.color)}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="font-medium text-slate-900 text-sm">{activity.title}</p>
                        {activity.description && (
                          <p className="text-sm text-slate-500 mt-1">{activity.description}</p>
                        )}
                      </div>
                      <span className="text-xs text-slate-400 shrink-0">
                        {format(new Date(activity.created_date), "MMM d, h:mm a")}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      by {activity.created_by}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}