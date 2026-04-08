import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { buildCreatePayload, buildUpdatePayload } from "@/lib/timeEntryPayloadBuilder";

/**
 * Unified time entry save helper using normalized payload builder.
 * 
 * Delegates all payload construction to timeEntryPayloadBuilder to ensure
 * consistent contract across all components.
 * 
 * @param {Object} config
 * @param {Object} config.payload - Form submission payload
 * @param {Object} config.existingEntry - Existing TimeEntry record (null for create)
 * @param {string} config.clientId - Client ID for new entries
 * @returns {Promise<void>}
 */
export async function saveTimeEntry({ payload, existingEntry, clientId }) {
  console.log("[saveTimeEntry] === START ===");
  console.log("[saveTimeEntry] Incoming payload:", JSON.stringify(payload, null, 2));

  try {
    // ⚠️ SILENT FAILURE GUARD - Validate payload structure
    if (!payload) {
      throw new Error("Payload is missing - cannot save entry");
    }

    // ⚠️ Guard: entry_type_code is required
    const entryTypeCode = payload.entry_type_code;
    if (!entryTypeCode) {
      throw new Error("Missing entry_type_code - entry type must be specified");
    }

    // ⚠️ Guard: date is required
    if (!payload.date) {
      throw new Error("Missing date field - service date is required");
    }

    // ⚠️ Guard: duration_minutes must exist and be positive
    if (payload.duration_minutes === undefined || payload.duration_minutes === null) {
      throw new Error("Missing duration_minutes - service hours/duration is required");
    }
    if (Number(payload.duration_minutes) <= 0) {
      throw new Error(`Invalid duration_minutes: ${payload.duration_minutes} - must be greater than 0`);
    }

    // ⚠️ Guard: form_data should exist for structured entries
    if (payload.form_data === undefined) {
      console.warn("[saveTimeEntry] ⚠️ form_data is missing - may indicate incomplete form submission");
      payload.form_data = {};
    }

    // Use normalized payload builder
    const builderPayload = existingEntry
      ? buildUpdatePayload({
          formData: payload,
          entryTypeCode,
          description: payload.description,
          timeFields: {
            start_time: payload.start_time,
            end_time: payload.end_time
          }
        })
      : buildCreatePayload({
          formData: payload,
          entryTypeCode,
          description: payload.description,
          timeFields: {
            start_time: payload.start_time,
            end_time: payload.end_time
          }
        });

    console.log("[saveTimeEntry] Normalized payload:", JSON.stringify(builderPayload, null, 2));
    console.log("🟢 Saving Entry Payload:", builderPayload);

    // ⚠️ Guard: Validate final payload before persistence
    if (!builderPayload.date) {
      throw new Error("❌ Payload validation failed: missing date after normalization");
    }
    if (!builderPayload.duration_minutes || builderPayload.duration_minutes <= 0) {
      throw new Error("❌ Payload validation failed: invalid duration_minutes after normalization");
    }
    if (!builderPayload.entry_type_code) {
      throw new Error("❌ Payload validation failed: missing entry_type_code in final payload");
    }

    // PERSIST
    if (existingEntry?.id) {
      // UPDATE
      console.log("[saveTimeEntry] Updating entry:", existingEntry.id);
      await base44.entities.TimeEntry.update(existingEntry.id, builderPayload);
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
        throw new Error("❌ Cannot create entry: user not authenticated or missing employee_id");
      }

      const createData = {
        ...builderPayload,
        client_id: clientId,
        employee_id: currentUser.id
      };

      // ⚠️ Guard: Verify create data has minimum required fields
      if (!createData.date) {
        throw new Error("❌ Create payload missing date");
      }
      if (!createData.duration_minutes || createData.duration_minutes <= 0) {
        throw new Error("❌ Create payload invalid duration_minutes");
      }
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