import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  ArrowLeft,
  GraduationCap,
  Users,
  UserCog,
   Plus,
  CheckCircle2,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import MemberRow from "@/components/cohorts/MemberRow";
import AddMemberDialog from "@/components/cohorts/AddMemberDialog";

const STATUS_STYLES = {
  planned: "bg-slate-100 text-slate-700 border-slate-200",
  active: "bg-green-100 text-green-800 border-green-200",
  completed: "bg-blue-100 text-blue-800 border-blue-200",
  archived: "bg-slate-100 text-slate-500 border-slate-200",
};

const TYPE_LABELS = {
  testing: "Testing",
  training: "Training",
  production: "Production",
};

function InfoField({ label, value, multiline }) {
  return (
    <div className={multiline ? "sm:col-span-2 space-y-1" : "space-y-1"}>
      <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</dt>
      <dd className={multiline ? "text-sm text-slate-700 whitespace-pre-wrap" : "text-sm text-slate-800"}>
        {value || <span className="text-slate-400">—</span>}
      </dd>
    </div>
  );
}

/**
 * CohortDetail — Phase 6B (view-only).
 *
 * Permissions: admin + management. No editing per spec.
 */
export default function CohortDetail() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const cohort_id = searchParams.get("cohort_id");
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
    const [showAddManagerDialog, setShowAddManagerDialog] = useState(false);
  const [addingManager, setAddingManager] = useState(false);
  const [showAddTrainerDialog, setShowAddTrainerDialog] = useState(false);
  const [addingTrainer, setAddingTrainer] = useState(false);
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false);
    const [addingMember, setAddingMember] = useState(false);
  const [completingMembershipId, setCompletingMembershipId] = useState("");
  const [waivingMembershipId, setWaivingMembershipId] = useState("");
  const [showInvoicePreview, setShowInvoicePreview] = useState(false);
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
  const [
    resumingCohortInvoiceId,
    setResumingCohortInvoiceId,
  ] = useState("");
  useEffect(() => {
    let active = true;
    base44.auth.me().then((u) => {
      if (!active) return;
      setUser(u);
      setAuthChecked(true);
      // Allow admin, management, and CE instructors
      const allowedRoles = ["admin", "management", "ce_instructor"];
      if (u && !allowedRoles.includes(u.role)) {
        navigate("/Dashboard");
      }
    }).catch(() => setAuthChecked(true));
    return () => { active = false; };
  }, [navigate]);

  // Cohort record
  const { data: cohort, isLoading: loadingCohort } = useQuery({
    queryKey: ["cohorts", "detail", cohort_id],
    queryFn: async () => {
      if (!cohort_id) return null;
      return base44.entities.CETrainingCohort.get(cohort_id);
    },
    enabled: !!cohort_id && !!user,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

    // Secure roster query. The backend function can read every active
  // membership row in this cohort, including student rows.
   const {
    data: cohortRoster = {
      memberships: [],
      users: [],
      pending_enrollments: [],
    },
  } = useQuery({
    queryKey: ["cohorts", "memberships", cohort_id],
    queryFn: async () => {
      if (!cohort_id) {
        return {
          memberships: [],
          users: [],
          pending_enrollments: [],
        };
      }

      const res = await base44.functions.invoke(
        "getCohortMemberships",
        { cohort_id }
      );

      if (!res.data?.ok) {
        throw new Error(
          res.data?.error || "Unable to load cohort roster"
        );
      }

      return {
        memberships: Array.isArray(res.data.memberships)
          ? res.data.memberships
          : [],
        users: Array.isArray(res.data.users)
          ? res.data.users
          : [],
        pending_enrollments: Array.isArray(
          res.data.pending_enrollments
        )
          ? res.data.pending_enrollments
          : [],
      };
    },
    enabled: !!cohort_id && !!user,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });
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
        {
          cohort_id,
        }
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

   const memberships = cohortRoster.memberships;
  const pendingEnrollments =
    cohortRoster.pending_enrollments || [];
  const rosterUsers = cohortRoster.users;
  // Display information is returned with the secure roster.
  const orgUsers = rosterUsers;
   const userById = useMemo(() => {
     const map = {};
     for (const u of orgUsers) map[u.id] = u;
     return map;
   }, [orgUsers]);

    const managers = useMemo(
    () => memberships.filter((m) => m.cohort_role === "manager"),
    [memberships]
  );

  const trainers = useMemo(
    () => memberships.filter((m) => m.cohort_role === "trainer"),
    [memberships]
  );

  const members = useMemo(
    () => memberships.filter((m) => m.cohort_role === "member"),
    [memberships]
  );
console.log("MEMBERSHIPS", memberships);
console.log("MEMBERS", members);
console.log("ORG USERS", orgUsers);
console.log("USER MAP", userById);
  
    const existingManagerUserIds = useMemo(
    () => managers.map((m) => m.user_id),
    [managers]
  );

  const existingTrainerUserIds = useMemo(
    () => trainers.map((m) => m.user_id),
    [trainers]
  );

  const existingMemberUserIds = useMemo(
    () => members.map((m) => m.user_id),
    [members]
  );

  // Admins and active cohort managers can manage trainers and students.
  const canManageCohortRoster = useMemo(() => {
    if (!user) return false;

    if (user.role === "admin") return true;

    return managers.some((m) => m.user_id === user.id);
  }, [user, managers]);

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
  }, [user, cohort?.cohort_type, managers]);

  const {
    data: cohortInvoiceHistory = null,
    isFetching: loadingCohortInvoiceHistory,
    error: cohortInvoiceHistoryError,
    refetch: refetchCohortInvoiceHistory,
  } = useQuery({
    queryKey: [
      "ce-training-cohort-invoice-history",
      cohort_id,
    ],
    queryFn: async () => {
      const res = await base44.functions.invoke(
        "getCETrainingCohortInvoiceHistory",
        {
          cohort_id,
        }
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
      canPreviewCohortInvoice,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  const canAddTrainer = canManageCohortRoster;
  const canAddMember = canManageCohortRoster;
  const canRecordTestRegistrationWaiver =
    user?.role === "admin" &&
    cohort?.cohort_type === "training";

  const canRecordStudentTrainingCompletion = useMemo(() => {
    if (!user || cohort?.cohort_type !== "training") {
      return false;
    }

    if (user.role === "admin") {
      return true;
    }

    return [...managers, ...trainers].some(
      (membership) =>
        membership.user_id === user.id &&
        membership.is_active !== false
    );
  }, [user, cohort?.cohort_type, managers, trainers]);

  const selectedInvoiceStudents = useMemo(() => {
    const selectedIdSet = new Set(
      selectedInvoiceBillingEventIds
    );

    return (invoicePreview?.eligible_students || []).filter(
      (student) =>
        selectedIdSet.has(student?.billing_event_id)
    );
  }, [invoicePreview, selectedInvoiceBillingEventIds]);

  const selectedInvoiceCurrencies = useMemo(() => {
    return Array.from(
      new Set(
        selectedInvoiceStudents
          .map((student) =>
            String(student?.currency || "").trim().toUpperCase()
          )
          .filter(Boolean)
      )
    );
  }, [selectedInvoiceStudents]);

  const selectedInvoiceCurrency =
    selectedInvoiceCurrencies.length === 1
      ? selectedInvoiceCurrencies[0]
      : "";

  const selectedInvoiceHasMixedCurrencies =
    selectedInvoiceCurrencies.length > 1;

  const selectedInvoiceTotalCents = useMemo(() => {
    return selectedInvoiceStudents.reduce(
      (total, student) =>
        total + Number(student?.amount_cents || 0),
      0
    );
  }, [selectedInvoiceStudents]);

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

    const studentCurrency = String(
      student?.currency || ""
    ).trim().toUpperCase();

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
    const billingEventIds = selectedInvoiceBillingEventIds.filter(
      Boolean
    );

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

    const totalLabel = `${selectedInvoiceCurrency} ${(
      selectedInvoiceTotalCents / 100
    ).toFixed(2)}`;

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

      const checkoutUrl = String(
        res.data?.checkout_url || ""
      ).trim();

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
        res.data?.message ||
          "Secure cohort invoice checkout created."
      );

      window.location.assign(checkoutUrl);
    } catch (err) {
      toast.error(
        err?.message ||
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

    const totalLabel = `${String(
      invoice?.currency || "USD"
    ).toUpperCase()} ${(
      Number(invoice?.amount_cents || 0) / 100
    ).toFixed(2)}`;

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

      const checkoutUrl = String(
        res.data?.checkout_url || ""
      ).trim();

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
        res.data?.message ||
          "Secure cohort invoice checkout is ready."
      );

      window.location.assign(checkoutUrl);
    } catch (err) {
      toast.error(
        err?.message ||
          "Unable to resume the CE Training cohort invoice payment."
      );
    } finally {
      setResumingCohortInvoiceId("");
    }
  };

  const handleAddManager = async (selectedUser) => {
    setAddingManager(true);
    try {
      const res = await base44.functions.invoke("manageCohortMembership", {
        action: "add",
        cohort_id,
        user_id: selectedUser.id,
        cohort_role: "manager",
      });

      if (!res.data?.ok) {
        throw new Error(res.data?.error || "Unknown error");
      }

      toast.success("Manager added");

      await queryClient.refetchQueries({
        queryKey: ["cohorts", "memberships", cohort_id],
      });
    } catch (err) {
      toast.error(err?.message || "Failed to add manager");
    } finally {
      setAddingManager(false);
    }
  };

  const handleAddTrainer = async (selectedUser) => {
    setAddingTrainer(true);

    try {
      const res = await base44.functions.invoke("manageCohortMembership", {
        action: "add",
        cohort_id,
        user_id: selectedUser.id,
        cohort_role: "trainer",
      });

      if (!res.data?.ok) {
        throw new Error(res.data?.error || "Unable to add trainer");
      }

      toast.success("Trainer added");

      await queryClient.refetchQueries({
        queryKey: ["cohorts", "memberships", cohort_id],
      });

      return res.data;
    } catch (err) {
      toast.error(err?.message || "Failed to add trainer");
      throw err;
    } finally {
      setAddingTrainer(false);
    }
  };

   const handleAddMember = async (selectedUser) => {
    setAddingMember(true);

    try {
      const res = await base44.functions.invoke(
        "assignCEStudentToCohort",
        {
          cohort_id,
          user_id: selectedUser.id,
        }
      );

      if (!res.data?.ok) {
        throw new Error(
          res.data?.error || "Unable to assign student to cohort"
        );
      }

      toast.success(
        res.data?.message || "Student assigned to cohort"
      );

      await queryClient.refetchQueries({
        queryKey: ["cohorts", "memberships", cohort_id],
      });

      return res.data;
    } catch (err) {
      console.error("Cohort student assignment failed:", err);
      toast.error(err?.message || "Failed to assign student");
      throw err;
    } finally {
      setAddingMember(false);
    }
  };

  const handleRecordTestRegistrationWaiver = async (membership) => {
    const student =
      orgUsers?.find((row) => row.id === membership.user_id) || null;

    const studentName =
      student?.full_name ||
      student?.email ||
      "this student";

    const waiverReason = window.prompt(
      `Record a test registration waiver for ${studentName}?`,
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
        `Confirm test registration waiver for ${studentName}. No payment will be recorded.`
      )
    ) {
      return;
    }

    setWaivingMembershipId(membership.id);

    try {
      const res = await base44.functions.invoke(
        "recordCEStudentTestRegistrationWaiver",
        {
          action: "record_test_waiver",
          cohort_id,
          user_id: membership.user_id,
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

await queryClient.invalidateQueries({
  queryKey: ["cohorts", "memberships", cohort_id],
});
    } catch (err) {
      toast.error(
        err?.message ||
          "Unable to record the CE student test registration waiver."
      );
    } finally {
      setWaivingMembershipId("");
    }
  };

  const handleMarkStudentTrainingComplete = async (membership) => {
    const student =
      orgUsers?.find((row) => row.id === membership.user_id) || null;

    const studentName =
      student?.full_name ||
      student?.email ||
      "this student";

    if (
      !window.confirm(
        `Mark ${studentName} as having completed CE training requirements? This makes the student eligible for Pending Certification review.`
      )
    ) {
      return;
    }

    setCompletingMembershipId(membership.id);

    try {
      const res = await base44.functions.invoke(
        "markCEStudentTrainingComplete",
        {
          action: "mark_completed",
          cohort_id,
          membership_id: membership.id,
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

      await queryClient.invalidateQueries({
        queryKey: ["cohorts", "memberships", cohort_id],
      });
    } catch (err) {
      toast.error(
        err?.message ||
          "Unable to record CE student training completion."
      );
    } finally {
      setCompletingMembershipId("");
    }
  };

  const handleRemoveManager = async (membership) => {
    if (managers.length === 1) {
      toast.error("Cannot remove the last active manager");
      return;
    }
    if (!window.confirm(`Remove ${orgUsers?.find(u => u.id === membership.user_id)?.full_name || membership.user_id} as manager?`)) {
      return;
    }
    try {
      const res = await base44.functions.invoke("manageCohortMembership", {
        action: "remove",
        cohort_id,
        membership_id: membership.id,
        cohort_role: "manager",
      });
      if (res.data?.ok) {
        toast.success("Manager removed");
        queryClient.invalidateQueries({ queryKey: ["cohorts", "memberships", cohort_id] });
      } else {
        throw new Error(res.data?.error || "Unknown error");
      }
    } catch (err) {
      toast.error(err?.message || "Failed to remove manager");
    }
  };

    const handleRemoveTrainer = async (membership) => {
    if (
      !window.confirm(
        `Remove ${
          orgUsers?.find((u) => u.id === membership.user_id)?.full_name ||
          membership.user_id
        } as trainer?`
      )
    ) {
      return;
    }

    const rosterQueryKey = ["cohorts", "memberships", cohort_id];

    await queryClient.cancelQueries({
      queryKey: rosterQueryKey,
    });

    const previousRoster = queryClient.getQueryData(rosterQueryKey);

    queryClient.setQueryData(rosterQueryKey, (currentRoster) => {
      const currentMemberships = Array.isArray(currentRoster?.memberships)
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
      const res = await base44.functions.invoke("manageCohortMembership", {
        action: "remove",
        cohort_id,
        membership_id: membership.id,
        cohort_role: "trainer",
      });

      if (!res.data?.ok) {
        throw new Error(res.data?.error || "Unable to remove trainer");
      }

      toast.success("Trainer removed");

      await queryClient.invalidateQueries({
        queryKey: rosterQueryKey,
        refetchType: "none",
      });
    } catch (err) {
      queryClient.setQueryData(rosterQueryKey, previousRoster);
      toast.error(err?.message || "Failed to remove trainer");
    }
  };

  const handleRemoveMember = async (membership) => {
    if (
      !window.confirm(
        `Remove ${
          orgUsers?.find((u) => u.id === membership.user_id)?.full_name ||
          membership.user_id
        } as member?`
      )
    ) {
      return;
    }

    const rosterQueryKey = ["cohorts", "memberships", cohort_id];

    await queryClient.cancelQueries({
      queryKey: rosterQueryKey,
    });

    const previousRoster = queryClient.getQueryData(rosterQueryKey);

    queryClient.setQueryData(rosterQueryKey, (currentRoster) => {
      const currentMemberships = Array.isArray(currentRoster?.memberships)
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
      const res = await base44.functions.invoke("manageCohortMembership", {
        action: "remove",
        cohort_id,
        membership_id: membership.id,
        cohort_role: "member",
      });

      if (!res.data?.ok) {
        throw new Error(res.data?.error || "Unknown error");
      }

      toast.success("Member removed");

      await queryClient.invalidateQueries({
        queryKey: rosterQueryKey,
        refetchType: "none",
      });
    } catch (err) {
      queryClient.setQueryData(rosterQueryKey, previousRoster);
      toast.error(err?.message || "Failed to remove member");
    }
  };

  // ── Render guards ─────────────────────────────────────────────────────
  if (!authChecked) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
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
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
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

          {/* Add Manager Dialog */}
    <AddMemberDialog
  open={showAddTrainerDialog}
  onOpenChange={setShowAddTrainerDialog}
  title="Add Trainer"
  cohortRole="trainer"
  allowedRoles={["trainer"]}
  existingMemberUserIds={existingTrainerUserIds}
  onSubmit={handleAddTrainer}
/>

      {/* Add Trainer Dialog */}
    <AddMemberDialog
  open={showAddTrainerDialog}
  onOpenChange={setShowAddTrainerDialog}
  title="Add Trainer"
  cohortRole="trainer"
  allowedRoles={["ce_instructor"]}
  existingMemberUserIds={existingTrainerUserIds}
  onSubmit={handleAddTrainer}
/>

      {/* Assign Registered Student Dialog */}
      <AddMemberDialog
        open={showAddMemberDialog}
        onOpenChange={setShowAddMemberDialog}
        title="Assign Registered Student"
        cohortRole="member"
        allowedRoles={["ce_student"]}
        existingMemberUserIds={existingMemberUserIds}
        onSubmit={handleAddMember}
      />

      {/* 1. Back link */}
      <BackLink />

      {/* 2. Cohort Information card */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 text-white flex items-center justify-center">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{cohort.name}</h1>
              {cohort.code && <p className="text-xs text-slate-500">Code: {cohort.code}</p>}
            </div>
          </div>
          <Badge variant="outline" className={STATUS_STYLES[cohort.status] || STATUS_STYLES.planned}>
            {cohort.status}
          </Badge>
        </div>

               <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
          <InfoField label="Cohort Type" value={TYPE_LABELS[cohort.cohort_type] || cohort.cohort_type} />
          <InfoField label="Status" value={cohort.status} />
          <InfoField label="Course Name" value={cohort.course_name} />
          <InfoField label="Course Version" value={cohort.course_version} />
          <InfoField label="Start Date" value={cohort.start_date} />
          <InfoField label="End Date" value={cohort.end_date} />
          <InfoField label="Description" value={cohort.description} multiline />
          <InfoField label="Instructor Notes" value={cohort.instructor_notes} multiline />
        </dl>

        {canPreviewCohortInvoice && (
          <div className="mt-5 border-t border-slate-200 pt-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Registration Invoice Preview
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Review and select pending students whose locked CE
                  registration fees are eligible for this cohort invoice.
                  One secure checkout may contain only one currency. No CE
                  account access or enrollment is granted until Stripe
                  confirms the full invoice payment.
                </p>
              </div>

              <div className="flex gap-2">
                {showInvoicePreview && (
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
                )}

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

            {showInvoicePreview && (
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
                      <div className="rounded-md border border-slate-200 bg-white p-3">
                        <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          Invoice-Billed Invitations
                        </div>
                        <div className="mt-1 text-xl font-bold text-slate-900">
                          {invoicePreview.summary
                            ?.invoice_billed_invitation_count || 0}
                        </div>
                      </div>

                      <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
                        <div className="text-xs font-medium uppercase tracking-wide text-emerald-700">
                          Eligible Students
                        </div>
                        <div className="mt-1 text-xl font-bold text-emerald-800">
                          {invoicePreview.summary
                            ?.eligible_student_count || 0}
                        </div>
                      </div>

                      <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                        <div className="text-xs font-medium uppercase tracking-wide text-amber-700">
                          Blocked Students
                        </div>
                        <div className="mt-1 text-xl font-bold text-amber-800">
                          {invoicePreview.summary
                            ?.blocked_student_count || 0}
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">
                        Invoice Totals
                      </h3>

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
                                {total.currency}{" "}
                                {(
                                  Number(total.total_amount_cents || 0) / 100
                                ).toFixed(2)}
                              </div>
                            )
                          )}
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-slate-500">
                          No invoice-eligible registration fees are currently
                          available for this cohort.
                        </p>
                      )}
                    </div>

                    <div>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-900">
                            Eligible Students
                          </h3>
                          <p className="mt-1 text-xs text-slate-500">
                            Select the students to include in one secure Stripe
                            checkout. Students with a different currency are
                            unavailable once you make your first selection.
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

                      {(invoicePreview.eligible_students || []).length > 0 ? (
                        <>
                          <div className="mt-2 overflow-x-auto rounded-md border border-slate-200 bg-white">
                            <table className="w-full text-sm">
                              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                                <tr>
                                  <th className="w-12 px-3 py-2">
                                    <span className="sr-only">Select</span>
                                  </th>
                                  <th className="px-3 py-2">Student Email</th>
                                  <th className="px-3 py-2">Locked Fee</th>
                                  <th className="px-3 py-2">Billing Status</th>
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
                                    ).trim().toUpperCase();

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

                                    const selectionTitle =
                                      isDifferentCurrency
                                        ? `This checkout is currently limited to ${selectedInvoiceCurrency}.`
                                        : hasInvalidAmount
                                          ? "A zero-dollar or invalid registration fee cannot be included in Stripe Checkout."
                                          : "";

                                    return (
                                      <tr
                                        key={
                                          student.pending_invite_id ||
                                          billingEventId
                                        }
                                        className={
                                          isSelected
                                            ? "bg-violet-50"
                                            : ""
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
                                            title={selectionTitle}
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
                                          {student.currency}{" "}
                                          {(
                                            Number(
                                              student.amount_cents || 0
                                            ) / 100
                                          ).toFixed(2)}
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
                                    ? ` · ${selectedInvoiceCurrency} ${(
                                        selectedInvoiceTotalCents / 100
                                      ).toFixed(2)}`
                                    : ""}
                                </div>

                                <p className="mt-1 text-xs text-violet-800">
                                  The invoice and individual student billing
                                  records remain unpaid until Stripe confirms
                                  payment.
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
                                onClick={
                                  handleCreateCohortInvoiceCheckout
                                }
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
                        <p className="mt-2 text-sm text-slate-500">
                          No students are currently eligible for cohort invoice
                          billing.
                        </p>
                      )}
                    </div>


                    {(invoicePreview.blocked_students || []).length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">
                          Blocked Students
                        </h3>

                        <div className="mt-2 space-y-2">
                          {invoicePreview.blocked_students.map((student) => (
                            <div
                              key={
                                student.pending_invite_id ||
                                `${student.email}-${student.reason_code}`
                              }
                              className="rounded-md border border-amber-200 bg-amber-50 p-3"
                            >
                              <div className="text-sm font-medium text-amber-900">
                                {student.email || "Student email unavailable"}
                              </div>

                              <div className="mt-1 text-xs text-amber-800">
                                {student.reason}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            )}
          </div>
               )}
      </section>

      {canPreviewCohortInvoice && (
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Cohort Invoice History
              </h2>

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
              onClick={() => refetchCohortInvoiceHistory()}
              className="gap-2"
            >
              {loadingCohortInvoiceHistory ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : null}
              Refresh History
            </Button>
          </div>

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
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Saved Invoices
                    </div>
                    <div className="mt-1 text-xl font-bold text-slate-900">
                      {cohortInvoiceHistory.summary?.invoice_count || 0}
                    </div>
                  </div>

                  <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
                    <div className="text-xs font-medium uppercase tracking-wide text-emerald-700">
                      Paid
                    </div>
                    <div className="mt-1 text-xl font-bold text-emerald-800">
                      {cohortInvoiceHistory.summary?.paid_invoice_count || 0}
                    </div>
                  </div>

                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                    <div className="text-xs font-medium uppercase tracking-wide text-amber-700">
                      Open / Review Needed
                    </div>
                    <div className="mt-1 text-xl font-bold text-amber-800">
                      {(cohortInvoiceHistory.summary?.open_invoice_count || 0) +
                        (
                          cohortInvoiceHistory.summary
                            ?.review_required_count || 0
                        )}
                    </div>
                  </div>
                </div>

                {(cohortInvoiceHistory.invoices || []).length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No cohort invoices have been created for this Training
                    cohort yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {cohortInvoiceHistory.invoices.map((invoice) => (
                      <details
                        key={invoice.id}
                        className="rounded-lg border border-slate-200 bg-white"
                      >
                        <summary className="cursor-pointer list-none px-4 py-3">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-slate-900">
                                {invoice.student_count} student
                                {invoice.student_count === 1 ? "" : "s"} ·{" "}
                                {invoice.currency}{" "}
                                {(
                                  Number(invoice.amount_cents || 0) / 100
                                ).toFixed(2)}
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
                                className={
                                  invoice.invoice_status === "paid"
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                    : invoice.invoice_status ===
                                        "payment_processing"
                                      ? "border-blue-200 bg-blue-50 text-blue-700"
                                      : invoice.invoice_status === "failed"
                                        ? "border-rose-200 bg-rose-50 text-rose-700"
                                        : "border-amber-200 bg-amber-50 text-amber-800"
                                }
                              >
                                {invoice.invoice_status}
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
                                    resumingCohortInvoiceId !== invoice.id
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
                                      {line.currency}{" "}
                                      {(
                                        Number(line.amount_cents || 0) / 100
                                      ).toFixed(2)}
                                    </td>

                                    <td className="px-3 py-2 text-slate-600">
                                      <div>{line.line_status}</div>

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
        </section>
      )}

      {/* 3. Managers section */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100">
          <UserCog className="w-4 h-4 text-blue-600" />
          <h2 className="text-sm font-semibold text-slate-900">Managers</h2>
          <span className="ml-auto text-xs text-slate-400">
            {managers.length} active
          </span>
          {user?.role === "admin" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowAddManagerDialog(true)}
              disabled={addingManager}
              className="ml-2"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Add
            </Button>
          )}
        </div>
        <div className="p-2">
          {managers.length === 0 ? (
            <p className="text-sm text-slate-400 px-3 py-4">No active managers.</p>
          ) : (
            <div className="divide-y divide-slate-50">
               {managers.map((m) => (
                 <MemberRow
                   key={m.id}
                   member={m}
                   user={userById[m.user_id]}
                   onRemove={handleRemoveManager}
                   canRemove={user?.role === "admin" && managers.length > 1}
                 />
               ))}
             </div>
          )}
        </div>
      </section>

         {/* 4. Trainers section */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100">
          <UserCog className="w-4 h-4 text-violet-600" />
          <h2 className="text-sm font-semibold text-slate-900">Trainers</h2>

          <span className="ml-auto text-xs text-slate-400">
            {trainers.length} active
          </span>

          {canAddTrainer && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowAddTrainerDialog(true)}
              disabled={addingTrainer}
              className="ml-2"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Trainer
            </Button>
          )}
        </div>

        <div className="p-2">
          {trainers.length === 0 ? (
            <p className="text-sm text-slate-400 px-3 py-4">
              No active trainers.
            </p>
          ) : (
            <div className="divide-y divide-slate-50">
              {trainers.map((trainer) => (
                <MemberRow
                  key={trainer.id}
                  member={trainer}
                  user={userById[trainer.user_id]}
                  onRemove={handleRemoveTrainer}
                  canRemove={canAddTrainer}
                />
              ))}
            </div>
          )}
        </div>
      </section>

        {/* 5. Pending Students section */}
      {cohort?.cohort_type === "training" && (
        <section className="bg-white rounded-xl border border-amber-200 shadow-sm">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-amber-100">
            <Users className="w-4 h-4 text-amber-600" />

            <h2 className="text-sm font-semibold text-slate-900">
              Pending Students
            </h2>

            <span className="ml-auto text-xs text-slate-400">
              {pendingEnrollments.length} invited
            </span>
          </div>

          <div className="p-2">
            {pendingEnrollments.length === 0 ? (
              <p className="text-sm text-slate-400 px-3 py-4">
                No pending student invitations for this cohort.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-2">Student</th>
                      <th className="px-3 py-2">Payment Plan</th>
                      <th className="px-3 py-2">Registration Status</th>
                      <th className="px-3 py-2">Invitation Status</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {pendingEnrollments.map((student) => {
                      const paymentPlan =
                        student.payment_responsibility ===
                        "instructor_paid"
                          ? student.instructor_payment_mode ===
                            "invoice_with_cohort"
                            ? "Business pays by cohort invoice"
                            : "Business pays now"
                          : "Student pays registration fee";

                      const registrationStatus =
                        student.billing_issue
                          ? student.billing_issue
                          : ["paid", "waived"].includes(
                              student.billing_event_status
                            )
                            ? student.billing_event_status === "waived"
                              ? "Registration waived — awaiting account registration"
                              : "Registration paid — awaiting account registration"
                            : student.billing_event_status ===
                                "ready_for_checkout"
                              ? "Payment link ready"
                              : student.billing_event_status ===
                                  "payment_processing"
                                ? "Payment processing"
                                : student.billing_event_status === "failed"
                                  ? "Payment needs attention"
                                  : student.payment_responsibility ===
                                        "instructor_paid" &&
                                      student.instructor_payment_mode ===
                                        "invoice_with_cohort"
                                    ? "Awaiting cohort invoice"
                                    : "Awaiting registration payment";

                      const invitationStatus =
                        student.invite_status === "invite_email_sent"
                          ? "Invitation sent"
                          : student.invite_status ===
                              "pending_email_failed"
                            ? "Invitation email needs attention"
                            : "Invitation pending";

                      return (
                        <tr key={student.id}>
                          <td className="px-3 py-3">
                            <div className="font-medium text-slate-900">
                              {student.email || "Student email unavailable"}
                            </div>

                            <div className="mt-1 text-xs text-slate-500">
                              Pending cohort enrollment
                            </div>
                          </td>

                          <td className="px-3 py-3 text-slate-700">
                            {paymentPlan}
                          </td>

                          <td className="px-3 py-3">
                            <div
                              className={`text-sm ${
                                student.billing_issue
                                  ? "text-rose-700"
                                  : "text-slate-700"
                              }`}
                            >
                              {registrationStatus}
                            </div>

                            {student.billing_event_amount_cents !== null &&
                              student.billing_event_amount_cents !==
                                undefined && (
                                <div className="mt-1 text-xs text-slate-500">
                                  {student.billing_event_currency || "USD"}{" "}
                                  {(
                                    Number(
                                      student.billing_event_amount_cents
                                    ) / 100
                                  ).toFixed(2)}
                                </div>
                              )}
                          </td>

                          <td className="px-3 py-3">
                            <Badge
                              variant="outline"
                              className={
                                student.invite_status ===
                                "pending_email_failed"
                                  ? "border-rose-200 bg-rose-50 text-rose-700"
                                  : "border-amber-200 bg-amber-50 text-amber-800"
                              }
                            >
                              {invitationStatus}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 6. Active Students section */}
             <section className="bg-white rounded-xl border border-slate-200 shadow-sm">
         <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100">
           <Users className="w-4 h-4 text-green-600" />
           <h2 className="text-sm font-semibold text-slate-900">Active Students</h2>
           <span className="ml-auto text-xs text-slate-400">
             {members.length} enrolled
           </span>
           {canAddMember && (
             <Button
               size="sm"
               variant="outline"
               onClick={() => setShowAddMemberDialog(true)}
               disabled={addingMember}
               className="ml-2"
             >
               <Plus className="w-3.5 h-3.5 mr-1" /> Assign Registered Student
             </Button>
           )}
        </div>
        <div className="p-2">
          {members.length === 0 ? (
            <p className="text-sm text-slate-400 px-3 py-4">No active students.</p>
          ) : (
            <div className="divide-y divide-slate-50">
                         {members.map((m) => {
                 const trainingStatus =
                   m.training_status || "in_training";

                 const isCompleted =
                   trainingStatus === "completed";

                 const isMarkingComplete =
                   completingMembershipId === m.id;

                 return (
                   <div
                     key={m.id}
                     className="flex items-center gap-2"
                   >
                     <div className="min-w-0 flex-1">
                       <MemberRow
                         member={m}
                         user={userById[m.user_id]}
                         onRemove={handleRemoveMember}
                         canRemove={canAddMember}
                       />
                     </div>

                                    {cohort?.cohort_type === "training" ? (
                       <div className="mr-3 flex shrink-0 items-center gap-2">
                         {canRecordTestRegistrationWaiver &&
!m.has_settled_registration ? (
  <Button
    type="button"
    size="sm"
    variant="outline"
    disabled={waivingMembershipId === m.id}
    onClick={() =>
      handleRecordTestRegistrationWaiver(m)
    }
    className="gap-1.5 border-violet-200 text-violet-700 hover:bg-violet-50"
  >
    {waivingMembershipId === m.id ? (
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
    ) : (
      <ShieldCheck className="h-3.5 w-3.5" />
    )}
    Record Test Waiver
  </Button>
) : null}
                         {isCompleted ? (
                           <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                             Training Complete
                           </span>
                         ) : canRecordStudentTrainingCompletion ? (
                           <Button
                             type="button"
                             size="sm"
                             variant="outline"
                             disabled={isMarkingComplete}
                             onClick={() =>
                               handleMarkStudentTrainingComplete(m)
                             }
                             className="gap-1.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                           >
                             {isMarkingComplete ? (
                               <Loader2 className="h-3.5 w-3.5 animate-spin" />
                             ) : (
                               <CheckCircle2 className="h-3.5 w-3.5" />
                             )}
                             Mark Training Complete
                           </Button>
                         ) : (
                           <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                             In Training
                           </span>
                         )}
                       </div>
                     ) : null}
                   </div>
                 );
               })}
             </div>
          )}
        </div>
      </section>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/Cohorts"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
    >
      <ArrowLeft className="w-4 h-4" />
      Back to CE Cohorts
    </Link>
  );
}
