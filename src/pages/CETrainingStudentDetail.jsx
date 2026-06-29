import React, { useState } from "react";
import {
  Link,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  GraduationCap,
  Loader2,
  Mail,
  RefreshCw,
  ShieldCheck,
  UserRound,
  UserX,
} from "lucide-react";
import { toast } from "sonner";

const PAYMENT_STATUS_META = {
  paid: {
    label: "Registration paid",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  waived: {
    label: "Registration waived",
    className: "border-violet-200 bg-violet-50 text-violet-700",
  },
  pending: {
    label: "Payment pending",
    className: "border-amber-200 bg-amber-50 text-amber-800",
  },
  ready_for_checkout: {
    label: "Payment link ready",
    className: "border-blue-200 bg-blue-50 text-blue-700",
  },
  payment_processing: {
    label: "Payment processing",
    className: "border-blue-200 bg-blue-50 text-blue-700",
  },
  failed: {
    label: "Payment needs attention",
    className: "border-rose-200 bg-rose-50 text-rose-700",
  },
};

const PRIMARY_STATUS_META = {
  invited: {
    label: "Invited",
    className: "border-slate-200 bg-slate-50 text-slate-700",
  },
  payment_pending: {
    label: "Payment pending",
    className: "border-amber-200 bg-amber-50 text-amber-800",
  },
  payment_settled_registration_pending: {
    label: "Payment settled — awaiting account registration",
    className: "border-blue-200 bg-blue-50 text-blue-700",
  },
  active: {
    label: "In training",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  training_completed: {
    label: "Training complete",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  withdrawn: {
    label: "Withdrawn",
    className: "border-slate-200 bg-slate-100 text-slate-600",
  },
  revoked: {
    label: "Revoked",
    className: "border-rose-200 bg-rose-50 text-rose-700",
  },
};

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString();
}

function formatMoney(amountCents, currency) {
  const amount = Number(amountCents);

  if (!Number.isFinite(amount)) {
    return "—";
  }

  return `${String(currency || "USD").toUpperCase()} ${(
    amount / 100
  ).toFixed(2)}`;
}

function formatLabel(value) {
  return String(value || "")
    .trim()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getPaymentPlanLabel(paymentResponsibility, instructorPaymentMode) {
  if (paymentResponsibility !== "instructor_paid") {
    return "Student pays registration fee";
  }

  if (instructorPaymentMode === "invoice_with_cohort") {
    return "Business pays by cohort invoice";
  }

  return "Business pays now";
}

function getPaymentStatusMeta(status) {
  const normalizedStatus = String(status || "").trim();

  return (
    PAYMENT_STATUS_META[normalizedStatus] || {
      label: normalizedStatus
        ? formatLabel(normalizedStatus)
        : "Not recorded",
      className: "border-slate-200 bg-slate-50 text-slate-700",
    }
  );
}

function getPrimaryStatusMeta(detail) {
  const enrollmentStatus = String(
    detail.enrollment?.enrollment_status || ""
  ).trim();

  const trainingStatus = String(
    detail.cohort_membership?.training_status || ""
  ).trim();

  if (
    enrollmentStatus === "training_completed" ||
    trainingStatus === "completed"
  ) {
    return PRIMARY_STATUS_META.training_completed;
  }

  return (
    PRIMARY_STATUS_META[enrollmentStatus] || {
      label: enrollmentStatus
        ? formatLabel(enrollmentStatus)
        : "Status unavailable",
      className: "border-slate-200 bg-slate-50 text-slate-700",
    }
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-5 border-b border-slate-100 py-3 last:border-b-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </dt>

      <dd className="max-w-[65%] text-right text-sm text-slate-800">
        {value || "—"}
      </dd>
    </div>
  );
}

function ProgressItem({ label, value, detail }) {
  return (
    <div className="min-w-0 px-4 py-3 first:pl-0 last:pr-0">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>

      <div className="mt-1 text-sm font-semibold text-slate-900">
        {value}
      </div>

      {detail ? (
        <div className="mt-1 text-xs text-slate-500">
          {detail}
        </div>
      ) : null}
    </div>
  );
}

function CollapsibleSection({
  icon: Icon,
  title,
  summary,
  defaultOpen = false,
  children,
}) {
  return (
    <details
      open={defaultOpen}
      className="rounded-xl border border-slate-200 bg-white shadow-sm"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="h-4 w-4 shrink-0 text-violet-600" />
          <span className="text-sm font-semibold text-slate-900">
            {title}
          </span>
        </div>

        {summary ? (
          <span className="max-w-[55%] truncate text-right text-xs text-slate-500">
            {summary}
          </span>
        ) : null}
      </summary>

      <div className="border-t border-slate-100 px-5 py-2">
        {children}
      </div>
    </details>
  );
}

export default function CETrainingStudentDetail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeAction, setActiveAction] = useState("");

  const cohortId = String(
    searchParams.get("cohort_id") || ""
  ).trim();

  const enrollmentId = String(
    searchParams.get("enrollment_id") || ""
  ).trim();

  const cohortMemberId = String(
    searchParams.get("cohort_member_id") || ""
  ).trim();

  const pendingRoleAssignmentId = String(
    searchParams.get("pending_role_assignment_id") || ""
  ).trim();

  const identifierCount = [
    enrollmentId,
    cohortMemberId,
    pendingRoleAssignmentId,
  ].filter(Boolean).length;

  const canLoad = Boolean(cohortId) && identifierCount === 1;

  const {
    data: detail,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: [
      "ce-training-student-detail",
      cohortId,
      enrollmentId,
      cohortMemberId,
      pendingRoleAssignmentId,
    ],
    queryFn: async () => {
      const res = await base44.functions.invoke(
        "getCETrainingStudentDetail",
        {
          cohort_id: cohortId,
          ...(enrollmentId
            ? { enrollment_id: enrollmentId }
            : {}),
          ...(cohortMemberId
            ? { cohort_member_id: cohortMemberId }
            : {}),
          ...(pendingRoleAssignmentId
            ? {
                pending_role_assignment_id:
                  pendingRoleAssignmentId,
              }
            : {}),
        }
      );

      if (!res.data?.ok) {
        throw new Error(
          res.data?.error ||
            "Unable to load CE Training student details."
        );
      }

      return res.data;
    },
    enabled: canLoad,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });

  const backUrl = cohortId
    ? `/CohortDetail?cohort_id=${encodeURIComponent(cohortId)}`
    : "/Cohorts";

  if (!canLoad) {
    return (
      <div className="space-y-5">
        <Link
          to={backUrl}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to CE Cohort
        </Link>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-700" />

            <div>
              <h1 className="text-base font-semibold text-amber-950">
                Student record unavailable
              </h1>

              <p className="mt-1 text-sm text-amber-800">
                This page needs one student record identifier and a cohort
                identifier before it can load a CE Training student.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="space-y-5">
        <Link
          to={backUrl}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to CE Cohort
        </Link>

        <div className="rounded-xl border border-rose-200 bg-rose-50 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-rose-700" />

              <div>
                <h1 className="text-base font-semibold text-rose-950">
                  Unable to load student details
                </h1>

                <p className="mt-1 text-sm text-rose-700">
                  {error?.message ||
                    "The CE Training student record could not be loaded."}
                </p>
              </div>
            </div>

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => refetch()}
              disabled={isFetching}
              className="shrink-0 gap-2"
            >
              {isFetching ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const primaryStatus = getPrimaryStatusMeta(detail);
  const paymentMeta = getPaymentStatusMeta(
    detail.payment?.status
  );

  const isLegacy = detail.enrollment?.is_legacy === true;
  const receipt = detail.payment?.receipt || {};
  const receiptUrl = String(receipt.receipt_url || "").trim();

    const permissions = detail.permissions || {};

  const membershipId = String(
    detail.cohort_membership?.id || ""
  ).trim();

  const studentUserId = String(
    detail.student?.user_id || ""
  ).trim();

  const studentDetailIdentifier = enrollmentId
    ? { enrollment_id: enrollmentId }
    : cohortMemberId
      ? { cohort_member_id: cohortMemberId }
      : pendingRoleAssignmentId
        ? {
            pending_role_assignment_id:
              pendingRoleAssignmentId,
          }
        : {};

  const canResendRegistrationInstructions =
    permissions.can_resend_registration_instructions === true;

  const canResendInvitation =
    permissions.can_resend_invitation === true;

  const trainingCompleted =
    detail.cohort_membership?.training_status === "completed";

  const accountSummary = detail.student?.user_id
    ? detail.student?.user_is_active
      ? "Account active"
      : "Account inactive"
    : "Awaiting account registration";

  const registrationSummary =
    detail.payment?.status === "waived"
      ? "Registration waived"
      : detail.payment?.status === "paid"
        ? "Registration paid"
        : paymentMeta.label;

  const trainingSummary = trainingCompleted
    ? "Training complete"
    : detail.cohort_membership?.is_active
      ? "In training"
      : "Not started";

  const registrationDate =
    detail.enrollment?.payment_settled_at ||
    detail.payment?.paid_at ||
    detail.payment?.waived_at ||
    null;

  const paymentIntegrityWarning =
    !["valid", "valid_legacy_match"].includes(
      detail.payment?.integrity_status
    );

  const hasStudentActions =
    permissions.can_record_test_registration_waiver ||
    permissions.can_mark_training_complete ||
    permissions.can_remove_cohort_membership;

  const handleRecordTestWaiver = async () => {
    const waiverReason = window.prompt(
      `Record a test registration waiver for ${
        detail.student?.display_name || "this student"
      }?`,
      "Internal end-to-end CE training test account."
    );

    if (waiverReason === null) {
      return;
    }

    if (!waiverReason.trim()) {
      toast.error("A waiver reason is required.");
      return;
    }

    if (
      !window.confirm(
        `Confirm test registration waiver for ${
          detail.student?.display_name || "this student"
        }. No payment will be recorded.`
      )
    ) {
      return;
    }

    setActiveAction("record_test_waiver");

    try {
      const res = await base44.functions.invoke(
        "recordCEStudentTestRegistrationWaiver",
        {
          action: "record_test_waiver",
          cohort_id: cohortId,
          user_id: studentUserId,
          waiver_reason: waiverReason.trim(),
        }
      );

      if (!res.data?.ok) {
        throw new Error(
          res.data?.error ||
            "Unable to record the CE student test registration waiver."
        );
      }

      toast.success(
        res.data?.message ||
          "Test registration waiver recorded."
      );

      await refetch();
    } catch (actionError) {
      toast.error(
        actionError?.message ||
          "Unable to record the CE student test registration waiver."
      );
    } finally {
      setActiveAction("");
    }
  };

  const handleMarkTrainingComplete = async () => {
    if (
      !window.confirm(
        `Mark ${
          detail.student?.display_name || "this student"
        } as having completed CE training requirements? This makes the student eligible for Pending Certification review.`
      )
    ) {
      return;
    }

    setActiveAction("mark_training_complete");

    try {
      const res = await base44.functions.invoke(
        "markCEStudentTrainingComplete",
        {
          action: "mark_completed",
          cohort_id: cohortId,
          membership_id: membershipId,
        }
      );

      if (!res.data?.ok) {
        throw new Error(
          res.data?.error ||
            "Unable to record CE student training completion."
        );
      }

      toast.success(
        res.data?.message ||
          "Student training completion recorded."
      );

      await refetch();
    } catch (actionError) {
      toast.error(
        actionError?.message ||
          "Unable to record CE student training completion."
      );
    } finally {
      setActiveAction("");
    }
  };

   const handleRemoveCohortMembership = async () => {
    if (
      !window.confirm(
        `Remove ${
          detail.student?.display_name || "this student"
        } from this CE training cohort? Their enrollment and payment history will remain available for audit.`
      )
    ) {
      return;
    }

    setActiveAction("remove_cohort_membership");

    try {
      const res = await base44.functions.invoke(
        "manageCohortMembership",
        {
          action: "remove",
          cohort_id: cohortId,
          membership_id: membershipId,
          cohort_role: "member",
        }
      );

      if (!res.data?.ok) {
        throw new Error(
          res.data?.error ||
            "Unable to remove the student from this cohort."
        );
      }

      toast.success(
        res.data?.message ||
          "Student removed from this cohort."
      );

      navigate(backUrl);
    } catch (actionError) {
      toast.error(
        actionError?.message ||
          "Unable to remove the student from this cohort."
      );
    } finally {
      setActiveAction("");
    }
  };

  const handleResendStudentInstructions = async (
    instructionType
  ) => {
    const actionKey =
      instructionType === "registration"
        ? "resend_registration_instructions"
        : "resend_invitation";

    setActiveAction(actionKey);

    try {
      const res = await base44.functions.invoke(
        "resendCETrainingStudentInstructions",
        {
          cohort_id: cohortId,
          ...studentDetailIdentifier,
        }
      );

      if (!res.data?.ok) {
        throw new Error(
          res.data?.error ||
            "Unable to resend CE Training instructions."
        );
      }

      toast.success(
        res.data?.message ||
          (instructionType === "registration"
            ? "Registration instructions were resent."
            : "CE Training invitation was resent.")
      );

      await refetch();
    } catch (actionError) {
      toast.error(
        actionError?.message ||
          "Unable to resend CE Training instructions."
      );
    } finally {
      setActiveAction("");
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Link
        to={backUrl}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to {detail.cohort?.name || "CE Cohort"}
      </Link>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-blue-600 text-white">
              <UserRound className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold text-slate-900">
                {detail.student?.display_name || "CE Training Student"}
              </h1>

              <p className="mt-1 break-all text-sm text-slate-500">
                {detail.student?.email}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                {detail.cohort?.name || "Training cohort"}
                {detail.cohort?.code
                  ? ` · ${detail.cohort.code}`
                  : ""}
              </p>
            </div>
          </div>

          <Badge
            variant="outline"
            className={primaryStatus.className}
          >
            {primaryStatus.label}
          </Badge>
        </div>

        <div className="grid divide-y divide-slate-100 border-t border-slate-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <ProgressItem
            label="Registration"
            value={registrationSummary}
            detail={
              registrationDate
                ? formatDate(registrationDate)
                : null
            }
          />

          <ProgressItem
            label="Account"
            value={accountSummary}
            detail={
              detail.enrollment?.registered_at
                ? `Registered ${formatDate(
                    detail.enrollment.registered_at
                  )}`
                : null
            }
          />

          <ProgressItem
            label="Training"
            value={trainingSummary}
            detail={
              detail.enrollment?.training_completed_at
                ? formatDate(
                    detail.enrollment.training_completed_at
                  )
                : null
            }
          />
        </div>
      </section>

      {hasStudentActions ? (
        <CollapsibleSection
          icon={UserRound}
          title="Actions"
          summary="Authorized actions only"
        >
          <div className="flex flex-wrap gap-2 py-3">
            {permissions.can_record_test_registration_waiver ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={
                  activeAction === "record_test_waiver" ||
                  !studentUserId
                }
                onClick={handleRecordTestWaiver}
                className="gap-2 border-violet-200 text-violet-700 hover:bg-violet-50"
              >
                {activeAction === "record_test_waiver" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ShieldCheck className="h-3.5 w-3.5" />
                )}
                Record Test Waiver
              </Button>
            ) : null}

            {permissions.can_mark_training_complete ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={
                  activeAction === "mark_training_complete" ||
                  !membershipId
                }
                onClick={handleMarkTrainingComplete}
                className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
              >
                {activeAction === "mark_training_complete" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                Mark Training Complete
              </Button>
            ) : null}

            {permissions.can_remove_cohort_membership ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={
                  activeAction === "remove_cohort_membership" ||
                  !membershipId
                }
                onClick={handleRemoveCohortMembership}
                className="gap-2 border-rose-200 text-rose-700 hover:bg-rose-50"
              >
                {activeAction === "remove_cohort_membership" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <UserX className="h-3.5 w-3.5" />
                )}
                Remove From Cohort
              </Button>
            ) : null}
          </div>
        </CollapsibleSection>
      ) : null}

      <CollapsibleSection
        icon={CreditCard}
        title="Registration & Payment"
        summary={paymentMeta.label}
        defaultOpen={paymentIntegrityWarning}
      >
        {paymentIntegrityWarning ? (
          <div className="my-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />

              <p>
                {detail.payment?.integrity_status ===
                "multiple_legacy_matches"
                  ? "More than one historical registration billing record matches this student and cohort."
                  : "A complete matching registration billing record was not found for this student."}
              </p>
            </div>
          </div>
        ) : null}

        <dl>
          <DetailRow
            label="Registration status"
            value={paymentMeta.label}
          />

          <DetailRow
            label="Payment plan"
            value={getPaymentPlanLabel(
              detail.invitation?.payment_responsibility,
              detail.invitation?.instructor_payment_mode
            )}
          />

          <DetailRow
            label="Registration fee"
            value={formatMoney(
              detail.payment?.amount_cents,
              detail.payment?.currency
            )}
          />

          <DetailRow
            label="Payment settled"
            value={formatDate(
              detail.enrollment?.payment_settled_at
            )}
          />
        </dl>

        <div className="py-4">
          {receiptUrl ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                window.open(
                  receiptUrl,
                  "_blank",
                  "noopener,noreferrer"
                )
              }
              className="gap-2 border-violet-200 text-violet-700 hover:bg-violet-50"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              View Payment Receipt
            </Button>
          ) : receipt.status === "not_applicable_waived" ? (
            <p className="text-sm text-violet-700">
              Registration was waived. No Stripe receipt applies.
            </p>
          ) : receipt.status === "payment_not_settled" ? (
            <p className="text-sm text-slate-500">
              A receipt becomes available after payment settles.
            </p>
          ) : receipt.status === "checkout_session_not_recorded" ? (
            <p className="text-sm text-slate-500">
              No Stripe receipt link is recorded for this historical payment.
            </p>
          ) : (
            <p className="text-sm text-slate-500">
              Receipt unavailable. Refresh this page to retry the secure
              Stripe receipt lookup.
            </p>
          )}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        icon={GraduationCap}
        title="Record History"
        summary={
          isLegacy
            ? "Existing cohort record"
            : "Enrollment and invitation history"
        }
      >
        {isLegacy ? (
          <p className="py-3 text-sm text-slate-600">
            This student record was carried forward from an earlier invitation
            or cohort membership workflow.
          </p>
        ) : null}

        <dl>
          <DetailRow
            label="Cohort membership"
            value={
              detail.cohort_membership?.is_active
                ? "Active cohort member"
                : "Not currently active"
            }
          />

          <DetailRow
            label="Registered"
            value={formatDate(detail.enrollment?.registered_at)}
          />

          <DetailRow
            label="Training completed"
            value={formatDate(
              detail.enrollment?.training_completed_at
            )}
          />

          {detail.invitation?.status ? (
            <>
              <DetailRow
                label="Invitation status"
                value={formatLabel(detail.invitation.status)}
              />

              <DetailRow
                label="Invited by"
                value={detail.invitation?.invited_by_name}
              />

              <DetailRow
                label="Invitation sent"
                value={formatDate(detail.invitation?.invited_at)}
              />
            </>
          ) : null}
        </dl>
      </CollapsibleSection>
    </div>
  );
}
