import {
  getEntryTypeConfig,
  normalizeEntryTypeCode,
} from "@/lib/entryTypeRegistry";

/**
 * Return the best display label for a time entry or entry type code.
 *
 * Supports:
 * - direct code strings
 * - entry objects
 * - optional resolved code lookup maps
 */
export function getEntryTypeLabel(entryOrCode, resolvedEntryTypeCodes = {}) {
  let rawCode = "";

  if (typeof entryOrCode === "string") {
    rawCode = entryOrCode;
  } else if (entryOrCode && typeof entryOrCode === "object") {
    rawCode =
      resolvedEntryTypeCodes?.[entryOrCode.id] ||
      entryOrCode.entry_type_code ||
      entryOrCode.entry_type ||
      entryOrCode.entry_type_key ||
      entryOrCode.type ||
      entryOrCode.category ||
      "";
  }

  const normalizedCode = normalizeEntryTypeCode(rawCode);
  const config = getEntryTypeConfig(normalizedCode);

  if (config?.label) {
    return config.label;
  }

  if (normalizedCode) {
    return String(normalizedCode)
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  return "Unknown Type";
}
