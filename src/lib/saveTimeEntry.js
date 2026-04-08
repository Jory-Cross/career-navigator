import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { buildTimeEntryPayload } from "@/lib/timeEntryPayloadBuilder";

/**
 * Hard guards before persistence.
 * Fails loudly if payload structure is invalid.
 * 
 * @param {Record<string, any>} payload
 * @throws {Error} If validation fails
 */
function validateBeforeSave(payload) {
  if (!payload.entry_type_id) {
    throw new Error("❌ Hard Guard Failed: missing entry_type_id");
  }

  if (payload.duration_minutes == null || Number.isNaN(Number(payload.duration_minutes))) {
    throw new Error(`❌ Hard Guard Failed: invalid duration_minutes (${payload.duration_minutes})`);
  }

  if (typeof payload.form_data !== "object" || payload.form_data == null) {
    throw new Error("❌ Hard Guard Failed: missing or invalid form_data");
  }
}

/**
 * Unified time entry save helper.
 * Uses centralized buildTimeEntryPayload for all create/update operations.
 * 
 * @param {Object} config
 * @param {string} config.entryTypeId - Entry type ID
 * @param {Record<string, any>} config.formData - Form submission data
 * @param {Object} [config.schema] - Optional field schema
 * @param {Object} [config.existingEntry] - Existing TimeEntry record (null for create)
 * @param {string} [config.clientId] - Client ID for new entries
 * @returns {Promise<void>}
 */
export async function saveTimeEntry({ entryTypeId, formData, schema, existingEntry, clientId }) {
  console.log("[saveTimeEntry] === START ===");
  console.log("[saveTimeEntry] entryTypeId:", entryTypeId);
  console.log("[saveTimeEntry] formData:", JSON.stringify(formData, null, 2));

  try {
    // ⚠️ SILENT FAILURE GUARD - Validate inputs
    if (!entryTypeId) {
      throw new Error("❌ entryTypeId is required");
    }
    if (!formData) {
      throw new Error("❌ formData is required");
    }

    // Build unified payload
    const payload = buildTimeEntryPayload({
      entryType: { id: entryTypeId },
      formData,
      schema
    });

    console.log("[saveTimeEntry] Built payload:", JSON.stringify(payload, null, 2));
    console.log("🟢 Saving Entry Payload:", payload);

    // ⚠️ Hard Guards: Validate payload before any persistence
    validateBeforeSave(payload);

    // PERSIST
    if (existingEntry?.id) {
      // UPDATE
      console.log("[saveTimeEntry] Updating entry:", existingEntry.id);
      await base44.entities.TimeEntry.update(existingEntry.id, payload);
      console.log("[saveTimeEntry] Update successful");
      
      // ⚠️ Guard: Verify update actually persisted
      const updated = await base44.entities.TimeEntry.get(existingEntry.id);
      if (!updated) {
        throw new Error("❌ Post-update verification failed: could not retrieve updated entry");
      }
      console.log("[saveTimeEntry] Fresh record after update:", updated);
      
      toast.success("Entry updated");
    } else {
      // CREATE
      const currentUser = await base44.auth.me();
      if (!currentUser?.id) {
        throw new Error("❌ Cannot create entry: user not authenticated");
      }

      const createData = {
        ...payload,
        client_id: clientId,
        employee_id: currentUser.id
      };

      // ⚠️ Guard: Verify create data has authentication
      if (!createData.employee_id) {
        throw new Error("❌ Create payload missing employee_id");
      }

      console.log("[saveTimeEntry] Creating TimeEntry with payload:", createData);
      const result = await base44.entities.TimeEntry.create(createData);
      
      // ⚠️ Guard: Verify create returned a record
      if (!result || !result.id) {
        throw new Error("❌ Create operation failed - no ID returned");
      }

      console.log("[saveTimeEntry] Create successful, entry ID:", result.id);
      toast.success("Entry created");
    }

    console.log("[saveTimeEntry] === SUCCESS ===");
  } catch (err) {
    console.error("🔴 Save Entry Failed:", {
      payload,
      error: err?.message || String(err)
    });
    console.error("[saveTimeEntry] Error:", err?.message);
    console.log("[saveTimeEntry] === FAILED ===");
    throw err;
  }
}