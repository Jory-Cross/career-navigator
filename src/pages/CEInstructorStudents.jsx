import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Loader2,
  Mail,
  Users,
  ArrowRight,
  XCircle,
  Pencil,
  CreditCard,
  Building2,
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
  const [editingInvite, setEditingInvite] = useState(null);
  const [editingPaymentResponsibility, setEditingPaymentResponsibility] =
    useState("student_paid");
  const [editingInstructorPaymentMode, setEditingInstructorPaymentMode] =
    useState("pay_now");
  const [savingPaymentOption, setSavingPaymentOption] = useState(false);

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

  const getPendingPaymentLabel = (student) => {
    if (student.payment_responsibility !== "instructor_paid") {
      return "Student pays registration fee";
    }

    if (student.instructor_payment_mode === "invoice_with_cohort") {
      return "Business pays by cohort invoice";
    }

    return "Business pays now";
  };

  const handleOpenPaymentEditor = (student) => {
    setEditingInvite(student);
    setEditingPaymentResponsibility(
      student.payment_responsibility || "student_paid"
    );
    setEditingInstructorPaymentMode(
      student.instructor_payment_mode || "pay_now"
    );
  };

  const handleClosePaymentEditor = () => {
    if (savingPaymentOption) {
      return;
    }

    setEditingInvite(null);
  };

  const handleSavePaymentOption = async () => {
    if (!editingInvite?.id) {
      return;
    }

    setSavingPaymentOption(true);

    try {
      const res = await base44.functions.invoke(
        "updateCEStudentInvitePayment",
        {
          pending_invite_id: editingInvite.id,
          payment_responsibility: editingPaymentResponsibility,
          instructor_payment_mode:
            editingPaymentResponsibility === "instructor_paid"
              ? editingInstructorPaymentMode
              : undefined,
        }
      );

      if (!res.data?.ok) {
        throw new Error(
          res.data?.error ||
            "Unable to update the CE student payment option."
        );
      }

      toast.success("CE student payment option updated.");

      setEditingInvite(null);

      await queryClient.invalidateQueries({
        queryKey: ["ce-students-instructor-secure"],
      });
    } catch (error) {
      toast.error(
        error?.message ||
          "Unable to update the CE student payment option."
      );
    } finally {
      setSavingPaymentOption(false);
    }
  };

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
                        <div className="space-y-1">
                          <Badge className="border-amber-300 bg-amber-100 text-amber-800">
                            ⏳ Pending
                          </Badge>

                          <p className="text-xs text-slate-500">
                            {getPendingPaymentLabel(student)}
                          </p>
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {student.status === "pending" ? (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={revokingInviteId === student.id}
                            onClick={() =>
                              handleOpenPaymentEditor(student)
                            }
                            className="gap-1 border-violet-200 text-violet-700 hover:bg-violet-50"
                          >
                            <Pencil className="h-3 w-3" />
                            Edit Payment
                          </Button>

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
                        </div>
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

      <Dialog
        open={!!editingInvite}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            handleClosePaymentEditor();
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Registration Payment Option</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div>
              <p className="text-sm font-medium text-slate-900">
                {editingInvite?.email}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                This changes the selected payment responsibility for the
                pending CE student invite. It does not mark registration as
                paid or activate CE Training Portal access.
              </p>
            </div>

            <div className="space-y-3">
              <label
                className={`block cursor-pointer rounded-lg border p-3 transition-colors ${
                  editingPaymentResponsibility === "student_paid"
                    ? "border-violet-400 bg-violet-50"
                    : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="edit-payment-responsibility"
                    value="student_paid"
                    checked={
                      editingPaymentResponsibility === "student_paid"
                    }
                    onChange={() =>
                      setEditingPaymentResponsibility("student_paid")
                    }
                    disabled={savingPaymentOption}
                    className="mt-1"
                  />

                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <CreditCard className="h-4 w-4 text-violet-600" />
                      Student Pays Registration Fee
                    </div>

                    <p className="mt-1 text-xs text-slate-600">
                      The student must pay before CE Training Portal access is
                      activated.
                    </p>
                  </div>
                </div>
              </label>

              <label
                className={`block cursor-pointer rounded-lg border p-3 transition-colors ${
                  editingPaymentResponsibility === "instructor_paid"
                    ? "border-violet-400 bg-violet-50"
                    : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="edit-payment-responsibility"
                    value="instructor_paid"
                    checked={
                      editingPaymentResponsibility === "instructor_paid"
                    }
                    onChange={() =>
                      setEditingPaymentResponsibility("instructor_paid")
                    }
                    disabled={savingPaymentOption}
                    className="mt-1"
                  />

                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <Building2 className="h-4 w-4 text-violet-600" />
                      Instructor / Business Pays Registration Fee
                    </div>

                    <p className="mt-1 text-xs text-slate-600">
                      The business handles the registration fee before CE
                      Training Portal access is activated.
                    </p>
                  </div>
                </div>
              </label>

              {editingPaymentResponsibility === "instructor_paid" && (
                <div className="ml-4 space-y-3 border-l-2 border-violet-200 pl-4">
                  <p className="text-sm font-medium text-slate-800">
                    Instructor Payment Method
                  </p>

                  <label className="flex cursor-pointer items-start gap-2">
                    <input
                      type="radio"
                      name="edit-instructor-payment-mode"
                      value="pay_now"
                      checked={editingInstructorPaymentMode === "pay_now"}
                      onChange={() =>
                        setEditingInstructorPaymentMode("pay_now")
                      }
                      disabled={savingPaymentOption}
                      className="mt-1"
                    />

                    <span>
                      <span className="block text-sm font-medium text-slate-800">
                        Pay registration fee now
                      </span>

                      <span className="block text-xs text-slate-500">
                        Use when the instructor/business will complete
                        immediate payment.
                      </span>
                    </span>
                  </label>

                  <label className="flex cursor-pointer items-start gap-2">
                    <input
                      type="radio"
                      name="edit-instructor-payment-mode"
                      value="invoice_with_cohort"
                      checked={
                        editingInstructorPaymentMode ===
                        "invoice_with_cohort"
                      }
                      onChange={() =>
                        setEditingInstructorPaymentMode(
                          "invoice_with_cohort"
                        )
                      }
                      disabled={savingPaymentOption}
                      className="mt-1"
                    />

                    <span>
                      <span className="block text-sm font-medium text-slate-800">
                        Include on future cohort invoice
                      </span>

                      <span className="block text-xs text-slate-500">
                        Keep the student pending until the applicable invoice
                        is settled.
                      </span>
                    </span>
                  </label>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleClosePaymentEditor}
              disabled={savingPaymentOption}
            >
              Cancel
            </Button>

            <Button
              onClick={handleSavePaymentOption}
              disabled={savingPaymentOption}
              className="gap-2"
            >
              {savingPaymentOption && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Save Payment Option
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
