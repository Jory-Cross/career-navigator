import {
  getEntryTypeConfig,
  normalizeEntryTypeCode,
} from "@/lib/entryTypeRegistry";

function titleizeCode(code) {
  return String(code)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getRawCode(entryOrCode, resolvedEntryTypeCodes = {}) {
  if (typeof entryOrCode === "string") {
    return entryOrCode;
  }

  if (!entryOrCode || typeof entryOrCode !== "object") {
    return "";
  }

  return (
    resolvedEntryTypeCodes?.[entryOrCode.id] ||
    entryOrCode.entry_type_code ||
    entryOrCode.entry_type ||
    entryOrCode.entry_type_key ||
    entryOrCode.type ||
    ""
  );
}

/**
 * Return the best display label for a time entry or entry type code.
 *
 * Supports:
 * - direct code strings
 * - entry objects
 * - optional resolved code lookup maps
 *
 * Notes:
 * - prefers canonical entry-type fields first
 * - avoids using legacy category as a primary source, because category values
 *   are often broader/older than the canonical entry type registry
 */
export function getEntryTypeLabel(entryOrCode, resolvedEntryTypeCodes = {}) {
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
    const legacyCategory = entryOrCode.category || "";

    if (legacyCategory) {
      return titleizeCode(legacyCategory);
    }
  }

  return "Unknown Type";
}
