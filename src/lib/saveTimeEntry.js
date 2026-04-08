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
    // Validate required fields
    const entryTypeCode = payload.entry_type_code;
    if (!entryTypeCode) {
      throw new Error("Missing entry type code");
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

    // PERSIST
    if (existingEntry?.id) {
      // UPDATE
      console.log("[saveTimeEntry] Updating entry:", existingEntry.id);
      await base44.entities.TimeEntry.update(existingEntry.id, builderPayload);
      console.log("[saveTimeEntry] Update successful");
      
      // Verify
      const updated = await base44.entities.TimeEntry.get(existingEntry.id);
      console.log("[saveTimeEntry] Fresh record after update:", updated);
      
      toast.success("Entry updated");
    } else {
      // CREATE
      const currentUser = await base44.auth.me();
      const createData = {
        ...builderPayload,
        client_id: clientId,
        employee_id: currentUser?.id
      };
      console.log("[saveTimeEntry] Creating TimeEntry with payload:", createData);
      await base44.entities.TimeEntry.create(createData);
      console.log("[saveTimeEntry] Create successful");
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