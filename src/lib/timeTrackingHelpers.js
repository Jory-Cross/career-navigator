// Pure helpers extracted from TimeTracking.jsx to keep the page file under the
// platform line limit. No React state — safe to share between views/components.
import { format } from "date-fns";
import { normalizeEntryTypeCode } from "@/lib/entryTypeRegistry";
import { cn } from "@/lib/utils";

export function parseDateOnly(dateString) {
  if (!dateString || typeof dateString !== "string") return null;

  const parts = dateString.split("-");
  if (parts.length !== 3) return null;

  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);

  if (!year || !month || !day) return null;

  const parsed = new Date(year, month - 1, day);

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
}

export function formatShortEntryDate(dateString) {
  const parsed = parseDateOnly(dateString);
  if (!parsed) return "";
  return format(parsed, "MMM d");
}

export function formatLongEntryDate(dateString) {
  const parsed = parseDateOnly(dateString);
  if (!parsed) return "—";
  return format(parsed, "MMM d, yyyy");
}

export function formatDurationMinutes(minutes) {
  const total = Number(minutes || 0);
  if (!total) return "0m";
  if (total < 60) return `${total}m`;

  const hours = Math.floor(total / 60);
  const remainder = total % 60;

  if (!remainder) return `${hours}h`;
  return `${hours}h ${remainder}m`;
}

export function formatHoursFromMinutes(minutes) {
  const total = Number(minutes || 0);
  if (!total) return "0h";
  // Keep exact quarter-hour precision (15 min = 0.25h) without rounding
  const hours = total / 60;
  // Trim trailing zeros but preserve up to 2 decimal places
  return `${parseFloat(hours.toFixed(2))}h`;
}

const PLACEHOLDER_VALUES = new Set(["No description", "Session", ""]);

export function getEntryDisplayText(entry, fallback = "Session") {
  const fd = entry?.form_data || {};
  const candidates = [
    entry?.description,
    fd.description,
    fd.development_activity,
    fd.activity_description,
    fd.activity_outcome,
    fd.development_activity_description,
    fd.job_development_activity_description,
    fd.job_dev_activity_description,
    fd.job_development_activity,
    fd.job_coaching_activity,
    fd.activity,
    // DSPD fields — first non-empty one wins
    fd.job_coaching,
    fd.individual_support,
    fd.community_outreach,
    fd.job_application_process,
    fd.resume_writing,
    fd.job_interview_process,
    // Life Skills fields
    fd.specific_skill_taught,
    fd.life_skills_area,
    fd.observations_comments,
    // Misc fields
    fd.admin_description,
    fd.misc_description,
    fd.preets_activity,
    fd.wsa_tasks_completed,
  ];
  for (const val of candidates) {
    if (val && !PLACEHOLDER_VALUES.has(val.trim())) return val.trim();
  }
  return fallback;
}

export function entryTypeRequiresClient(entryTypeCode) {
  const raw = String(entryTypeCode || "").trim().toLowerCase();
  const normalized = normalizeEntryTypeCode(raw);

  const noClientRequired = new Set([
    "admin_time",
    "misc",
    "miscellaneous",
    "pto",
  ]);
  const explicitlyRequiresClient = new Set([
    "job_coaching",
    "job_development",
    "life_skills",
    "csb",
    "pre_ets",
    "usor96",
    "wsa",
    "eom_reporting",
  ]);

  if (explicitlyRequiresClient.has(raw)) return true;
  if (explicitlyRequiresClient.has(normalized)) return true;

  if (noClientRequired.has(raw)) return false;
  if (noClientRequired.has(normalized)) return false;

  return true;
}

export function getImmediateEntryTypeCode(entry) {
  return normalizeEntryTypeCode(
    entry?.entry_type_code ||
      entry?.entry_type ||
      entry?.entry_type_key ||
      entry?.type ||
      entry?.category ||
      ""
  );
}

export function getEntryTypeColorClasses(entryTypeCode) {
  const code = normalizeEntryTypeCode(entryTypeCode);

  if (code === "client_non_attendance") {
    return {
      card: "border-red-200 bg-red-50/50",
      badge: "bg-red-100 text-red-700 border-red-200",
    };
  }

  if (code === "pto") {
    return {
      card: "border-teal-300 bg-teal-50 shadow-sm ring-1 ring-teal-200",
      badge: "bg-red-500 text-white border-red-600",
    };
  }

  if (code === "admin_time") {
    return {
      card: "border-slate-200 bg-slate-50/70",
      badge: "bg-slate-100 text-slate-700 border-slate-200",
    };
  }

  if (code === "dspd") {
    return {
      card: "border-purple-200 bg-purple-50/50",
      badge: "bg-purple-100 text-purple-700 border-purple-200",
    };
  }

  if (code === "job_coaching") {
    return {
      card: "border-blue-200 bg-blue-50/50",
      badge: "bg-blue-100 text-blue-700 border-blue-200",
    };
  }

  if (code === "job_development") {
    return {
      card: "border-green-200 bg-green-50/50",
      badge: "bg-green-100 text-green-700 border-green-200",
    };
  }

  if (code === "pre_ets_training") {
    return {
      card: "border-indigo-200 bg-indigo-50/50",
      badge: "bg-indigo-100 text-indigo-700 border-indigo-200",
    };
  }

  return {
    card: "border-slate-200 bg-white",
    badge: "bg-slate-100 text-slate-700 border-slate-200",
  };
}

export function entryBelongsToUser(entry, staffUser) {
  if (!staffUser) return false;
  if (entry.employee_id && entry.employee_id === staffUser.id) return true;
  if (entry.staff_id && entry.staff_id === staffUser.id) return true;
  if (entry.user_id && entry.user_id === staffUser.id) return true;
  if (staffUser.email) {
    if (entry.created_by === staffUser.email) return true;
    if (entry.employee_email === staffUser.email) return true;
    if (entry.staff_email === staffUser.email) return true;
  }
  return false;
}

// Re-export cn for callers that need it alongside these helpers.
export { cn };