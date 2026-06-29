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
  RefreshCw,
  ShieldCheck,
  UserRound,
  UserX,
} from "lucide-react";
import { toast } from "sonner";

const ENROLLMENT_STATUS_META = {
  invited: {
    label: "Invited",
    className: "border-slate-200 bg-slate-50 text-slate-700",
  },
  payment_pending: {
    label: "Payment Pending",
    className: "border-amber-200 bg-amber-50 text-amber-800",
  },
  payment_settled_registration_pending: {
    label: "Paid · Registration Pending",
    className: "border-blue-200 bg-blue-50 text-blue-700",
  },
  active: {
    label: "Active",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  training_completed: {
    label: "Training Complete",
    className: "border-violet-200 bg-violet-50 text-violet-700",
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

const PAYMENT_STATUS_META = {
  paid: {
    label: "Paid",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  waived: {
    label: "Waived",
    className: "border-violet-200 bg-violet-50 text-violet-700",
  },
  pending: {
    label: "Pending",
    className: "border-amber-200 bg-amber-50 text-amber-800",
  },
  ready_for_checkout: {
    label: "Ready for Payment",
    className: "border-blue-200 bg-blue-50 text-blue-700",
  },
  payment_processing: {
    label: "Payment Processing",
    className: "border-blue-200 bg-blue-50 text-blue-700",
  },
  failed: {
    label: "Payment Needs Attention",
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

function getEnrollmentStatusMeta(status) {
  return (
    ENROLLMENT_STATUS_META[status] || {
      label: formatLabel(status) || "Status Unavailable",
      className: "border-slate-200 bg-slate-50 text-slate-700",
    }
  );
}

function getPaymentStatusMeta(status) {
  return (
    PAYMENT_STATUS_META[status] || {
      label: formatLabel(status) || "Not Recorded",
      className: "border-slate-200 bg-slate-50 text-slate-700",
    }
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-3 last:border-b-0">
      <dt className="shrink-0 text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </dt>

      <dd className="text-right text-sm text-slate-800">
        {value || "—"}
      </dd>
    </div>
  );
}

function SectionCard({ icon: Icon, title, children }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3">
        <Icon className="h-4 w-4 text-violet-600" />
        <h2 className="text-sm font-semibold text-slate-900">
          {title}
        </h2>
      </div>

      <div className="px-5 py-2">{children}</div>
    </section>
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

  const enrollmentMeta = getEnrollmentStatusMeta(
    detail.enrollment?.enrollment_status
  );

  const paymentMeta = getPaymentStatusMeta(
    detail.payment?.status
  );

  const isLegacy = detail.enrollment?.is_legacy === true;
  const receipt = detail.payment?.receipt || {};
  const receiptUrl = String(receipt.receipt_url || "").trim();

  const accountLabel = detail.student?.user_id
    ? detail.student?.user_is_active
      ? "Registered account active"
      : "Registered account inactive"
    : "No account registered";

  const trainingLabel =
    detail.cohort_membership?.training_status === "completed"
      ? "Training complete"
      : detail.cohort_membership?.training_status
        ? formatLabel(detail.cohort_membership.training_status)
        : "Not started";

  const paymentIntegrityWarning =
    !["valid", "valid_legacy_match"].includes(
      detail.payment?.integrity_status
    );

  return (
    <div className="space-y-6">
      <Link
        to={backUrl}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to {detail.cohort?.name || "CE Cohort"}
      </Link>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
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

          <div className="flex flex-wrap gap-2">
            <Badge
              variant="outline"
              className={enrollmentMeta.className}
            >
              {enrollmentMeta.label}
            </Badge>

            {isLegacy ? (
              <Badge
                variant="outline"
                className="border-slate-200 bg-slate-50 text-slate-600"
              >
                Legacy record
              </Badge>
            ) : null}
          </div>
        </div>

        {isLegacy ? (
          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
            This student is shown from an existing invitation or cohort
            membership. New CE invitations use a durable enrollment record.
          </div>
        ) : null}
      </section>

      {paymentIntegrityWarning ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-700" />

            <div>
              <h2 className="text-sm font-semibold text-amber-950">
                Payment record needs review
              </h2>

              <p className="mt-1 text-sm text-amber-800">
                {detail.payment?.integrity_status ===
                "multiple_legacy_matches"
                  ? "More than one historical registration billing record matches this student and cohort."
                  : "A complete matching registration billing record was not found for this student."}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard icon={GraduationCap} title="Enrollment & Training">
          <dl>
            <InfoRow
              label="Enrollment Status"
              value={enrollmentMeta.label}
            />
            <InfoRow label="Account" value={accountLabel} />
            <InfoRow
              label="Cohort Membership"
              value={
                detail.cohort_membership?.is_active
                  ? "Active cohort member"
                  : "Not yet active"
              }
            />
            <InfoRow label="Training Status" value={trainingLabel} />
            <InfoRow
              label="Invited"
              value={formatDate(detail.enrollment?.invited_at)}
            />
            <InfoRow
              label="Registered"
              value={formatDate(detail.enrollment?.registered_at)}
            />
            <InfoRow
              label="Training Completed"
              value={formatDate(
                detail.enrollment?.training_completed_at
              )}
            />
          </dl>
        </SectionCard>

        <SectionCard icon={CreditCard} title="Registration Payment">
          <dl>
            <InfoRow label="Payment Status" value={paymentMeta.label} />
            <InfoRow
              label="Payment Plan"
              value={getPaymentPlanLabel(
                detail.invitation?.payment_responsibility,
                detail.invitation?.instructor_payment_mode
              )}
            />
            <InfoRow
              label="Locked Registration Fee"
              value={formatMoney(
                detail.payment?.amount_cents,
                detail.payment?.currency
              )}
            />
            <InfoRow
              label="Payment Settled"
              value={formatDate(
                detail.enrollment?.payment_settled_at
              )}
            />
            <InfoRow
              label="Payment Record"
              value={
                detail.payment?.integrity_status ===
                "valid_legacy_match"
                  ? "Historical match confirmed"
                  : detail.payment?.integrity_status === "valid"
                    ? "Confirmed"
                    : "Needs review"
              }
            />
          </dl>

          <div className="border-t border-slate-100 py-4">
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
        </SectionCard>

        <SectionCard icon={UserRound} title="Invitation">
          <dl>
            <InfoRow
              label="Invitation Status"
              value={
                detail.invitation?.status
                  ? formatLabel(detail.invitation.status)
                  : "No current invitation"
              }
            />
            <InfoRow
              label="Invited By"
              value={detail.invitation?.invited_by_name || "—"}
            />
            <InfoRow
              label="Invitation Sent"
              value={formatDate(detail.invitation?.invited_at)}
            />
          </dl>
        </SectionCard>

        <SectionCard icon={GraduationCap} title="CE Client Work">
          <div className="py-3">
            <p className="text-sm text-slate-700">
              No CE client work is linked to this student yet.
            </p>

            <p className="mt-2 text-sm text-slate-500">
              Future CE practitioner work, client relationships, Discovery
              progress, and service activity will appear here without changing
              this student’s enrollment or payment history.
            </p>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
