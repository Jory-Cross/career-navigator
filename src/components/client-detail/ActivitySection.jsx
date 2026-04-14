import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import {
  Mail,
  CheckSquare,
  FileText,
  Calendar,
  Clock,
  LogIn,
  StickyNote,
  TrendingUp,
  Plus,
} from "lucide-react";
import { format } from "date-fns";

import { cn } from "@/lib/utils";
import { queryKeys } from "@/lib/queryKeys";
import { getActivities } from "@/lib/api/clientPortalApi";

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
  onboarding_step: { icon: CheckSquare, color: "text-green-600 bg-green-50" },
};

function formatActivityDate(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return format(date, "MMM d, h:mm a");
}

export default function ActivitySection({
  clientId,
  activities: activitiesProp,
  isLoading: isLoadingProp = false,
}) {
  const shouldQuery = !Array.isArray(activitiesProp);

  const {
    data: queriedActivities = [],
    isLoading: queriedLoading,
  } = useQuery({
    queryKey: queryKeys.activities(clientId),
    queryFn: () => getActivities(clientId),
    enabled: shouldQuery && !!clientId,
    staleTime: 30 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const activities = Array.isArray(activitiesProp) ? activitiesProp : queriedActivities;
  const isLoading = shouldQuery ? queriedLoading : isLoadingProp;

  if (isLoading) {
    return (
      <div className="py-8 text-center text-sm text-slate-400">
        Loading activities...
      </div>
    );
  }

  if (!activities.length) {
    return (
      <Card className="border-slate-100 p-8 text-center">
        <p className="text-sm text-slate-400">No activities yet</p>
      </Card>
    );
  }

  return (
    <Card className="border-slate-100">
      <div className="p-6">
        <h3 className="mb-6 text-lg font-semibold text-slate-900">
          Activity Timeline
        </h3>

        <div className="space-y-4">
          {activities.map((activity, index) => {
            const config =
              activityIcons[activity.activity_type] || activityIcons.note_added;
            const Icon = config.icon;
            const isLast = index === activities.length - 1;
            const createdAt = formatActivityDate(activity.created_date);

            return (
              <div key={activity.id || `${activity.activity_type}-${index}`} className="relative">
                {!isLast && (
                  <div className="absolute bottom-0 left-5 top-12 w-px bg-slate-100" />
                )}

                <div className="flex gap-4">
                  <div
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                      config.color
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-900">
                          {activity.title || "Activity"}
                        </p>

                        {activity.description ? (
                          <p className="mt-1 text-sm text-slate-500">
                            {activity.description}
                          </p>
                        ) : null}
                      </div>

                      {createdAt ? (
                        <span className="shrink-0 text-xs text-slate-400">
                          {createdAt}
                        </span>
                      ) : null}
                    </div>

                    {activity.created_by ? (
                      <p className="mt-1 text-xs text-slate-400">
                        by {activity.created_by}
                      </p>
                    ) : null}
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
