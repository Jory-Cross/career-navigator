import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  GraduationCap,
  Loader2,
  Plus,
  UserCog,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import MemberRow from "@/components/cohorts/MemberRow";
import AddMemberDialog from "@/components/cohorts/AddMemberDialog";
import InviteStudentDialog from "@/components/cohorts/InviteStudentDialog";

const STATUS_STYLES = {
  planned: "border-slate-200 bg-slate-100 text-slate-700",
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  completed: "border-blue-200 bg-blue-50 text-blue-700",
  archived: "border-slate-200 bg-slate-50 text-slate-500",
};

const TYPE_LABELS = {
  testing: "Testing",
  training: "Training",
  production: "Production",
};

const STUDENT_STATUS_BADGES = {
  invited: {
    label: "Invited",
    className: "border-slate-200 bg-slate-50 text-slate-700",
  },
  payment_pending: {
    label: "Payment pending",
    className: "border-amber-200 bg-amber-50 text-amber-800",
  },
  payment_settled_registration_pending: {
    label: "Payment settled — registration pending",
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
    className: "border-slate-200 bg-slate-50 text-slate-600",
  },
  revoked: {
    label: "Revoked",
    className: "border-rose-200 bg-rose-50 text-rose-700",
  },
};

function formatStatusLabel(value) {
  return String(value || "")
    .trim()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getStudentStatusBadge(student) {
  const enrollmentStatus = String(
    student?.enrollment_status || ""
  )
    .trim()
    .toLowerCase();

  if (STUDENT_STATUS_BADGES[enrollmentStatus]) {
    return STUDENT_STATUS_BADGES[enrollmentStatus];
  }

  const paymentStatus = String(student?.payment_status || "")
    .trim()
    .toLowerCase();

  if (paymentStatus === "paid") {
    return {
      label: "Payment paid",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }

  if (paymentStatus === "waived") {
    return {
      label: "Registration waived",
      className: "border-violet-200 bg-violet-50 text-violet-700",
    };
  }

  if (paymentStatus === "ready_for_checkout") {
    return {
      label: "Payment link ready",
      className: "border-blue-200 bg-blue-50 text-blue-700",
    };
  }

  if (paymentStatus === "payment_processing") {
    return {
      label: "Payment processing",
      className: "border-blue-200 bg-blue-50 text-blue-700",
    };
  }

  if (paymentStatus === "failed") {
    return {
      label: "Payment needs attention",
      className: "border-rose-200 bg-rose-50 text-rose-700",
    };
  }

  return {
    label: formatStatusLabel(enrollmentStatus) || "Status unavailable",
    className: "border-slate-200 bg-slate-50 text-slate-600",
  };
}

function getCETrainingStudentDetailPath(cohortId, student) {
  const normalizedCohortId = String(cohortId || "").trim();

  if (!normalizedCohortId) {
    return "";
  }

  const params = new URLSearchParams({
    cohort_id: normalizedCohortId,
  });

  if (student?.enrollment_id) {
    params.set("enrollment_id", student.enrollment_id);
  } else if (student?.cohort_member_id) {
    params.set("cohort_member_id", student.cohort_member_id);
  } else if (student?.pending_role_assignment_id) {
    params.set(
      "pending_role_assignment_id",
      student.pending_role_assignment_id
    );
  } else {
    return "";
  }

  return `/CETrainingStudentDetail?${params.toString()}`;
}

function getInitials(nameOrEmail) {
  const normalizedValue = String(nameOrEmail || "").trim();

  if (!normalizedValue) {
    return "CE";
  }

  const words = normalizedValue
    .replace(/@.*/, "")
    .split(/\s+/)
    .filter(Boolean);

  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }

  return normalizedValue.slice(0, 2).toUpperCase();
}

function formatCurrency(currency, amountCents) {
  const normalizedCurrency = String(currency || "USD")
    .trim()
    .toUpperCase();

  return `${normalizedCurrency} ${(Number(amountCents || 0) / 100).toFixed(
    2
  )}`;
}

function getInvoiceStatusClass(status) {
  if (status === "paid") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "payment_processing") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  if (status === "failed") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  return "border-amber-200 bg-amber-50 text-amber-800";
}

function DetailField({ label, value, multiline = false }) {
  return (
    <div className={multiline ? "sm:col-span-2" : ""}>
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div
        className={
          multiline
            ? "mt-1 whitespace-pre-wrap text-sm text-slate-800"
            : "mt-1 text-sm text-slate-800"
        }
      >
        {value || <span className="text-slate-400">—</span>}
      </div>
    </div>
  );
}

/**
 * Cohort Detail
 *
 * The cohort page is intentionally limited to roster navigation and
 * cohort-level administration. CE Student Detail remains the canonical
 * workspace for student registration, payments, receipts, training
 * completion, certification actions, and later CE work.
 */
