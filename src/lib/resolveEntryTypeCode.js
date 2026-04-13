import { normalizeEntryTypeCode, getEntryTypeConfig } from "@/lib/entryTypeRegistry";

function normalizeString(value) {
  if (value == null) return "";
  return String(value).trim();
}

function fromDirectFields(entry) {
  return (
    entry?.entry_type_code ||
    entry?.entry_type ||
    entry?.entry_type_key ||
    entry?.type ||
    ""
  );
}

function fromNestedData(entry) {
  const nested =
    (entry?.form_data && typeof entry.form_data === "object" && entry.form_data) ||
    (entry?.data && typeof entry.data === "object" && entry.data) ||
    null;

  if (!nested) return "";

  return (
    nested.entry_type_code ||
    nested.entry_type ||
    nested.entry_type_key ||
    nested.type ||
    ""
  );
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

/**
 * Resolve the best canonical entry type code for a time entry.
 * Supports direct fields, nested legacy structures, category fallbacks, and
 * light description heuristics for older records.
 */
export async function resolveEntryTypeCode(entry) {
  const candidates
