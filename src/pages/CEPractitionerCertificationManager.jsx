import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  Clock3,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCheck,
  UserRound,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const CERTIFICATION_SOURCES = [
  {
    value: "trainer_business",
    label: "In-platform Trainer Business program",
  },
  {
    value: "external_provider",
    label: "External CE training provider",
  },
  {
    value: "legacy_migration",
    label: "Legacy migration",
  },
  {
    value: "manual_verification",
    label: "Manual verification",
  },
];

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }

  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function toDateInput(value) {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return parsed.toISOString().slice(0, 10);
}

function getStatusLabel(status) {
  const labels = {
    none: "No record",
    pending_verification: "Pending verification",
    verified: "Verified",
    revoked: "Revoked",
  };

  return labels[status] || "Unknown";
}

function getStatusClass(status) {
  if (status === "verified") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "pending_verification") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (status === "revoked") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  return "border-slate-200 bg-slate-100 text-slate-600";
}

function getSourceLabel(source) {
  return (
    CERTIFICATION_SOURCES.find((option) => option.value === source)?.label ||
    "—"
  );
}

function getRoleLabel(role) {
  if (!role) {
    return "No legacy role";
  }

  return role
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getInitials(person) {
  const label = String(person?.display_name || person?.email || "?").trim();

  return (
    label
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "?"
  );
}

function buildFormState(person, certifications) {
  const certification = (certifications || []).find(
    (record) => record.user_id === person?.id
  );

  return {
    certification_source:
      certification?.certification_source || "trainer_business",
    completed_at: toDateInput(certification?.completed_at),
    notes: certification?.notes || "",
    revocation_notes: "",
  };
}

function StatCard({ icon: Icon, label, value, detail }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {label}
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
          <p className="mt-1 text-xs text-slate-500">{detail}</p>
        </div>

        <div className="rounded-lg bg-slate-100 p-2">
          <Icon className="h-4 w-4 text-slate-600" />
        </div>
      </div>
    </div>
  );
}

