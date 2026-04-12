import { base44 } from "@/api/base44Client";
import {
  ENTRY_TYPE_REGISTRY,
  normalizeEntryTypeCode,
  getEntryTypeConfig,
} from "@/lib/entryTypeRegistry";

const entryTypeIdCache = new Map();

function resolveCodeFromLabel(label) {
  if (!label) return "";

  const normalizedLabel = String(label).trim().toLowerCase();

  const uniqueConfigs = Object.values(ENTRY_TYPE_REGISTRY).filter(
    (config, index, arr) =>
      arr.findIndex((item) => item.code === config.code) === index
  );

  const match = uniqueConfigs.find(
    (config) => String(config.label || "").trim().toLowerCase() === normalizedLabel
  );

  return match?.code || "";
}

/**
 * Shared entry type code resolver.
 *
 * Optimized:
 * - exits fast when direct code exists
 * - caches DB lookups by entry_type_id
 */
export async function resolveEntryTypeCode(entry) {
  if (!entry) return "";

  // 1) direct code fields already stored on the record
  const directCandidates = [
    entry.entry_type_code,
    entry.entry_type,
    entry.entry_type_key,
    entry.type,
    entry.category,
  ].filter(Boolean);

  for (const candidate of directCandidates) {
    const normalized = normalizeEntryTypeCode(candidate);
    if (getEntryTypeConfig(normalized)) {
      return normalized;
    }
  }

  // 2) direct label/name fields
  const directLabelCandidates = [
    entry.entry_type_name,
    entry.entry_type_label,
    entry.type_name,
    entry.type_label,
  ].filter(Boolean);

  for (const candidate of directLabelCandidates) {
    const resolvedFromLabel = resolveCodeFromLabel(candidate);
    if (resolvedFromLabel) {
      return resolvedFromLabel;
    }
  }

  // 3) DB lookup by entry_type_id with cache
  if (entry.entry_type_id) {
    if (entryTypeIdCache.has(entry.entry_type_id)) {
      return entryTypeIdCache.get(entry.entry_type_id) || "";
    }

    try {
      let entryTypeRecord = null;

      try {
        entryTypeRecord = await base44.entities.EntryType.get(entry.entry_type_id);
      } catch (_) {
        // fallback below
      }

      if (!entryTypeRecord) {
        const results = await base44.entities.EntryType.filter({
          id: entry.entry_type_id,
        });
        entryTypeRecord = results?.[0] || null;
      }

      if (entryTypeRecord) {
        const dbCode = entryTypeRecord.code;
        const dbLabel =
          entryTypeRecord.label ||
          entryTypeRecord.name ||
          entryTypeRecord.title ||
          "";

        if (dbCode) {
          const normalized = normalizeEntryTypeCode(dbCode);
          entryTypeIdCache.set(entry.entry_type_id, normalized || "");
          if (getEntryTypeConfig(normalized)) {
            return normalized;
          }
          return normalized || "";
        }

        const resolvedFromDbLabel = resolveCodeFromLabel(dbLabel);
        entryTypeIdCache.set(entry.entry_type_id, resolvedFromDbLabel || "");
        if (resolvedFromDbLabel) {
          return resolvedFromDbLabel;
        }
      }

      entryTypeIdCache.set(entry.entry_type_id, "");
    } catch (err) {
      console.warn("[resolveEntryTypeCode] DB lookup failed:", err?.message);
    }
  }

  return "";
}

export function clearEntryTypeResolutionCache() {
  entryTypeIdCache.clear();
}
