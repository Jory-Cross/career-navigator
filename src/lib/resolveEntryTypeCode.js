import { base44 } from "@/api/base44Client";
import { getEntryTypeOptions } from "@/lib/entryTypeRegistry";

/**
 * Shared entry type code resolver.
 *
 * Resolution order:
 * 1. entry.entry_type_code (already stored on the record)
 * 2. DB lookup via entry.entry_type_id (fetches from EntryType entity)
 * 3. Registry fallback via legacy fields (entry_type_key, entry_type)
 *
 * Used by both TimeLogDashboard and TimeTracking edit launchers.
 * Do not add custom inline resolution anywhere else.
 *
 * @param {Object} entry - Raw saved TimeEntry record
 * @returns {Promise<string>} Resolved entry type code, or "" if unresolvable
 */
export async function resolveEntryTypeCode(entry) {
  // 1. Direct code on the record
  if (entry?.entry_type_code) return entry.entry_type_code;

  // 2. DB lookup by entry_type_id
  if (entry?.entry_type_id) {
    try {
      const results = await base44.entities.EntryType.filter({ id: entry.entry_type_id });
      if (results?.[0]?.code) return results[0].code;
    } catch (err) {
      console.warn("[resolveEntryTypeCode] DB lookup failed:", err?.message);
    }
  }

  // 3. Registry fallback via legacy fields
  const options = getEntryTypeOptions();
  const match = options.find(
    opt => opt.value === entry?.entry_type_key || opt.value === entry?.entry_type
  );
  if (match) return match.value;

  console.warn("[resolveEntryTypeCode] Could not resolve entry type for entry:", {
    id: entry?.id,
    entry_type_id: entry?.entry_type_id,
    entry_type_code: entry?.entry_type_code,
    entry_type_key: entry?.entry_type_key,
    entry_type: entry?.entry_type,
  });
  return "";
}