export default function CEPractitionerCertificationManager() {
  const [data, setData] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingAction, setSavingAction] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    certification_source: "trainer_business",
    completed_at: "",
    notes: "",
    revocation_notes: "",
  });

  const people = data?.people || [];
  const certifications = data?.certifications || [];
  const counts = data?.counts || {};

  const selectedPerson = useMemo(() => {
    return people.find((person) => person.id === selectedUserId) || null;
  }, [people, selectedUserId]);

  const selectedCertification = useMemo(() => {
    if (!selectedPerson) {
      return null;
    }

    return (
      certifications.find(
        (certification) => certification.user_id === selectedPerson.id
      ) || null
    );
  }, [certifications, selectedPerson]);

  const filteredPeople = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return people.filter((person) => {
      const matchesStatus =
        statusFilter === "all" ||
        person.certification_status === statusFilter;

      if (!matchesStatus) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return [
        person.display_name,
        person.email,
        person.role,
        person.certification_status,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(normalizedSearch)
        );
    });
  }, [people, searchTerm, statusFilter]);

  async function loadManagerData({
    showRefreshToast = false,
    preferredUserId,
  } = {}) {
    setError("");

    if (showRefreshToast) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const result = await base44.functions.invoke(
        "getCEPractitionerCertificationManagerData",
        {}
      );

      const payload = result?.data || result;

      if (!payload?.ok) {
        throw new Error(
          payload?.error ||
            "Unable to load CE practitioner certification administration."
        );
      }

      const preferredId = preferredUserId || selectedUserId;
      const preferredPerson = payload.people?.find(
        (person) => person.id === preferredId
      );
      const nextPerson = preferredPerson || payload.people?.[0] || null;

      setData(payload);
      setSelectedUserId(nextPerson?.id || "");
      setForm(buildFormState(nextPerson, payload.certifications));
    } catch (loadError) {
      const message =
        loadError?.message ||
        "Unable to load CE practitioner certification administration.";

      setError(message);
      setData(null);

      if (showRefreshToast) {
        toast.error(message);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadManagerData();
  }, []);

  function selectPerson(person) {
    setSelectedUserId(person.id);
    setForm(buildFormState(person, certifications));
  }

  async function runCertificationAction(action) {
    if (!selectedPerson) {
      toast.error("Select a person first.");
      return;
    }

    if (
      (action === "create_pending" || action === "verify") &&
      !form.certification_source
    ) {
      toast.error("Select a certification source.");
      return;
    }

    if (action === "revoke" && !form.revocation_notes.trim()) {
      toast.error("A revocation explanation is required.");
      return;
    }

    const payload = {
      action,
      user_id: selectedPerson.id,
    };

    if (action === "create_pending" || action === "verify") {
      payload.certification_source = form.certification_source;
      payload.completed_at = form.completed_at || undefined;
      payload.notes = form.notes.trim() || undefined;
    }

    if (action === "revoke") {
      payload.notes = form.revocation_notes.trim();
    }

    setSavingAction(action);

    try {
      const result = await base44.functions.invoke(
        "manageCEPractitionerCertification",
        payload
      );

      const response = result?.data || result;

      if (!response?.ok) {
        throw new Error(
          response?.error || "Unable to update CE practitioner certification."
        );
      }

      const successMessages = {
        create_pending: "Certification record created as pending verification.",
        verify: "CE practitioner certification verified.",
        revoke: "CE practitioner certification revoked.",
      };

      toast.success(successMessages[action]);
      await loadManagerData({
        preferredUserId: selectedPerson.id,
      });
    } catch (actionError) {
      toast.error(
        actionError?.message ||
          "Unable to update CE practitioner certification."
      );
    } finally {
      setSavingAction("");
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[360px] items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading CE practitioner certification administration...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl space-y-5">
        <div className="rounded-xl border border-red-200 bg-red-50 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            <div>
              <h1 className="text-lg font-semibold text-red-900">
                Certification Manager Unavailable
              </h1>
              <p className="mt-1 text-sm text-red-700">{error}</p>
              <p className="mt-2 text-sm text-red-700">
                This area is restricted to active Platform Owners.
              </p>
            </div>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={() => loadManagerData({ showRefreshToast: true })}
          disabled={refreshing}
          className="gap-2"
        >
          {refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl space-y-6 pb-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <div className="flex items-center gap-2">
            <BadgeCheck className="h-5 w-5 text-indigo-600" />
            <h1 className="text-xl font-bold text-slate-900">
              CE Practitioner Certification Manager
            </h1>
          </div>

          <p className="mt-1 text-sm text-slate-500">
            Verify CE practitioner eligibility before a future organization
            grants CE Practitioner Workspace access.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={() => loadManagerData({ showRefreshToast: true })}
          disabled={refreshing}
          className="gap-2"
        >
          {refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Refresh
        </Button>
      </div>

      <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
        <div className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-indigo-700" />
          <p className="text-sm text-indigo-800">
            <span className="font-semibold">Certification is eligibility only.</span>{" "}
            It does not grant CE Practitioner Workspace access, organization
            membership, a CE role, billing entitlement, or trainer controls.
            Future practitioner access requires certification, an organization
            CE add-on, and an explicit organization-scoped practitioner role.
          </p>
        </div>
      </div>

      {data?.integrity?.duplicate_certification_count > 0 ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
            <p className="text-sm text-red-700">
              Duplicate certification records were detected for{" "}
              {data.integrity.duplicate_certification_count} user
              {data.integrity.duplicate_certification_count === 1 ? "" : "s"}.
              Do not issue new certification actions for affected people until
              the records are resolved.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={UserRound}
          label="Platform People"
          value={counts.people_count || 0}
          detail="Available for certification review"
        />
        <StatCard
          icon={Clock3}
          label="Pending"
          value={counts.pending_verification_count || 0}
          detail="Awaiting verification"
        />
        <StatCard
          icon={CheckCircle2}
          label="Verified"
          value={counts.verified_count || 0}
          detail="Certification eligibility confirmed"
        />
        <StatCard
          icon={XCircle}
          label="Revoked"
          value={counts.revoked_count || 0}
          detail="Historical records retained"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-900">
              People
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Search platform users, then select the person whose
              certification you need to review.
            </p>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <label className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search name, email, role, or certification status"
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </label>

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="all">All statuses</option>
                <option value="none">No record</option>
                <option value="pending_verification">
                  Pending verification
                </option>
                <option value="verified">Verified</option>
                <option value="revoked">Revoked</option>
              </select>
            </div>
          </div>

          {filteredPeople.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-slate-500">
              No people match the current search and status filter.
            </div>
          ) : (
            <div className="max-h-[680px] divide-y divide-slate-100 overflow-y-auto">
              {filteredPeople.map((person) => {
                const isSelected = person.id === selectedPerson?.id;

                return (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => selectPerson(person)}
                    className={`flex w-full items-center gap-3 px-5 py-3 text-left transition-colors ${
                      isSelected
                        ? "bg-indigo-50"
                        : "bg-white hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
                      {getInitials(person)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">
                        {person.display_name}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {person.email || "No email available"}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {getRoleLabel(person.role)}
                        {person.is_active ? "" : " · Inactive account"}
                      </p>
                    </div>

                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${getStatusClass(
                        person.certification_status
                      )}`}
                    >
                      {getStatusLabel(person.certification_status)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          {!selectedPerson ? (
            <div className="flex min-h-[420px] items-center justify-center px-6 text-center text-sm text-slate-500">
              Select a person to review or manage CE practitioner
              certification.
            </div>
          ) : (
            <div>
              <div className="border-b border-slate-200 px-5 py-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
                    {getInitials(selectedPerson)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-base font-semibold text-slate-900">
                      {selectedPerson.display_name}
                    </h2>
                    <p className="truncate text-sm text-slate-500">
                      {selectedPerson.email || "No email available"}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {getRoleLabel(selectedPerson.role)}
                      {selectedPerson.is_active
                        ? " · Active account"
                        : " · Inactive account"}
                    </p>
                  </div>

                  <span
                    className={`rounded-full border px-2 py-1 text-xs font-medium ${getStatusClass(
                      selectedPerson.certification_status
                    )}`}
                  >
                    {getStatusLabel(selectedPerson.certification_status)}
                  </span>
                </div>
              </div>

              <div className="space-y-5 p-5">
                {selectedCertification ? (
                  <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        Certification source
                      </p>
                      <p className="mt-1 text-sm font-medium text-slate-700">
                        {getSourceLabel(
                          selectedCertification.certification_source
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        Training completion
                      </p>
                      <p className="mt-1 text-sm font-medium text-slate-700">
                        {formatDate(selectedCertification.completed_at)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        Verification date
                      </p>
                      <p className="mt-1 text-sm font-medium text-slate-700">
                        {formatDate(selectedCertification.verified_at)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        Training cohort
                      </p>
                      <p className="mt-1 text-sm font-medium text-slate-700">
                        {selectedCertification.source_cohort_id
                          ? "Linked in-platform cohort"
                          : "No linked in-platform cohort"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                    This person does not yet have a CE practitioner
                    certification record.
                  </div>
                )}

                {selectedPerson.certification_status !== "revoked" ? (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">
                        Certification Details
                      </h3>
                      <p className="mt-1 text-xs text-slate-500">
                        This information documents eligibility. It does not
                        grant CE workspace access.
                      </p>
                    </div>

                    <label className="block">
                      <span className="text-sm font-medium text-slate-700">
                        Certification source
                      </span>
                      <select
                        value={form.certification_source}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            certification_source: event.target.value,
                          }))
                        }
                        disabled={savingAction !== ""}
                        className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                      >
                        {CERTIFICATION_SOURCES.map((source) => (
                          <option key={source.value} value={source.value}>
                            {source.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="text-sm font-medium text-slate-700">
                        Training completion date
                      </span>
                      <input
                        type="date"
                        value={form.completed_at}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            completed_at: event.target.value,
                          }))
                        }
                        disabled={savingAction !== ""}
                        className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                      />
                    </label>

                    <label className="block">
                      <span className="text-sm font-medium text-slate-700">
                        Internal notes
                      </span>
                      <textarea
                        value={form.notes}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            notes: event.target.value,
                          }))
                        }
                        disabled={savingAction !== ""}
                        rows={4}
                        placeholder="Optional verification notes"
                        className="mt-1 w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                      />
                    </label>
                  </div>
                ) : null}

                {selectedPerson.certification_status === "none" ? (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={savingAction !== ""}
                      onClick={() =>
                        runCertificationAction("create_pending")
                      }
                      className="gap-2"
                    >
                      {savingAction === "create_pending" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Clock3 className="h-4 w-4" />
                      )}
                      Create Pending Record
                    </Button>

                    <Button
                      type="button"
                      disabled={savingAction !== ""}
                      onClick={() => runCertificationAction("verify")}
                      className="gap-2"
                    >
                      {savingAction === "verify" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <UserCheck className="h-4 w-4" />
                      )}
                      Verify Now
                    </Button>
                  </div>
                ) : null}

                {selectedPerson.certification_status ===
                "pending_verification" ? (
                  <Button
                    type="button"
                    disabled={savingAction !== ""}
                    onClick={() => runCertificationAction("verify")}
                    className="gap-2"
                  >
                    {savingAction === "verify" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <UserCheck className="h-4 w-4" />
                    )}
                    Verify Certification
                  </Button>
                ) : null}

                {selectedPerson.certification_status === "verified" ? (
                  <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4">
                    <div>
                      <h3 className="text-sm font-semibold text-red-900">
                        Revoke Certification
                      </h3>
                      <p className="mt-1 text-xs text-red-700">
                        Revocation is retained as history. Re-verification is
                        intentionally not available in this first workflow.
                      </p>
                    </div>

                    <label className="block">
                      <span className="text-sm font-medium text-red-900">
                        Revocation explanation
                      </span>
                      <textarea
                        value={form.revocation_notes}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            revocation_notes: event.target.value,
                          }))
                        }
                        disabled={savingAction !== ""}
                        rows={3}
                        placeholder="Required explanation for revocation"
                        className="mt-1 w-full resize-y rounded-lg border border-red-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 disabled:cursor-not-allowed disabled:bg-red-100"
                      />
                    </label>

                    <Button
                      type="button"
                      disabled={savingAction !== ""}
                      onClick={() => runCertificationAction("revoke")}
                      className="gap-2 bg-red-600 text-white hover:bg-red-700"
                    >
                      {savingAction === "revoke" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <XCircle className="h-4 w-4" />
                      )}
                      Revoke Certification
                    </Button>
                  </div>
                ) : null}

                {selectedPerson.certification_status === "revoked" ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
                    This certification record is revoked. This workflow does
                    not allow re-verification because revocation history must
                    remain intact.
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </section>
      </div>

      <div className="flex items-center gap-2 text-xs text-slate-400">
        <CheckCircle2 className="h-4 w-4" />
        Viewer role verified by the server:{" "}
        {(data?.viewer?.platform_roles || []).join(", ") || "none"}
      </div>
    </div>
  );
}