export default function CohortDetail() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const cohort_id = searchParams.get("cohort_id");

  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
    const [showAddManagerDialog, setShowAddManagerDialog] = useState(false);
  const [showAddTrainerDialog, setShowAddTrainerDialog] = useState(false);
  const [showInviteStudentDialog, setShowInviteStudentDialog] =
    useState(false);
  const [addingManager, setAddingManager] = useState(false);
  const [addingTrainer, setAddingTrainer] = useState(false);
  const [showInvoicePreview, setShowInvoicePreview] = useState(false);
  const [showInvoiceHistory, setShowInvoiceHistory] = useState(false);
  const [invoicePreviewRequestKey, setInvoicePreviewRequestKey] =
    useState(0);
  const [
    selectedInvoiceBillingEventIds,
    setSelectedInvoiceBillingEventIds,
  ] = useState([]);
  const [
    creatingCohortInvoiceCheckout,
    setCreatingCohortInvoiceCheckout,
  ] = useState(false);
  const [resumingCohortInvoiceId, setResumingCohortInvoiceId] =
    useState("");

  useEffect(() => {
    let active = true;

    base44.auth
      .me()
      .then((currentUser) => {
        if (!active) {
          return;
        }

        setUser(currentUser);
        setAuthChecked(true);

        const allowedRoles = ["admin", "management", "ce_instructor"];

        if (
          currentUser &&
          !allowedRoles.includes(currentUser.role)
        ) {
          navigate("/Dashboard");
        }
      })
      .catch(() => {
        if (active) {
          setAuthChecked(true);
        }
      });

    return () => {
      active = false;
    };
  }, [navigate]);

  const {
    data: cohort,
    isLoading: loadingCohort,
  } = useQuery({
    queryKey: ["cohorts", "detail", cohort_id],
    queryFn: async () => {
      if (!cohort_id) {
        return null;
      }

      const res = await base44.functions.invoke(
        "getAuthorizedCohorts",
        {}
      );

      const payload = res?.data || res;

      if (!payload?.ok) {
        throw new Error(
          payload?.error || "Unable to load this authorized cohort."
        );
      }

      const authorizedCohorts = Array.isArray(payload.cohorts)
        ? payload.cohorts
        : [];

      return (
        authorizedCohorts.find(
          (candidate) =>
            String(candidate?.id || "").trim() === cohort_id
        ) || null
      );
    },
    enabled: !!cohort_id && !!user,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const {
    data: cohortRoster = {
      memberships: [],
      users: [],
      pending_enrollments: [],
      student_roster: [],
    },
    isLoading: loadingRoster,
    error: rosterError,
  } = useQuery({
    queryKey: ["cohorts", "memberships", cohort_id],
    queryFn: async () => {
      if (!cohort_id) {
        return {
          memberships: [],
          users: [],
          pending_enrollments: [],
          student_roster: [],
        };
      }

      const res = await base44.functions.invoke(
        "getCohortMemberships",
        { cohort_id }
      );

      if (!res.data?.ok) {
        throw new Error(
          res.data?.error || "Unable to load cohort roster."
        );
      }

      return {
        memberships: Array.isArray(res.data.memberships)
          ? res.data.memberships
          : [],
        users: Array.isArray(res.data.users) ? res.data.users : [],
        pending_enrollments: Array.isArray(
          res.data.pending_enrollments
        )
          ? res.data.pending_enrollments
          : [],
        student_roster: Array.isArray(res.data.student_roster)
          ? res.data.student_roster
          : [],
      };
    },
    enabled: !!cohort_id && !!user,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const memberships = cohortRoster.memberships || [];
  const studentRoster = cohortRoster.student_roster || [];
  const rosterUsers = cohortRoster.users || [];

  const userById = useMemo(() => {
    const map = {};

    for (const rosterUser of rosterUsers) {
      map[rosterUser.id] = rosterUser;
    }

    return map;
  }, [rosterUsers]);

  const managers = useMemo(
    () =>
      memberships.filter(
        (membership) => membership.cohort_role === "manager"
      ),
    [memberships]
  );

  const trainers = useMemo(
    () =>
      memberships.filter(
        (membership) => membership.cohort_role === "trainer"
      ),
    [memberships]
  );

  const members = useMemo(
    () =>
      memberships.filter(
        (membership) => membership.cohort_role === "member"
      ),
    [memberships]
  );

  const existingManagerUserIds = useMemo(
    () => managers.map((membership) => membership.user_id),
    [managers]
  );

  const existingTrainerUserIds = useMemo(
    () => trainers.map((membership) => membership.user_id),
    [trainers]
  );

  const existingMemberUserIds = useMemo(
    () => members.map((membership) => membership.user_id),
    [members]
  );

  const canManageCohortRoster = useMemo(() => {
    if (!user) {
      return false;
    }

    if (user.role === "admin") {
      return true;
    }

    return managers.some(
      (membership) => membership.user_id === user.id
    );
  }, [managers, user]);

  const canInviteCEStudents = useMemo(() => {
    if (!user || cohort?.cohort_type !== "training") {
      return false;
    }

    if (user.role === "admin") {
      return true;
    }

    return managers.some(
      (membership) =>
        membership.user_id === user.id &&
        membership.is_active !== false
    );
  }, [cohort?.cohort_type, managers, user]);

  const canPreviewCohortInvoice = useMemo(() => {
    if (!user || cohort?.cohort_type !== "training") {
      return false;
    }

    if (["admin", "management"].includes(user.role)) {
      return true;
    }

    return managers.some(
      (membership) =>
        membership.user_id === user.id &&
        membership.is_active !== false
    );
  }, [cohort?.cohort_type, managers, user]);

  const {
    data: invoicePreview = null,
    isFetching: loadingInvoicePreview,
    error: invoicePreviewError,
  } = useQuery({
    queryKey: [
      "ce-training-cohort-invoice-preview",
      cohort_id,
      invoicePreviewRequestKey,
    ],
    queryFn: async () => {
      const res = await base44.functions.invoke(
        "getCETrainingCohortInvoicePreview",
        { cohort_id }
      );

      if (!res.data?.ok) {
        throw new Error(
          res.data?.error ||
            "Unable to preview CE Training registration invoice."
        );
      }

      return res.data;
    },
    enabled:
      !!cohort_id &&
      !!user?.id &&
      cohort?.cohort_type === "training" &&
      showInvoicePreview,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  const {
    data: cohortInvoiceHistory = null,
    isFetching: loadingCohortInvoiceHistory,
    error: cohortInvoiceHistoryError,
    refetch: refetchCohortInvoiceHistory,
  } = useQuery({
    queryKey: ["ce-training-cohort-invoice-history", cohort_id],
    queryFn: async () => {
      const res = await base44.functions.invoke(
        "getCETrainingCohortInvoiceHistory",
        { cohort_id }
      );

      if (!res.data?.ok) {
        throw new Error(
          res.data?.error ||
            "Unable to load CE Training cohort invoice history."
        );
      }

      return res.data;
    },
    enabled:
      !!cohort_id &&
      !!user?.id &&
      canPreviewCohortInvoice &&
      showInvoiceHistory,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    const eligibleBillingEventIds = new Set(
      (invoicePreview?.eligible_students || [])
        .map((student) => student?.billing_event_id)
        .filter(Boolean)
    );

    setSelectedInvoiceBillingEventIds((currentIds) =>
      currentIds.filter((billingEventId) =>
        eligibleBillingEventIds.has(billingEventId)
      )
    );
  }, [invoicePreview]);

  const selectedInvoiceStudents = useMemo(() => {
    const selectedIds = new Set(selectedInvoiceBillingEventIds);

    return (invoicePreview?.eligible_students || []).filter(
      (student) => selectedIds.has(student?.billing_event_id)
    );
  }, [invoicePreview, selectedInvoiceBillingEventIds]);

  const selectedInvoiceCurrencies = useMemo(
    () =>
      Array.from(
        new Set(
          selectedInvoiceStudents
            .map((student) =>
              String(student?.currency || "").trim().toUpperCase()
            )
            .filter(Boolean)
        )
      ),
    [selectedInvoiceStudents]
  );

  const selectedInvoiceCurrency =
    selectedInvoiceCurrencies.length === 1
      ? selectedInvoiceCurrencies[0]
      : "";

  const selectedInvoiceHasMixedCurrencies =
    selectedInvoiceCurrencies.length > 1;

  const selectedInvoiceTotalCents = useMemo(
    () =>
      selectedInvoiceStudents.reduce(
        (total, student) => total + Number(student?.amount_cents || 0),
        0
      ),
    [selectedInvoiceStudents]
  );

  const handleInviteCEStudentSuccess = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["cohorts", "memberships", cohort_id],
      }),
      queryClient.invalidateQueries({
        queryKey: [
          "ce-training-cohort-invoice-preview",
          cohort_id,
        ],
      }),
      queryClient.invalidateQueries({
        queryKey: [
          "ce-training-cohort-invoice-history",
          cohort_id,
        ],
      }),
    ]);
  };

  const handleAddManager = async (selectedUser) => {
    setAddingManager(true);

    try {
      const res = await base44.functions.invoke(
        "manageCohortMembership",
        {
          action: "add",
          cohort_id,
          user_id: selectedUser.id,
          cohort_role: "manager",
        }
      );

      if (!res.data?.ok) {
        throw new Error(res.data?.error || "Unable to add manager.");
      }

      toast.success("Manager added.");

      await queryClient.refetchQueries({
        queryKey: ["cohorts", "memberships", cohort_id],
      });
    } catch (error) {
      toast.error(error?.message || "Failed to add manager.");
    } finally {
      setAddingManager(false);
    }
  };

  const handleAddTrainer = async (selectedUser) => {
    setAddingTrainer(true);

    try {
      const res = await base44.functions.invoke(
        "manageCohortMembership",
        {
          action: "add",
          cohort_id,
          user_id: selectedUser.id,
          cohort_role: "trainer",
        }
      );

      if (!res.data?.ok) {
        throw new Error(res.data?.error || "Unable to add trainer.");
      }

      toast.success("Trainer added.");

      await queryClient.refetchQueries({
        queryKey: ["cohorts", "memberships", cohort_id],
      });

      return res.data;
    } catch (error) {
      toast.error(error?.message || "Failed to add trainer.");
      throw error;
    } finally {
      setAddingTrainer(false);
    }
  };


  const handleRemoveManager = async (membership) => {
    if (managers.length <= 1) {
      toast.error("Cannot remove the last active manager.");
      return;
    }

    const memberName =
      userById[membership.user_id]?.full_name ||
      userById[membership.user_id]?.email ||
      membership.user_id;

    if (!window.confirm(`Remove ${memberName} as manager?`)) {
      return;
    }

    try {
      const res = await base44.functions.invoke(
        "manageCohortMembership",
        {
          action: "remove",
          cohort_id,
          membership_id: membership.id,
          cohort_role: "manager",
        }
      );

      if (!res.data?.ok) {
        throw new Error(
          res.data?.error || "Unable to remove manager."
        );
      }

      toast.success("Manager removed.");

      await queryClient.invalidateQueries({
        queryKey: ["cohorts", "memberships", cohort_id],
      });
    } catch (error) {
      toast.error(error?.message || "Failed to remove manager.");
    }
  };

  const handleRemoveTrainer = async (membership) => {
    const memberName =
      userById[membership.user_id]?.full_name ||
      userById[membership.user_id]?.email ||
      membership.user_id;

    if (!window.confirm(`Remove ${memberName} as trainer?`)) {
      return;
    }

    const rosterQueryKey = ["cohorts", "memberships", cohort_id];

    await queryClient.cancelQueries({ queryKey: rosterQueryKey });

    const previousRoster = queryClient.getQueryData(rosterQueryKey);

    queryClient.setQueryData(rosterQueryKey, (currentRoster) => {
      const currentMemberships = Array.isArray(
        currentRoster?.memberships
      )
        ? currentRoster.memberships
        : [];

      return {
        ...(currentRoster || {}),
        memberships: currentMemberships.filter(
          (row) => row.id !== membership.id
        ),
      };
    });

    try {
      const res = await base44.functions.invoke(
        "manageCohortMembership",
        {
          action: "remove",
          cohort_id,
          membership_id: membership.id,
          cohort_role: "trainer",
        }
      );

      if (!res.data?.ok) {
        throw new Error(
          res.data?.error || "Unable to remove trainer."
        );
      }

      toast.success("Trainer removed.");

      await queryClient.invalidateQueries({
        queryKey: rosterQueryKey,
        refetchType: "none",
      });
    } catch (error) {
      queryClient.setQueryData(rosterQueryKey, previousRoster);
      toast.error(error?.message || "Failed to remove trainer.");
    }
  };

  const handleToggleInvoiceStudent = (student) => {
    const billingEventId = String(
      student?.billing_event_id || ""
    ).trim();

    if (!billingEventId) {
      toast.error(
        "This student is missing the billing event required for cohort invoice checkout."
      );
      return;
    }

    const studentCurrency = String(student?.currency || "")
      .trim()
      .toUpperCase();

    const isSelected =
      selectedInvoiceBillingEventIds.includes(billingEventId);

    if (
      !isSelected &&
      selectedInvoiceCurrency &&
      studentCurrency &&
      selectedInvoiceCurrency !== studentCurrency
    ) {
      toast.error(
        `A cohort invoice may contain only one currency. This selection is currently locked to ${selectedInvoiceCurrency}.`
      );
      return;
    }

    setSelectedInvoiceBillingEventIds((currentIds) =>
      isSelected
        ? currentIds.filter(
            (currentId) => currentId !== billingEventId
          )
        : [...currentIds, billingEventId]
    );
  };

  const handleCreateCohortInvoiceCheckout = async () => {
    const billingEventIds = selectedInvoiceBillingEventIds.filter(Boolean);

    if (!billingEventIds.length) {
      toast.error(
        "Select at least one eligible CE student registration before creating an invoice."
      );
      return;
    }

    if (
      selectedInvoiceHasMixedCurrencies ||
      !selectedInvoiceCurrency
    ) {
      toast.error(
        "A cohort invoice may contain only one currency. Select students with the same currency."
      );
      return;
    }

    if (
      !Number.isInteger(selectedInvoiceTotalCents) ||
      selectedInvoiceTotalCents <= 0
    ) {
      toast.error(
        "The selected registrations do not produce a valid positive invoice total."
      );
      return;
    }

    const studentLabel =
      selectedInvoiceStudents.length === 1
        ? "1 student"
        : `${selectedInvoiceStudents.length} students`;

    const totalLabel = formatCurrency(
      selectedInvoiceCurrency,
      selectedInvoiceTotalCents
    );

    if (
      !window.confirm(
        `Create a secure Stripe cohort invoice checkout for ${studentLabel} totaling ${totalLabel}? No CE account access or cohort enrollment will be granted until Stripe confirms the full invoice payment.`
      )
    ) {
      return;
    }

    setCreatingCohortInvoiceCheckout(true);

    try {
      const res = await base44.functions.invoke(
        "createCETrainingCohortInvoiceCheckout",
        {
          cohort_id,
          billing_event_ids: billingEventIds,
        }
      );

      if (!res.data?.ok) {
        throw new Error(
          res.data?.error ||
            "Unable to create the CE Training cohort invoice checkout."
        );
      }

      if (res.data?.paid) {
        toast.success(
          res.data?.message ||
            "This CE Training cohort invoice is already paid."
        );

        setSelectedInvoiceBillingEventIds([]);

        await queryClient.invalidateQueries({
          queryKey: [
            "ce-training-cohort-invoice-preview",
            cohort_id,
          ],
        });

        await queryClient.invalidateQueries({
          queryKey: ["cohorts", "memberships", cohort_id],
        });

        return;
      }

      const checkoutUrl = String(res.data?.checkout_url || "").trim();

      if (
        !/^https:\/\/checkout\.stripe\.com(?:\/|$)/i.test(
          checkoutUrl
        )
      ) {
        throw new Error(
          "The server did not return a valid Stripe Checkout URL."
        );
      }

      toast.success(
        res.data?.message || "Secure cohort invoice checkout created."
      );

      window.location.assign(checkoutUrl);
    } catch (error) {
      toast.error(
        error?.message ||
          "Unable to create the CE Training cohort invoice checkout."
      );
    } finally {
      setCreatingCohortInvoiceCheckout(false);
    }
  };

  const handleResumeCohortInvoicePayment = async (invoice) => {
    const cohortInvoiceId = String(invoice?.id || "").trim();

    if (!cohortInvoiceId) {
      toast.error(
        "This saved cohort invoice is missing the ID required to resume payment."
      );
      return;
    }

    const studentLabel =
      Number(invoice?.student_count || 0) === 1
        ? "1 student"
        : `${Number(invoice?.student_count || 0)} students`;

    const totalLabel = formatCurrency(
      invoice?.currency,
      invoice?.amount_cents
    );

    if (
      !window.confirm(
        `Resume secure Stripe payment for this cohort invoice covering ${studentLabel} totaling ${totalLabel}? No CE account access or cohort enrollment will be granted until Stripe confirms the full invoice payment.`
      )
    ) {
      return;
    }

    setResumingCohortInvoiceId(cohortInvoiceId);

    try {
      const res = await base44.functions.invoke(
        "createCETrainingCohortInvoiceCheckout",
        {
          cohort_id,
          cohort_invoice_id: cohortInvoiceId,
        }
      );

      if (!res.data?.ok) {
        throw new Error(
          res.data?.error ||
            "Unable to resume the CE Training cohort invoice payment."
        );
      }

      if (res.data?.paid) {
        toast.success(
          res.data?.message ||
            "This CE Training cohort invoice is already paid."
        );

        await queryClient.invalidateQueries({
          queryKey: [
            "ce-training-cohort-invoice-history",
            cohort_id,
          ],
        });

        await queryClient.invalidateQueries({
          queryKey: ["cohorts", "memberships", cohort_id],
        });

        return;
      }

      const checkoutUrl = String(res.data?.checkout_url || "").trim();

      if (!checkoutUrl) {
        toast.success(
          res.data?.message ||
            "Payment is already processing. Wait briefly, then refresh the invoice history."
        );

        await queryClient.invalidateQueries({
          queryKey: [
            "ce-training-cohort-invoice-history",
            cohort_id,
          ],
        });

        return;
      }

      if (
        !/^https:\/\/checkout\.stripe\.com(?:\/|$)/i.test(
          checkoutUrl
        )
      ) {
        throw new Error(
          "The server did not return a valid Stripe Checkout URL."
        );
      }

      toast.success(
        res.data?.message || "Secure cohort invoice checkout is ready."
      );

      window.location.assign(checkoutUrl);
    } catch (error) {
      toast.error(
        error?.message ||
          "Unable to resume the CE Training cohort invoice payment."
      );
    } finally {
      setResumingCohortInvoiceId("");
    }
  };

  if (!authChecked) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!cohort_id) {
    return (
      <div className="space-y-4">
        <BackLink />
        <p className="text-sm text-slate-500">No cohort selected.</p>
      </div>
    );
  }

  if (loadingCohort) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!cohort) {
    return (
      <div className="space-y-4">
        <BackLink />
        <p className="text-sm text-slate-500">Cohort not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
                 <AddMemberDialog
        open={showAddManagerDialog}
        onOpenChange={setShowAddManagerDialog}
        title="Add Manager"
        cohortRole="manager"
        cohortId={cohort_id}
        allowedRoles={["management", "ce_instructor"]}
        existingMemberUserIds={existingManagerUserIds}
        onSubmit={handleAddManager}
      />

            <AddMemberDialog
        open={showAddTrainerDialog}
        onOpenChange={setShowAddTrainerDialog}
        title="Add Trainer"
        cohortRole="trainer"
        cohortId={cohort_id}
        allowedRoles={["ce_instructor"]}
        existingMemberUserIds={existingTrainerUserIds}
        onSubmit={handleAddTrainer}
      />

          

      <InviteStudentDialog
        open={showInviteStudentDialog}
        onOpenChange={setShowInviteStudentDialog}
        onSuccess={handleInviteCEStudentSuccess}
        cohortId={cohort_id}
      />

      <BackLink />

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-violet-600 text-white">
              <GraduationCap className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-xl font-bold text-slate-900">
                  {cohort.name}
                </h1>
                <Badge
                  variant="outline"
                  className={
                    STATUS_STYLES[cohort.status] ||
                    STATUS_STYLES.planned
                  }
                >
                  {formatStatusLabel(cohort.status)}
                </Badge>
              </div>

              <p className="mt-1 text-sm text-slate-600">
                {[cohort.course_name, cohort.course_version]
                  .filter(Boolean)
                  .join(" · ") || "Course details unavailable"}
              </p>

              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                {cohort.code ? <span>Code: {cohort.code}</span> : null}
                <span>
                  {TYPE_LABELS[cohort.cohort_type] ||
                    formatStatusLabel(cohort.cohort_type)}
                </span>
                {cohort.start_date || cohort.end_date ? (
                  <span>
                    {cohort.start_date || "Date not set"} —{" "}
                    {cohort.end_date || "Date not set"}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {canInviteCEStudents ? (
            <Button
              type="button"
              onClick={() => setShowInviteStudentDialog(true)}
              className="shrink-0 gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Invite Student
            </Button>
          ) : null}
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-blue-600" />
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Student Roster
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Select a student to open the CE Student Detail workspace.
              </p>
            </div>
          </div>

          <span className="ml-auto text-xs text-slate-400">
            {studentRoster.length} total
          </span>
        </div>

        <div className="p-2">
          {loadingRoster ? (
            <div className="flex items-center gap-2 px-3 py-5 text-sm text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading student roster...
            </div>
          ) : rosterError ? (
            <div className="m-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              {rosterError.message || "Unable to load the student roster."}
            </div>
          ) : studentRoster.length === 0 ? (
            <p className="px-3 py-5 text-sm text-slate-400">
              No CE student records are available for this cohort.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {studentRoster.map((student) => {
                const detailPath = getCETrainingStudentDetailPath(
                  cohort_id,
                  student
                );
                const statusBadge = getStudentStatusBadge(student);
                const displayName =
                  student.display_name ||
                  student.student_email ||
                  "Unnamed CE student";
                const email =
                  student.student_email &&
                  student.student_email !== displayName
                    ? student.student_email
                    : "";

                return (
                  <button
                    key={student.id}
                    type="button"
                    disabled={!detailPath}
                    onClick={() => {
                      if (detailPath) {
                        navigate(detailPath);
                      }
                    }}
                    className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
                      {getInitials(displayName)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-slate-900">
                        {displayName}
                      </div>
                      {email ? (
                        <div className="mt-0.5 truncate text-xs text-slate-500">
                          {email}
                        </div>
                      ) : null}
                    </div>

                    <Badge
                      variant="outline"
                      className={`shrink-0 ${statusBadge.className}`}
                    >
                      {statusBadge.label}
                    </Badge>

                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <details className="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
          <div className="flex items-center gap-2">
            <UserCog className="h-4 w-4 text-violet-600" />
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Cohort Administration
              </h2>
                             <p className="mt-0.5 text-xs text-slate-500">
                  Cohort details, staffing, and registration invoice tools.
                </p>
            </div>
          </div>

          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
        </summary>

        <div className="space-y-6 border-t border-slate-100 p-5">
          <section>
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-slate-900">
                Cohort Details
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Reference information for this cohort.
              </p>
            </div>

            <dl className="grid grid-cols-1 gap-x-6 gap-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
              <DetailField
                label="Cohort Type"
                value={
                  TYPE_LABELS[cohort.cohort_type] ||
                  formatStatusLabel(cohort.cohort_type)
                }
              />
              <DetailField
                label="Status"
                value={formatStatusLabel(cohort.status)}
              />
              <DetailField label="Course Name" value={cohort.course_name} />
              <DetailField
                label="Course Version"
                value={cohort.course_version}
              />
              <DetailField label="Start Date" value={cohort.start_date} />
              <DetailField label="End Date" value={cohort.end_date} />
              <DetailField
                label="Description"
                value={cohort.description}
                multiline
              />
              <DetailField
                label="Instructor Notes"
                value={cohort.instructor_notes}
                multiline
              />
            </dl>
          </section>

          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Managers and Trainers
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Cohort-level staff assignments remain server-authorized.
                </p>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
                  <UserCog className="h-4 w-4 text-blue-600" />
                  <h4 className="text-sm font-medium text-slate-900">
                    Managers
                  </h4>
                  <span className="ml-auto text-xs text-slate-400">
                    {managers.length} active
                  </span>

                  {user?.role === "admin" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={addingManager}
                      onClick={() => setShowAddManagerDialog(true)}
                      className="ml-2 gap-1"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Manager
                    </Button>
                  ) : null}
                </div>

                <div className="p-2">
                  {managers.length === 0 ? (
                    <p className="px-3 py-4 text-sm text-slate-400">
                      No active managers.
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {managers.map((membership) => (
                        <MemberRow
                          key={membership.id}
                          member={membership}
                          user={userById[membership.user_id]}
                          onRemove={handleRemoveManager}
                          canRemove={
                            user?.role === "admin" && managers.length > 1
                          }
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="overflow-hidden rounded-lg border border-slate-200">
                <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
                  <UserCog className="h-4 w-4 text-violet-600" />
                  <h4 className="text-sm font-medium text-slate-900">
                    Trainers
                  </h4>
                  <span className="ml-auto text-xs text-slate-400">
                    {trainers.length} active
                  </span>

                  {canManageCohortRoster ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={addingTrainer}
                      onClick={() => setShowAddTrainerDialog(true)}
                      className="ml-2 gap-1"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Trainer
                    </Button>
                  ) : null}
                </div>

                <div className="p-2">
                  {trainers.length === 0 ? (
                    <p className="px-3 py-4 text-sm text-slate-400">
                      No active trainers.
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {trainers.map((membership) => (
                        <MemberRow
                          key={membership.id}
                          member={membership}
                          user={userById[membership.user_id]}
                          onRemove={handleRemoveTrainer}
                          canRemove={canManageCohortRoster}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

                  {cohort.cohort_type === "training" ? (
            <section className="rounded-lg border border-slate-200 p-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  CE Student Enrollment
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  CE student access and cohort membership are created only
                  through the verified invitation, payment settlement,
                  registration, and durable enrollment workflow. Existing
                  student reassignment is unavailable during security
                  remediation.
                </p>
              </div>
            </section>
          ) : null}

          {canPreviewCohortInvoice ? (
            <section className="rounded-lg border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Registration Invoice Preview
                  </h3>
                  <p className="mt-1 max-w-3xl text-xs text-slate-500">
                    Review pending instructor-billed CE registration fees.
                    One secure checkout may contain only one currency. No CE
                    account access or enrollment is granted until Stripe
                    confirms the full invoice payment.
                  </p>
                </div>

                <div className="flex gap-2">
                  {showInvoicePreview ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={loadingInvoicePreview}
                      onClick={() => {
                        setShowInvoicePreview(false);
                        setSelectedInvoiceBillingEventIds([]);
                      }}
                    >
                      Close Preview
                    </Button>
                  ) : null}

                  <Button
                    type="button"
                    size="sm"
                    disabled={loadingInvoicePreview}
                    onClick={() => {
                      setSelectedInvoiceBillingEventIds([]);
                      setShowInvoicePreview(true);
                      setInvoicePreviewRequestKey(
                        (currentValue) => currentValue + 1
                      );
                    }}
                    className="gap-2"
                  >
                    {loadingInvoicePreview ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : null}
                    {showInvoicePreview
                      ? "Refresh Preview"
                      : "Preview Registration Invoice"}
                  </Button>
                </div>
              </div>

              {showInvoicePreview ? (
                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  {loadingInvoicePreview && !invoicePreview ? (
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Preparing registration invoice preview...
                    </div>
                  ) : null}

                  {invoicePreviewError ? (
                    <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                      {invoicePreviewError.message ||
                        "Unable to prepare the registration invoice preview."}
                    </div>
                  ) : null}

                  {invoicePreview ? (
                    <div className="space-y-5">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <InvoiceMetric
                          label="Invoice-Billed Invitations"
                          value={
                            invoicePreview.summary
                              ?.invoice_billed_invitation_count || 0
                          }
                        />
                        <InvoiceMetric
                          label="Eligible Students"
                          value={
                            invoicePreview.summary?.eligible_student_count ||
                            0
                          }
                          tone="success"
                        />
                        <InvoiceMetric
                          label="Blocked Students"
                          value={
                            invoicePreview.summary?.blocked_student_count || 0
                          }
                          tone="warning"
                        />
                      </div>

                      <div>
                        <h4 className="text-sm font-semibold text-slate-900">
                          Invoice Totals
                        </h4>

                        {(invoicePreview.summary?.totals_by_currency || [])
                          .length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {invoicePreview.summary.totals_by_currency.map(
                              (total) => (
                                <div
                                  key={total.currency}
                                  className="rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-900"
                                >
                                  <span className="font-medium">
                                    {total.student_count} student
                                    {total.student_count === 1 ? "" : "s"}:
                                  </span>{" "}
                                  {formatCurrency(
                                    total.currency,
                                    total.total_amount_cents
                                  )}
                                </div>
                              )
                            )}
                          </div>
                        ) : (
                          <p className="mt-2 text-sm text-slate-500">
                            No invoice-eligible registration fees are
                            currently available for this cohort.
                          </p>
                        )}
                      </div>

                      <div>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h4 className="text-sm font-semibold text-slate-900">
                              Eligible Students
                            </h4>
                            <p className="mt-1 text-xs text-slate-500">
                              Select students for one secure Stripe checkout.
                              A first selection restricts later choices to the
                              same currency.
                            </p>
                          </div>

                          {selectedInvoiceStudents.length > 0 ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={creatingCohortInvoiceCheckout}
                              onClick={() =>
                                setSelectedInvoiceBillingEventIds([])
                              }
                            >
                              Clear Selection
                            </Button>
                          ) : null}
                        </div>

                        {(invoicePreview.eligible_students || []).length >
                        0 ? (
                          <>
                            <div className="mt-3 overflow-x-auto rounded-md border border-slate-200 bg-white">
                              <table className="w-full text-sm">
                                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                                  <tr>
                                    <th className="w-12 px-3 py-2">
                                      <span className="sr-only">Select</span>
                                    </th>
                                    <th className="px-3 py-2">
                                      Student Email
                                    </th>
                                    <th className="px-3 py-2">
                                      Locked Fee
                                    </th>
                                    <th className="px-3 py-2">
                                      Billing Status
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {invoicePreview.eligible_students.map(
                                    (student) => {
                                      const billingEventId = String(
                                        student?.billing_event_id || ""
                                      ).trim();
                                      const studentCurrency = String(
                                        student?.currency || ""
                                      )
                                        .trim()
                                        .toUpperCase();
                                      const studentAmountCents = Number(
                                        student?.amount_cents || 0
                                      );
                                      const isSelected =
                                        selectedInvoiceBillingEventIds.includes(
                                          billingEventId
                                        );
                                      const isDifferentCurrency =
                                        !isSelected &&
                                        !!selectedInvoiceCurrency &&
                                        studentCurrency !==
                                          selectedInvoiceCurrency;
                                      const hasInvalidAmount =
                                        !Number.isInteger(
                                          studentAmountCents
                                        ) || studentAmountCents <= 0;
                                      const selectionDisabled =
                                        creatingCohortInvoiceCheckout ||
                                        !billingEventId ||
                                        hasInvalidAmount ||
                                        isDifferentCurrency;

                                      return (
                                        <tr
                                          key={
                                            student.pending_invite_id ||
                                            billingEventId
                                          }
                                          className={
                                            isSelected ? "bg-violet-50" : ""
                                          }
                                        >
                                          <td className="px-3 py-2">
                                            <input
                                              type="checkbox"
                                              aria-label={`Select ${
                                                student.email ||
                                                "this student"
                                              } for cohort invoice checkout`}
                                              checked={isSelected}
                                              disabled={selectionDisabled}
                                              title={
                                                isDifferentCurrency
                                                  ? `This checkout is currently limited to ${selectedInvoiceCurrency}.`
                                                  : hasInvalidAmount
                                                    ? "A zero-dollar or invalid registration fee cannot be included in Stripe Checkout."
                                                    : ""
                                              }
                                              onChange={() =>
                                                handleToggleInvoiceStudent(
                                                  student
                                                )
                                              }
                                              className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                                            />
                                          </td>
                                          <td className="px-3 py-2 text-slate-800">
                                            {student.email}
                                          </td>
                                          <td className="px-3 py-2 text-slate-800">
                                            {formatCurrency(
                                              student.currency,
                                              student.amount_cents
                                            )}
                                          </td>
                                          <td className="px-3 py-2 text-slate-600">
                                            {student.billing_event_status}
                                          </td>
                                        </tr>
                                      );
                                    }
                                  )}
                                </tbody>
                              </table>
                            </div>

                            <div className="mt-3 rounded-md border border-violet-200 bg-violet-50 p-3">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                  <div className="text-xs font-medium uppercase tracking-wide text-violet-700">
                                    Selected for one secure checkout
                                  </div>
                                  <div className="mt-1 text-sm font-semibold text-violet-950">
                                    {selectedInvoiceStudents.length} student
                                    {selectedInvoiceStudents.length === 1
                                      ? ""
                                      : "s"}
                                    {selectedInvoiceCurrency
                                      ? ` · ${formatCurrency(
                                          selectedInvoiceCurrency,
                                          selectedInvoiceTotalCents
                                        )}`
                                      : ""}
                                  </div>
                                  <p className="mt-1 text-xs text-violet-800">
                                    The invoice and individual billing records
                                    remain unpaid until Stripe confirms payment.
                                  </p>
                                </div>

                                <Button
                                  type="button"
                                  size="sm"
                                  disabled={
                                    creatingCohortInvoiceCheckout ||
                                    selectedInvoiceStudents.length === 0 ||
                                    selectedInvoiceHasMixedCurrencies ||
                                    !selectedInvoiceCurrency
                                  }
                                  onClick={handleCreateCohortInvoiceCheckout}
                                  className="gap-2"
                                >
                                  {creatingCohortInvoiceCheckout ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : null}
                                  Create & Pay Selected Invoice
                                </Button>
                              </div>
                            </div>
                          </>
                        ) : (
                          <p className="mt-3 text-sm text-slate-500">
                            No students are currently eligible for cohort
                            invoice billing.
                          </p>
                        )}
                      </div>

                      {(invoicePreview.blocked_students || []).length > 0 ? (
                        <div>
                          <h4 className="text-sm font-semibold text-slate-900">
                            Blocked Students
                          </h4>
                          <div className="mt-2 space-y-2">
                            {invoicePreview.blocked_students.map(
                              (student) => (
                                <div
                                  key={
                                    student.pending_invite_id ||
                                    `${student.email}-${student.reason_code}`
                                  }
                                  className="rounded-md border border-amber-200 bg-amber-50 p-3"
                                >
                                  <div className="text-sm font-medium text-amber-900">
                                    {student.email ||
                                      "Student email unavailable"}
                                  </div>
                                  <div className="mt-1 text-xs text-amber-800">
                                    {student.reason}
                                  </div>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>
          ) : null}

          {canPreviewCohortInvoice ? (
            <section className="rounded-lg border border-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Invoice History
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Read-only record of saved CE Training cohort invoices and
                    their student registration lines.
                  </p>
                </div>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={loadingCohortInvoiceHistory}
                  onClick={() => {
                    if (showInvoiceHistory) {
                      refetchCohortInvoiceHistory();
                      return;
                    }

                    setShowInvoiceHistory(true);
                  }}
                  className="gap-2"
                >
                  {loadingCohortInvoiceHistory ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  {showInvoiceHistory
                    ? "Refresh Invoice History"
                    : "Load Invoice History"}
                </Button>
              </div>

              {showInvoiceHistory ? (
                <div className="p-4">
                  {loadingCohortInvoiceHistory && !cohortInvoiceHistory ? (
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading cohort invoice history...
                    </div>
                  ) : null}

                  {cohortInvoiceHistoryError ? (
                    <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                      {cohortInvoiceHistoryError.message ||
                        "Unable to load CE Training cohort invoice history."}
                    </div>
                  ) : null}

                  {cohortInvoiceHistory ? (
                    <div className="space-y-4">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <InvoiceMetric
                          label="Saved Invoices"
                          value={
                            cohortInvoiceHistory.summary?.invoice_count || 0
                          }
                        />
                        <InvoiceMetric
                          label="Paid"
                          value={
                            cohortInvoiceHistory.summary
                              ?.paid_invoice_count || 0
                          }
                          tone="success"
                        />
                        <InvoiceMetric
                          label="Open / Review Needed"
                          value={
                            (cohortInvoiceHistory.summary
                              ?.open_invoice_count || 0) +
                            (cohortInvoiceHistory.summary
                              ?.review_required_count || 0)
                          }
                          tone="warning"
                        />
                      </div>

                      {(cohortInvoiceHistory.invoices || []).length === 0 ? (
                        <p className="text-sm text-slate-500">
                          No cohort invoices have been created for this
                          Training cohort yet.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {cohortInvoiceHistory.invoices.map((invoice) => (
                            <details
                              key={invoice.id}
                              className="rounded-lg border border-slate-200 bg-white"
                            >
                              <summary className="cursor-pointer list-none px-4 py-3 [&::-webkit-details-marker]:hidden">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <div>
                                    <div className="text-sm font-semibold text-slate-900">
                                      {invoice.student_count} student
                                      {invoice.student_count === 1
                                        ? ""
                                        : "s"}{" "}
                                      ·{" "}
                                      {formatCurrency(
                                        invoice.currency,
                                        invoice.amount_cents
                                      )}
                                    </div>
                                    <div className="mt-1 text-xs text-slate-500">
                                      {invoice.paid_at
                                        ? `Paid ${new Date(
                                            invoice.paid_at
                                          ).toLocaleString()}`
                                        : invoice.issued_at
                                          ? `Issued ${new Date(
                                              invoice.issued_at
                                            ).toLocaleString()}`
                                          : "Draft invoice"}
                                    </div>
                                  </div>

                                  <div className="flex flex-wrap items-center justify-end gap-2">
                                    <Badge
                                      variant="outline"
                                      className={getInvoiceStatusClass(
                                        invoice.invoice_status
                                      )}
                                    >
                                      {formatStatusLabel(
                                        invoice.invoice_status
                                      )}
                                    </Badge>

                                    {invoice.integrity_status ===
                                    "review_required" ? (
                                      <Badge
                                        variant="outline"
                                        className="border-rose-200 bg-rose-50 text-rose-700"
                                      >
                                        Review required
                                      </Badge>
                                    ) : null}

                                    {invoice.integrity_status === "valid" &&
                                    ["ready_for_checkout", "failed"].includes(
                                      invoice.invoice_status
                                    ) ? (
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        disabled={
                                          !!resumingCohortInvoiceId &&
                                          resumingCohortInvoiceId !==
                                            invoice.id
                                        }
                                        onClick={(event) => {
                                          event.preventDefault();
                                          event.stopPropagation();
                                          handleResumeCohortInvoicePayment(
                                            invoice
                                          );
                                        }}
                                        className="gap-2 border-violet-200 text-violet-700 hover:bg-violet-50"
                                      >
                                        {resumingCohortInvoiceId ===
                                        invoice.id ? (
                                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        ) : null}
                                        Resume Payment
                                      </Button>
                                    ) : null}

                                    <ChevronDown className="h-4 w-4 text-slate-400" />
                                  </div>
                                </div>
                              </summary>

                              <div className="border-t border-slate-100 px-4 py-3">
                                {invoice.integrity_issues?.length > 0 ? (
                                  <div className="mb-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                                    {invoice.integrity_issues.map((issue) => (
                                      <div key={issue}>{issue}</div>
                                    ))}
                                  </div>
                                ) : null}

                                <div className="overflow-x-auto rounded-md border border-slate-200">
                                  <table className="w-full text-sm">
                                    <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                                      <tr>
                                        <th className="px-3 py-2">
                                          Student Email
                                        </th>
                                        <th className="px-3 py-2">
                                          Locked Fee
                                        </th>
                                        <th className="px-3 py-2">
                                          Line Status
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {(invoice.lines || []).map((line) => (
                                        <tr key={line.id}>
                                          <td className="px-3 py-2 text-slate-800">
                                            {line.subject_verified_email ||
                                              "Student email unavailable"}
                                          </td>
                                          <td className="px-3 py-2 text-slate-800">
                                            {formatCurrency(
                                              line.currency,
                                              line.amount_cents
                                            )}
                                          </td>
                                          <td className="px-3 py-2 text-slate-600">
                                            <div>
                                              {formatStatusLabel(
                                                line.line_status
                                              )}
                                            </div>
                                            {line.paid_at ? (
                                              <div className="mt-1 text-xs text-slate-500">
                                                Paid{" "}
                                                {new Date(
                                                  line.paid_at
                                                ).toLocaleString()}
                                              </div>
                                            ) : null}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </details>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>
          ) : null}
        </div>
      </details>
    </div>
  );
}

function InvoiceMetric({ label, value, tone = "neutral" }) {
  const toneClassName =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50"
        : "border-slate-200 bg-slate-50";

  const valueClassName =
    tone === "success"
      ? "text-emerald-800"
      : tone === "warning"
        ? "text-amber-800"
        : "text-slate-900";

  return (
    <div className={`rounded-md border p-3 ${toneClassName}`}>
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className={`mt-1 text-xl font-bold ${valueClassName}`}>
        {value}
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/Cohorts"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 transition-colors hover:text-blue-800"
    >
      <ArrowLeft className="h-4 w-4" />
      Back to CE Cohorts
    </Link>
  );
}
