import { getEntryTypeConfig, normalizeEntryTypeCode } from "@/lib/entryTypeRegistry";

function normalizeString(value) {
  if (value == null) return "";
  return String(value).trim();
}

function titleizeCode(code) {
  return String(code)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getNestedData(entry) {
  return (
    (entry?.form_data && typeof entry.form_data === "object" && entry.form_data) ||
    (entry?.data && typeof entry.data === "object" && entry.data) ||
    null
  );
}

function firstNonEmpty(values = []) {
  for (const value of values) {
    const normalized = normalizeString(value);
    if (normalized) return normalized;
  }
  return "";
}

function getRawCode(entryOrCode, resolvedEntryTypeCodes = {}) {
  if (typeof entryOrCode === "string") {
    return entryOrCode;
  }

  if (!entryOrCode || typeof entryOrCode !== "object") {
    return "";
  }

  const nested = getNestedData(entryOrCode);

  return firstNonEmpty([
    resolvedEntryTypeCodes?.[entryOrCode.id],
    entryOrCode.entry_type_code,
    entryOrCode.entry_type,
    entryOrCode.entry_type_key,
    entryOrCode.type,
    entryOrCode.entryTypeCode,
    nested?.entry_type_code,
    nested?.entry_type,
    nested?.entry_type_key,
    nested?.type,
  ]);
}

function getDirectLabel(entryOrCode) {
  if (!entryOrCode || typeof entryOrCode !== "object") {
    return "";
  }

  const nested = getNestedData(entryOrCode);

  return firstNonEmpty([
    entryOrCode.entry_type_name,
    entryOrCode.entry_type_label,
    entryOrCode.type_name,
    entryOrCode.type_label,
    entryOrCode.service_type_name,
    entryOrCode.service_type,
    nested?.entry_type_name,
    nested?.entry_type_label,
    nested?.type_name,
    nested?.type_label,
    nested?.service_type_name,
    nested?.service_type,
  ]);
}

/**
 * Return the best display label for a time entry or entry type code.
 *
 * Supports:
 * - direct code strings
 * - entry objects
 * - optional resolved code lookup maps
 * - direct label/name fields
 * - nested form_data/data label fields
 * - legacy category fallback
 */
export function getEntryTypeLabel(entryOrCode, resolvedEntryTypeCodes = {}) {
  const directLabel = getDirectLabel(entryOrCode);
  if (directLabel) {
    return directLabel;
  }

  const rawCode = getRawCode(entryOrCode, resolvedEntryTypeCodes);
  const normalizedCode = normalizeEntryTypeCode(rawCode);
  const config = getEntryTypeConfig(normalizedCode);

  if (config?.label) {
    return config.label;
  }

  if (normalizedCode) {
    return titleizeCode(normalizedCode);
  }

  if (entryOrCode && typeof entryOrCode === "object") {
    const nested = getNestedData(entryOrCode);

    const legacyCategory = firstNonEmpty([
      entryOrCode.category,
      nested?.category,
    ]);

    if (legacyCategory) {
      return titleizeCode(legacyCategory);
    }
  }

  return "Unknown Type";
}
