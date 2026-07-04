import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  BookOpen,
  GraduationCap,
  Loader2,
  RefreshCw,
  Users,
} from "lucide-react";

function getDirectoryPayload(result) {
  const payload = result?.data || result;

  if (!payload?.ok) {
    throw new Error(
      payload?.error ||
        "Unable to load your authorized CE Training cohorts."
    );
  }

  return {
    cohorts: Array.isArray(payload.cohorts) ? payload.cohorts : [],
    memberships: Array.isArray(payload.memberships)
      ? payload.memberships
      : [],
  };
}

export default function CEInstructorDashboard() {
  const {
    data: directory = {
      cohorts: [],
      memberships: [],
    },
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["ce-instructor-authorized-cohorts"],
    queryFn: async () => {
      const result = await base44.functions.invoke(
        "getAuthorizedCohorts",
        {}
      );

      return getDirectoryPayload(result);
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const cohorts = directory.cohorts;
  const memberships = directory.memberships;

  const statsByCohort = useMemo(() => {
    const stats = {};

    for (const cohort of cohorts) {
      stats[cohort.id] = {
        activeStudents: 0,
        managers: 0,
        trainers: 0,
      };
    }

    for (const membership of memberships) {
      const cohortStats = stats[membership.cohort_id];

      if (!cohortStats) {
        continue;
      }

      const role = String(membership.cohort_role || "")
        .trim()
        .toLowerCase();

      if (role === "member") {
        cohortStats.activeStudents += 1;
      }

      if (role === "manager") {
        cohortStats.managers += 1;
      }

      if (role === "trainer") {
        cohortStats.trainers += 1;
      }
    }

    return stats;
  }, [cohorts, memberships]);

  const totalStudents = Object.values(statsByCohort).reduce(
    (total, stats) => total + stats.activeStudents,
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            Instructor Dashboard
          </h1>
          <p className="mt-2 text-slate-600">
            Review the CE Training cohorts where you are an active manager or
            trainer.
          </p>
        </div>

        <Button
          variant="outline"
          onClick={() => refetch()}
          disabled={isFetching}
          className="gap-2"
        >
          <RefreshCw
            className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4 bg-gradient-to-br from-violet-50 to-violet-100 border-violet-200">
          <div className="text-sm text-violet-900 font-medium mb-2">
            Your Authorized Cohorts
          </div>
          <div className="text-3xl font-bold text-violet-600 mb-3">
            {isLoading ? "—" : cohorts.length}
          </div>
          <Link to="/Cohorts">
            <Button size="sm" className="w-full gap-2">
              <Users className="w-4 h-4" />
              View Cohorts
            </Button>
          </Link>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <div className="text-sm text-blue-900 font-medium mb-2">
            Assigned Students
          </div>
          <div className="text-3xl font-bold text-blue-600 mb-3">
            {isLoading ? "—" : totalStudents}
          </div>
          <Link to="/CEInstructorStudents">
            <Button size="sm" variant="outline" className="w-full gap-2">
              <Users className="w-4 h-4" />
              View Students
            </Button>
          </Link>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <div className="text-sm text-amber-900 font-medium mb-2">
            Cohort Administration
          </div>
          <p className="text-sm text-amber-800 mb-3">
            Organization administrators create cohorts and assign the initial
            manager roster.
          </p>
          <Link to="/Cohorts">
            <Button size="sm" variant="outline" className="w-full gap-2">
              <BookOpen className="w-4 h-4" />
              Open Cohorts
            </Button>
          </Link>
        </Card>
      </div>

      {error ? (
        <Card className="p-8 border-red-200 bg-red-50">
          <h2 className="font-semibold text-red-900">
            Cohorts could not be loaded
          </h2>
          <p className="mt-2 text-sm text-red-800">
            {error.message ||
              "Refresh the page or contact your organization administrator."}
          </p>
        </Card>
      ) : isLoading ? (
        <Card className="p-12 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-violet-600" />
        </Card>
      ) : cohorts.length === 0 ? (
        <Card className="p-12 text-center border-slate-200">
          <GraduationCap className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-slate-900 mb-1">
            No Authorized Cohorts
          </h2>
          <p className="text-slate-600">
            You are not currently assigned as an active manager or trainer for
            a CE Training cohort.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">
              Your Cohorts
            </h2>
            <span className="text-sm text-slate-500">
              {cohorts.length} available
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {cohorts.map((cohort) => {
              const stats = statsByCohort[cohort.id] || {
                activeStudents: 0,
                managers: 0,
                trainers: 0,
              };

              return (
                <Card
                  key={cohort.id}
                  className="p-6 border-violet-200 hover:border-violet-300 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <h3 className="text-lg font-semibold text-slate-900">
                        {cohort.name || "Unnamed Cohort"}
                      </h3>
                      {cohort.code && (
                        <p className="text-sm text-slate-500">
                          {cohort.code}
                        </p>
                      )}
                    </div>

                    <Badge variant="outline">
                      {cohort.status || "planned"}
                    </Badge>
                  </div>

                  {cohort.description && (
                    <p className="text-sm text-slate-600 mb-3 line-clamp-2">
                      {cohort.description}
                    </p>
                  )}

                  <div className="grid grid-cols-3 gap-2 mb-4 py-3 border-y border-slate-200 text-center">
                    <div>
                      <div className="text-xl font-bold text-violet-600">
                        {stats.activeStudents}
                      </div>
                      <div className="text-xs text-slate-500">Students</div>
                    </div>

                    <div>
                      <div className="text-xl font-bold text-violet-600">
                        {stats.managers}
                      </div>
                      <div className="text-xs text-slate-500">Managers</div>
                    </div>

                    <div>
                      <div className="text-xl font-bold text-violet-600">
                        {stats.trainers}
                      </div>
                      <div className="text-xs text-slate-500">Trainers</div>
                    </div>
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
        </div>
      )}

      <Card className="p-6 bg-gradient-to-r from-violet-50 to-purple-50 border-violet-200">
        <h2 className="font-semibold text-slate-900 mb-3">
          Instructor Workflow
        </h2>
        <ol className="text-sm text-slate-700 space-y-2">
          <li>
            <span className="font-medium text-violet-900">
              1. Cohort assignment:
            </span>{" "}
            An organization administrator creates the cohort and assigns its
            manager or trainer roster.
          </li>
          <li>
            <span className="font-medium text-violet-900">
              2. Student enrollment:
            </span>{" "}
            Invite students through the verified CE enrollment and payment
            workflow.
          </li>
          <li>
            <span className="font-medium text-violet-900">
              3. Cohort work:
            </span>{" "}
            Open an assigned cohort to work with its authorized students.
          </li>
        </ol>
      </Card>
    </div>
  );
}
