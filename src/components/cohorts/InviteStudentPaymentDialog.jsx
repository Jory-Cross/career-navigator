import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail, CreditCard, Building2 } from "lucide-react";

export default function InviteStudentPaymentDialog({
  open,
  onOpenChange,
  onSuccess,
}) {
  const [email, setEmail] = useState("");
  const [paymentResponsibility, setPaymentResponsibility] =
    useState("student_paid");
  const [instructorPaymentMode, setInstructorPaymentMode] =
    useState("pay_now");
  const [inviting, setInviting] = useState(false);

  const resetForm = () => {
    setEmail("");
    setPaymentResponsibility("student_paid");
    setInstructorPaymentMode("pay_now");
  };

  const handleOpenChange = (nextOpen) => {
    if (!nextOpen && !inviting) {
      resetForm();
    }

    onOpenChange(nextOpen);
  };

  const handleInvite = async () => {
    if (!email.trim()) {
      toast.error("Please enter a student email");
      return;
    }

    setInviting(true);

    try {
      const res = await base44.functions.invoke("inviteCEStudent", {
        email: email.trim(),
        payment_responsibility: paymentResponsibility,
        instructor_payment_mode:
          paymentResponsibility === "instructor_paid"
            ? instructorPaymentMode
            : undefined,
      });

      if (!res.data?.ok) {
        throw new Error(
          res.data?.error || "Failed to send CE student invitation"
        );
      }

      toast.success(
        res.data?.email_sent
          ? `Enrollment invitation sent to ${email.trim()}`
          : "CE student enrollment invitation created"
      );

      resetForm();
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error(
        error?.message || "Failed to invite CE student"
      );
    } finally {
      setInviting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Invite CE Student</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-1">
            <Label htmlFor="student-email">
              Student Email Address
            </Label>

            <Input
              id="student-email"
              type="email"
              placeholder="student@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={inviting}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  handleInvite();
                }
              }}
            />

            <p className="text-xs text-slate-500">
              The student will receive a CE Training enrollment invitation
              for this exact email address.
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <Label>Registration Fee Responsibility</Label>

              <p className="mt-1 text-xs text-slate-500">
                CE Training Portal access is not activated until the
                student&apos;s registration is paid or an authorized test
                waiver is recorded.
              </p>
            </div>

            <label
              className={`block cursor-pointer rounded-lg border p-3 transition-colors ${
                paymentResponsibility === "student_paid"
                  ? "border-violet-400 bg-violet-50"
                  : "border-slate-200 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  name="payment-responsibility"
                  value="student_paid"
                  checked={paymentResponsibility === "student_paid"}
                  onChange={() =>
                    setPaymentResponsibility("student_paid")
                  }
                  disabled={inviting}
                  className="mt-1"
                />

                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <CreditCard className="h-4 w-4 text-violet-600" />
                    Student Pays Registration Fee
                  </div>

                  <p className="mt-1 text-xs text-slate-600">
                    The student must complete the registration payment before
                    CE Training Portal access is activated.
                  </p>
                </div>
              </div>
            </label>

            <label
              className={`block cursor-pointer rounded-lg border p-3 transition-colors ${
                paymentResponsibility === "instructor_paid"
                  ? "border-violet-400 bg-violet-50"
                  : "border-slate-200 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  name="payment-responsibility"
                  value="instructor_paid"
                  checked={paymentResponsibility === "instructor_paid"}
                  onChange={() =>
                    setPaymentResponsibility("instructor_paid")
                  }
                  disabled={inviting}
                  className="mt-1"
                />

                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Building2 className="h-4 w-4 text-violet-600" />
                    Instructor / Business Pays Registration Fee
                  </div>

                  <p className="mt-1 text-xs text-slate-600">
                    CE Training Portal access is activated only after the
                    instructor-paid registration is settled.
                  </p>
                </div>
              </div>
            </label>

            {paymentResponsibility === "instructor_paid" && (
              <div className="ml-4 space-y-3 border-l-2 border-violet-200 pl-4">
                <p className="text-sm font-medium text-slate-800">
                  Instructor Payment Method
                </p>

                <label className="flex cursor-pointer items-start gap-2">
                  <input
                    type="radio"
                    name="instructor-payment-mode"
                    value="pay_now"
                    checked={instructorPaymentMode === "pay_now"}
                    onChange={() =>
                      setInstructorPaymentMode("pay_now")
                    }
                    disabled={inviting}
                    className="mt-1"
                  />

                  <span>
                    <span className="block text-sm font-medium text-slate-800">
                      Pay registration fee now
                    </span>

                    <span className="block text-xs text-slate-500">
                      Payment collection will be completed in the next
                      enrollment-payment step.
                    </span>
                  </span>
                </label>

                <label className="flex cursor-pointer items-start gap-2">
                  <input
                    type="radio"
                    name="instructor-payment-mode"
                    value="invoice_with_cohort"
                    checked={
                      instructorPaymentMode === "invoice_with_cohort"
                    }
                    onChange={() =>
                      setInstructorPaymentMode("invoice_with_cohort")
                    }
                    disabled={inviting}
                    className="mt-1"
                  />

                  <span>
                    <span className="block text-sm font-medium text-slate-800">
                      Include on future cohort invoice
                    </span>

                    <span className="block text-xs text-slate-500">
                      The student remains pending until the applicable cohort
                      invoice is paid.
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
            onClick={() => handleOpenChange(false)}
            disabled={inviting}
          >
            Cancel
          </Button>

          <Button
            onClick={handleInvite}
            disabled={inviting}
            className="gap-2"
          >
            {inviting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Mail className="h-4 w-4" />
            )}

            {inviting
              ? "Sending..."
              : "Send Enrollment Invitation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
