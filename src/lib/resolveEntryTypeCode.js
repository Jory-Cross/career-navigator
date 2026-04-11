import { base44 } from "@/api/base44Client";
import {
  normalizeEntryTypeCode,
  getEntryTypeConfig,
} from "@/lib/entryTypeRegistry";

/**
 * Shared entry type code resolver.
 *
 * Resolution order:
 * 1. entry.entry_type_code
 * 2. DB lookup via entry.entry_type_id
 * 3. legacy fields: entry_type_key / entry_type
 * 4. normalized registry fallback
 *
 * Used by:
 * - TimeLogDashboard
 * - TimeTracking
 * - edit launchers
 *
 * Important:
 * This resolver must NOT use getEntryTypeOptions(), because that is a
 * UI-filtered dropdown list and may hide valid legacy/system types.
 *
 * @param {Object} entry
 * @returns {Promise<string>} canonical entry type code or ""
 */
export async function resolveEntryTypeCode(entry) {
  // 1) direct code already stored on the record
  if (entry?.entry_type_code) {
    const normalized = normalizeEntryTypeCode(entry.entry_type_code);
    if (getEntryTypeConfig(normalized)) return normalized;
    return normalized || "";
  }

  // 2) DB lookup by entry_type_id
  if (entry?.entry_type_id) {
    try {
      const results = await base44.entities.EntryType.filter({
        id: entry.entry_type_id,
      });

      const dbCode = results?.[0]?.code;
      if (dbCode) {
        const normalized = normalizeEntryTypeCode(dbCode);
        if (getEntryTypeConfig(normalized)) return normalized;
        return normalized || "";
      }
    } catch (err) {
      console.warn("[resolveEntryTypeCode] DB lookup failed:", err?.message);
    }
  }

  // 3) fallback from legacy fields stored on the entry
  const legacyCandidates = [
    entry?.entry_type_key,
    entry?.entry_type,
    entry?.type,
    entry?.category,
  ].filter(Boolean);

  for (const candidate of legacyCandidates) {
    const normalized = normalizeEntryTypeCode(candidate);
    if (getEntryTypeConfig(normalized)) {
      return normalized;
    }
  }

  console.warn("[resolveEntryTypeCode] Could not resolve entry type for entry:", {
    id: entry?.id,
    entry_type_id: entry?.entry_type_id,
    entry_type_code: entry?.entry_type_code,
    entry_type_key: entry?.entry_type_key,
    entry_type: entry?.entry_type,
    type: entry?.type,
    category: entry?.category,
  });

  return "";
}
