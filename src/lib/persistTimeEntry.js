import { base44 } from "@/api/base44Client";

/**
 * Thin persistence-only helper.
 * Receives a FULLY BUILT, ALREADY VALIDATED payload and writes it to the DB.
 * Does NOT build payloads. Does NOT validate. Does NOT call toast.
 * Called exclusively by handleDynamicEntrySave's saveEntry shim.
 *
 * @param {Object} payload - Final, frozen payload from buildTimeEntryPayload
 * @param {string|null} existingEntryId - Entry ID for updates; null for creates
 * @param {string|null} clientId - Client ID to stamp on new entries
 * @returns {Promise<Object>} Saved entry record
 */
export async function persistTimeEntry(payload, existingEntryId, clientId) {
  if (existingEntryId) {
    // UPDATE
    console.log("[persistTimeEntry] Updating entry:", existingEntryId);
    await base44.entities.TimeEntry.update(existingEntryId, payload);
    const updated = await base44.entities.TimeEntry.get(existingEntryId);
    if (!updated) throw new Error("❌ Post-update fetch failed: could not retrieve updated entry");
    return updated;
  } else {
    // CREATE
    const currentUser = await base44.auth.me();
    if (!currentUser?.id) throw new Error("❌ Cannot create entry: user not authenticated");

    const createData = {
      ...payload,
      client_id: clientId ?? payload.client_id ?? null,
      employee_id: currentUser.id,
    };

    if (!createData.employee_id) throw new Error("❌ Create payload missing employee_id");

    console.log("[persistTimeEntry] Creating entry:", JSON.stringify(createData, null, 2));
    const result = await base44.entities.TimeEntry.create(createData);
    if (!result) throw new Error("❌ Create returned no result");
    return result;
  }
}