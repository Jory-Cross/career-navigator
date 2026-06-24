import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Loader2,
  Mail,
  UserCheck,
  Users,
  UserRoundPlus,
} from "lucide-react";
import InviteStudentDialog from "@/components/cohorts/InviteStudentDialog";

const OPEN_INVITE_STATUSES = [
  "pending",
  "invite_email_sent",
  "pending_email_failed",
];

function displayName(user) {
  return user?.full_name || user?.email || "Unknown student";
}

function formatInviteStatus(status) {
  if (status === "invite_email_sent") return "Email sent";
  if (status === "pending_email_failed") return "Email needs resend";
  return "Pending registration";
}

export default function CEInstructorStudents() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [showInviteDialog, setShowInviteDialog] = useState(false);

  useEffect(() => {
    let mounted = true;

    base44.auth
      .me()
      .then((currentUser) => {
        if (mounted) setUser(currentUser);
      })
      .catch(() => {
        if (mounted) setUser(null);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const {
    data: roster = {
      pending_invitations: [],
      unassigned_students: [],
      assigned_students: [],
    },
    isLoading,
    error,
  } = useQuery({
    queryKey: ["ceTrainingStudentRoster"],
    queryFn: async () => {
      const response = await base44.functions.invoke(
        "getCETrainingStudentRoster",
        {}
      );

      if (!response.data?.ok) {
        throw new Error(
          response.data?.error || "Unable to load CE students"
        );
      }

      return response.data;
    },
    enabled: !!user,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });

  const pendingInvitations = useMemo(
    () =>
      (roster.pending_invitations || []).filter((invite) =>
        OPEN_INVITE_STATUSES.includes(invite.status)
      ),
    [roster.pending_invitations]
  );

  const unassignedStudents = roster.unassigned_students || [];
  const assignedStudents = roster.assigned_students || [];
  const totalRegistered =
    unassignedStudents.length + assignedStudents.length;

  if (!user || isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <InviteStudentDialog
        open={showInviteDialog}
        onOpenChange={setShowInviteDialog}
        onSuccess={() => {
          queryClient.invalidateQueries({
            queryKey: ["ceTrainingStudentRoster"],
          });
        }}
      />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            CE Students
          </h1>
          <p className="mt-2 text-slate-600">
            Invite students to register, then assign registered students to
            cohorts.
          </p>
        </div>

        <Button
          onClick={() => setShowInviteDialog(true)}
          className="gap-2"
        >
          <UserRoundPlus className="h-4 w-4" />
          Invite Student
        </Button>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error.message || "Unable to load CE student information."}
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-violet-200 p-4">
          <div className="mb-1 text-sm text-slate-600">
            Registered Students
          </div>
          <div className="text-3xl font-bold text-violet-600">
            {totalRegistered}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            {assignedStudents.length} assigned to a cohort
          </div>
        </Card>

        <Card className="border-blue-200 p-4">
          <div className="mb-1 text-sm text-slate-600">
            Ready to Assign
          </div>
          <div className="text-3xl font-bold text-blue-600">
            {unassignedStudents.length}
          </div>

          <Link to="/Cohorts">
            <Button variant="outline" size="sm" className="mt-2 w-full">
              Open Cohorts
            </Button>
          </Link>
        </Card>

        <Card className="border-amber-200 p-4">
          <div className="mb-1 text-sm text-slate-600">
            Pending Registrations
          </div>
          <div className="text-3xl font-bold text-amber-600">
            {pendingInvitations.length}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Awaiting student registration
          </div>
        </Card>
      </div>

      <section className="overflow-hidden rounded-xl border border-amber-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-amber-100 px-5 py-3">
          <Mail className="h-4 w-4 text-amber-600" />
          <h2 className="text-sm font-semibold text-slate-900">
            Pending Registrations
          </h2>
          <span className="ml-auto text-xs text-slate-400">
            {pendingInvitations.length} pending
          </span>
        </div>

        {pendingInvitations.length === 0 ? (
          <p className="px-5 py-4 text-sm text-slate-400">
            No pending registration invitations.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {pendingInvitations.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center justify-between gap-4 px-5 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {invite.email}
                  </p>
                  <p className="text-xs text-slate-500">
                    Invited{" "}
                    {invite.invited_at
                      ? new Date(invite.invited_at).toLocaleDateString()
                      : "recently"}
                  </p>
                </div>

                <Badge
                  variant="outline"
                  className="border-amber-200 bg-amber-50 text-amber-800"
                >
                  {formatInviteStatus(invite.status)}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-xl border border-blue-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-blue-100 px-5 py-3">
          <UserCheck className="h-4 w-4 text-blue-600" />
          <h2 className="text-sm font-semibold text-slate-900">
            Registered — Not Assigned to a Cohort
          </h2>
          <span className="ml-auto text-xs text-slate-400">
            {unassignedStudents.length} ready
          </span>
        </div>

        {unassignedStudents.length === 0 ? (
          <p className="px-5 py-4 text-sm text-slate-400">
            No registered students are waiting for cohort assignment.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {unassignedStudents.map((student) => (
              <div
                key={student.id}
                className="flex items-center justify-between gap-4 px-5 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {displayName(student)}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {student.email}
                  </p>
                </div>

                <Link to="/Cohorts">
                  <Button variant="outline" size="sm" className="gap-1">
                    Assign in Cohort
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-xl border border-green-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-green-100 px-5 py-3">
          <Users className="h-4 w-4 text-green-600" />
          <h2 className="text-sm font-semibold text-slate-900">
            Assigned Students
          </h2>
          <span className="ml-auto text-xs text-slate-400">
            {assignedStudents.length} assigned
          </span>
        </div>

        {assignedStudents.length === 0 ? (
          <p className="px-5 py-4 text-sm text-slate-400">
            No students are assigned to your cohorts yet.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {assignedStudents.map((entry) => {
              const firstMembership = entry.memberships?.[0];

              const cohortNames = (entry.memberships || [])
                .map((membership) => membership.cohort?.name)
                .filter(Boolean)
                .join(", ");

              return (
                <div
                  key={entry.user.id}
                  className="flex items-center justify-between gap-4 px-5 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {displayName(entry.user)}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {entry.user.email}
                    </p>
                    <p className="mt-1 truncate text-xs text-green-700">
                      {cohortNames}
                    </p>
                  </div>

                  {firstMembership?.cohort?.id && (
                    <Link
                      to={`/CohortDetail?cohort_id=${firstMembership.cohort.id}`}
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1"
                      >
                        View Cohort
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
