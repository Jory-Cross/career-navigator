import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Mail,
  Users,
  ArrowRight,
  XCircle,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import InviteStudentPaymentDialog from "@/components/cohorts/InviteStudentPaymentDialog";

export default function CEInstructorStudents() {
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [showInviteStudentDialog, setShowInviteStudentDialog] =
    useState(false);
  const [revokingInviteId, setRevokingInviteId] = useState("");

  const queryClient = useQueryClient();

  useEffect(() => {
    let active = true;

    base44.auth
      .me()
      .then((currentUser) => {
        if (!active) return;
        setUser(currentUser);
        setAuthChecked(true);
      })
      .catch(() => {
        if (!active) return;
        setAuthChecked(true);
      });

    return () => {
      active = false;
    };
  }, []);

  const {
    data: studentsData = {
      cohorts: [],
      active: [],
      pending: [],
    },
    isLoading: studentsLoading,
  } = useQuery({
    queryKey: ["ce-students-instructor-secure", user?.id],
    queryFn: async () => {
      const res = await base44.functions.invoke(
        "getCEInstructorStudents",
        {}
      );

      if (!res.data?.ok) {
        throw new Error(
          res.data?.error || "Unable to load CE students."
        );
      }

      return {
        cohorts: Array.isArray(res.data.cohorts)
          ? res.data.cohorts
          : [],
        active: Array.isArray(res.data.active)
          ? res.data.active
          : [],
        pending: Array.isArray(res.data.pending)
          ? res.data.pending
          : [],
      };
    },
    enabled: !!user?.id,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });

  const cohorts = studentsData.cohorts || [];

  const allStudents = [
    ...(studentsData.active || []),
    ...(studentsData.pending || []),
  ];

  const handleRevokeInvite = async (student) => {
    const email = student.email || "this student";

    if (
      !window.confirm(
        `Revoke the pending CE student invitation for ${email}? The student will not be able to use this invitation to register.`
      )
    ) {
      return;
    }

    setRevokingInviteId(student.id);

    try {
      const res = await base44.functions.invoke(
        "revokeCEStudentInvite",
        {
          pending_invite_id: student.id,
        }
      );

      if (!res.data?.ok) {
        throw new Error(
          res.data?.error || "Unable to revoke the CE student invitation."
        );
      }

      toast.success("CE student invitation revoked.");

      await queryClient.invalidateQueries({
        queryKey: ["ce-students-instructor-secure"],
      });
    } catch (error) {
      toast.error(
        error?.message || "Unable to revoke the CE student invitation."
      );
    } finally {
      setRevokingInviteId("");
    }
  };

  if (!authChecked || studentsLoading) {
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
          <h1 className="text-3xl font-bold text-slate-900">
            CE Students
          </h1>

          <p className="mt-2 text-slate-600">
            Invite CE students, track registration, and assign registered
            students to cohorts.
          </p>
        </div>

        <Button
          onClick={() => setShowInviteStudentDialog(true)}
          className="gap-2"
        >
          <Mail className="w-4 h-4" />
          Invite Student
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-violet-200 p-4">
          <div className="mb-1 text-sm text-slate-600">
            Total Students
          </div>

          <div className="text-3xl font-bold text-violet-600">
            {allStudents.length}
          </div>

          <div className="mt-2 text-xs text-slate-500">
            {studentsData.active?.length || 0} registered ·{" "}
            {studentsData.pending?.length || 0} pending
          </div>
        </Card>

        <Card className="border-blue-200 p-4">
          <div className="mb-1 text-sm text-slate-600">
            Your Cohorts
          </div>

          <div className="text-3xl font-bold text-blue-600">
            {cohorts.length}
          </div>

          <Link to="/Cohorts">
            <Button
              variant="outline"
              size="sm"
              className="mt-2 w-full"
            >
              View Cohorts
            </Button>
          </Link>
        </Card>

        <Card className="border-slate-200 p-4">
          <div className="mb-1 text-sm text-slate-600">
            Pending Invitations
          </div>

          <div className="text-3xl font-bold text-slate-900">
            {studentsData.pending?.length || 0}
          </div>

          <p className="mt-2 text-xs text-slate-500">
            Awaiting registration
          </p>
        </Card>
      </div>

      {allStudents.length === 0 ? (
        <Card className="border-slate-200 p-12 text-center">
          <Users className="mx-auto mb-3 h-12 w-12 text-slate-300" />

          <h3 className="mb-1 text-lg font-semibold text-slate-900">
            No Students Yet
          </h3>

          <p className="mb-4 text-slate-600">
            Invite a CE student here. Assign the student to a cohort after
            registration.
          </p>

          <Button
            onClick={() => setShowInviteStudentDialog(true)}
            className="gap-2"
          >
            <Mail className="w-4 h-4" />
            Invite Student
          </Button>
        </Card>
      ) : (
        <Card className="overflow-hidden border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 text-left font-semibold text-slate-900">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-900">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-900">
                    Cohort
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-900">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-900">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200">
                {allStudents.map((student) => (
                  <tr
                    key={student.id || student.email}
                    className="transition-colors hover:bg-slate-50"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">
                        {student.user?.full_name ||
                          student.email?.split("@")[0] ||
                          "—"}
                      </div>

                      {!student.user && student.email && (
                        <div className="text-xs text-slate-500">
                          Not yet registered
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3 text-slate-600">
                      {student.email || student.user?.email || "—"}
                    </td>

                    <td className="px-4 py-3">
                      {student.cohorts?.length > 0 ? (
                        <div className="space-y-1">
                          {student.cohorts.map((cohort) => (
                            <div key={cohort.id}>
                              <div className="font-medium text-slate-900">
                                {cohort.name}
                              </div>

                              {cohort.code && (
                                <div className="text-xs text-slate-500">
                                  {cohort.code}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-500">
                          {student.status === "pending"
                            ? "Assign after registration"
                            : "Unassigned"}
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {student.status === "active" ? (
                        <Badge className="border-green-300 bg-green-100 text-green-800">
                          ✓ Registered
                        </Badge>
                      ) : (
                        <Badge className="border-amber-300 bg-amber-100 text-amber-800">
                          ⏳ Pending
                        </Badge>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {student.status === "pending" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={revokingInviteId === student.id}
                          onClick={() => handleRevokeInvite(student)}
                          className="gap-1 border-rose-200 text-rose-700 hover:bg-rose-50"
                        >
                          {revokingInviteId === student.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <XCircle className="h-3 w-3" />
                          )}
                          Revoke Invite
                        </Button>
                      ) : student.cohorts?.length > 0 ? (
                        <Link
                          to={`/CohortDetail?cohort_id=${student.cohorts[0].id}`}
                        >
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                          >
                            View Cohort
                            <ArrowRight className="h-3 w-3" />
                          </Button>
                        </Link>
                      ) : (
                        <Link to="/Cohorts">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                          >
                            Assign to Cohort
                            <ArrowRight className="h-3 w-3" />
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

      <Card className="border-violet-200 bg-violet-50 p-6">
        <h3 className="mb-2 font-semibold text-violet-900">
          📚 Managing Students
        </h3>

        <ol className="space-y-1.5 text-sm text-violet-800">
          <li>
            <span className="font-medium">1. Invite Student</span> — Send the
            invitation from this Students page
          </li>
          <li>
            <span className="font-medium">2. Registration</span> — The student
            registers for CE Training Portal access
          </li>
          <li>
            <span className="font-medium">3. Open Cohort Detail</span> —
            Select the cohort after registration is complete
          </li>
          <li>
            <span className="font-medium">
              4. Assign Registered Student
            </span>{" "}
            — Add the student from Cohort Detail
          </li>
        </ol>
      </Card>

     <InviteStudentPaymentDialog
  open={showInviteStudentDialog}
  onOpenChange={setShowInviteStudentDialog}
  onSuccess={() => {
    queryClient.invalidateQueries({
      queryKey: ["ce-students-instructor-secure"],
    });
  }}
/>
    </div>
  );
}
