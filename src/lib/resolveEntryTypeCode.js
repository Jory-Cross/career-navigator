import { base44 } from "@/api/base44Client";
import { normalizeEntryTypeCode, getEntryTypeConfig } from "@/lib/entryTypeRegistry";

const ENTRY_TYPE_ID_CACHE = new Map();

function normalizeString(value) {
  if (value == null) return "";
  return String(value).trim();
}

function firstNonEmpty(values = []) {
  for (const value of values) {
    const normalized = normalizeString(value);
    if (normalized) return normalized;
  }
  return "";
}

function getNestedData(entry) {
  return (
    (entry?.form_data && typeof entry.form_data === "object" && entry.form_data) ||
    (entry?.data && typeof entry.data === "object" && entry.data) ||
    null
  );
}

function normalizeCandidateText(value) {
  const raw = normalizeString(value).toLowerCase();
  if (!raw) return "";

  const aliasMap = {
    "job coaching": "job_coaching",
    "job coach": "job_coaching",
    "job development": "job_development",
    "development": "job_development",
    "usor96": "job_development",
    "life skills": "life_skills",
    "life skills training": "life_skills",
    "csb": "csb_hours",
    "csb hours": "csb_hours",
    "admin": "admin_time",
    "admin time": "admin_time",
    "misc": "miscellaneous",
    "miscellaneous": "miscellaneous",
    "pre-ets": "pre_ets_training",
    "pre ets": "pre_ets_training",
    "pre_ets": "pre_ets_training",
    "wsa": "wsa",
    "eom": "end_of_month_reporting",
    "end of month": "end_of_month_reporting",
    "end-of-month reporting": "end_of_month_reporting",
    "work-based learning": "work_based_learning",
    "work based learning": "work_based_learning",
    "wble": "work_based_learning",
  };

  return aliasMap[raw] || raw;
}

function fromDirectFields(entry) {
  return firstNonEmpty([
    entry?.entry_type_code,
    entry?.entry_type,
    entry?.entry_type_key,
    entry?.type,
    entry?.entry_type_name,
    entry?.entry_type_label,
    entry?.type_name,
    entry?.type_label,
    entry?.service_type_name,
    entry?.service_type,
  ]);
}

function fromNestedData(entry) {
  const nested = getNestedData(entry);
  if (!nested) return "";

  return firstNonEmpty([
    nested.entry_type_code,
    nested.entry_type,
    nested.entry_type_key,
    nested.type,
    nested.entry_type_name,
    nested.entry_type_label,
    nested.type_name,
    nested.type_label,
    nested.service_type_name,
    nested.service_type,
  ]);
}

function fromKnownLegacyCategory(entry) {
  const raw = normalizeString(entry?.category).toLowerCase();
  if (!raw) return "";

  const categoryMap = {
    job_coaching: "job_coaching",
    coaching: "job_coaching",
    job_development: "job_development",
    job_dev: "job_development",
    development: "job_development",
    usor96: "job_development",
    life_skills: "life_skills",
    life_skills_training: "life_skills",
    csb: "csb_hours",
    csb_hours: "csb_hours",
    admin: "admin_time",
    admin_time: "admin_time",
    misc: "miscellaneous",
    miscellaneous: "miscellaneous",
    pre_ets: "pre_ets_training",
    pre_ets_training: "pre_ets_training",
    wsa: "wsa",
    eom_reporting: "end_of_month_reporting",
    end_of_month_reporting: "end_of_month_reporting",
    work_based_learning: "work_based_learning",
    wble: "work_based_learning",
  };

  return categoryMap[raw] || "";
}

function fromKnownFieldShapes(entry) {
  const nested = getNestedData(entry) || {};
  const keys = new Set([
    ...Object.keys(entry || {}),
    ...Object.keys(nested || {}),
  ]);

  const hasAnyKey = (candidates) => candidates.some((key) => keys.has(key));
  const hasPrefix = (prefix) =>
    Array.from(keys).some((key) => String(key).startsWith(prefix));

  if (hasPrefix("jc_")) return "job_coaching";

  if (
    hasPrefix("usor96_") ||
    hasAnyKey(["development_date", "usor96_day", "usor96_hours", "usor96_jd_activity"])
  ) {
    return "job_development";
  }

  if (
    hasAnyKey([
      "billable_service_date",
      "life_skills_area",
      "life_skills_topic",
      "life_skills_focus",
    ])
  ) {
    return "life_skills";
  }

  if (
    hasAnyKey([
      "csb_activity",
      "csb_hours",
      "crp",
      "observations",
      "comments",
    ])
  ) {
    return "csb_hours";
  }

  return "";
}

function fromDescriptionHeuristics(entry) {
  const text = normalizeString(
    entry?.description ||
      entry?.notes ||
      entry?.form_data?.description ||
      entry?.data?.description ||
      ""
  ).toLowerCase();

  if (!text) return "";

  if (text.includes("job coaching")) return "job_coaching";
  if (text.includes("job development")) return "job_development";
  if (text.includes("life skills")) return "life_skills";
  if (text.includes("pre-ets") || text.includes("pre ets")) return "pre_ets_training";
  if (text.includes("end of month") || text.includes("eom")) {
    return "end_of_month_reporting";
  }

  return "";
}

function getEntryTypeId(entry) {
  const nested = getNestedData(entry);

  return (
    entry?.entry_type_id ||
    entry?.entryTypeId ||
    nested?.entry_type_id ||
    nested?.entryTypeId ||
    null
  );
}

async function fromEntryTypeId(entry) {
  const entryTypeId = getEntryTypeId(entry);
  if (!entryTypeId) return "";

  const cacheKey = String(entryTypeId);
  if (ENTRY_TYPE_ID_CACHE.has(cacheKey)) {
    return ENTRY_TYPE_ID_CACHE.get(cacheKey) || "";
  }

  try {
    const entityApi = base44?.entities?.EntryType;
    if (!entityApi || typeof entityApi.get !== "function") {
      ENTRY_TYPE_ID_CACHE.set(cacheKey, "");
      return "";
    }

    const record = await entityApi.get(entryTypeId);

    const candidate = firstNonEmpty([
      record?.code,
      record?.entry_type_code,
      record?.key,
      record?.name,
      record?.label,
      record?.title,
    ]);

    const normalized = normalizeEntryTypeCode(normalizeCandidateText(candidate));
    const resolved = getEntryTypeConfig(normalized) ? normalized : "";

    ENTRY_TYPE_ID_CACHE.set(cacheKey, resolved);
    return resolved;
  } catch (error) {
    console.error("[resolveEntryTypeCode] Failed to resolve entry_type_id:", {
      entryTypeId,
      error,
    });
    ENTRY_TYPE_ID_CACHE.set(cacheKey, "");
    return "";
  }
}

/**
 * Resolve the best canonical entry type code for a time entry.
 * Supports:
 * - direct fields
 * - nested legacy structures
 * - label/name text
 * - entry_type_id lookup
 * - known field-shape inference
 * - category fallbacks
 * - light description heuristics
 */
export async function resolveEntryTypeCode(entry) {
  const syncCandidates = [
    fromDirectFields(entry),
    fromNestedData(entry),
    fromKnownFieldShapes(entry),
    fromKnownLegacyCategory(entry),
    fromDescriptionHeuristics(entry),
  ];

  for (const candidate of syncCandidates) {
    const normalized = normalizeEntryTypeCode(normalizeCandidateText(candidate));
    if (!normalized) continue;
    if (getEntryTypeConfig(normalized)) {
      return normalized;
    }
  }

  const fromId = await fromEntryTypeId(entry);
  if (fromId) return fromId;

  return "";
}
