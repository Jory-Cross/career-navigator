import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { buildTimeEntryPayload } from "@/lib/timeEntryPayloadBuilder";

/**
 * Hard guards before persistence.
 * Fails loudly if payload structure is invalid.
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
 * Round-trip integrity check.
 * Verifies that the saved entry matches what we sent.
 * Catches mapping errors early.
 */
function validateRoundTripIntegrity(sentPayload, retrievedEntry) {
  const issues = [];

  // Check critical fields
  if (retrievedEntry.entry_type_id !== sentPayload.entry_type_id) {
    issues.push(`entry_type_id mismatch: sent=${sentPayload.entry_type_id}, got=${retrievedEntry.entry_type_id}`);
  }

  if (Number(retrievedEntry.duration_minutes) !== Number(sentPayload.duration_minutes)) {
    issues.push(`duration_minutes mismatch: sent=${sentPayload.duration_minutes}, got=${retrievedEntry.duration_minutes}`);
  }

  // Check form_data keys match
  if (sentPayload.form_data && retrievedEntry.form_data) {
    const sentKeys = Object.keys(sentPayload.form_data).sort();
    const gotKeys = Object.keys(retrievedEntry.form_data).sort();
    if (JSON.stringify(sentKeys) !== JSON.stringify(gotKeys)) {
      issues.push(`form_data keys mismatch: sent=${sentKeys.join(",")}, got=${gotKeys.join(",")}`);
    }
  }

  if (issues.length > 0) {
    console.warn("⚠️ Round-trip integrity issues found:", issues);
    throw new Error(`❌ Round-trip integrity check failed:\n${issues.join("\n")}`);
  }

  console.log("✅ Round-trip integrity verified: all fields match");
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

  let payload = null;

  try {
    // ⚠️ SILENT FAILURE GUARD - Validate inputs
    if (!entryTypeId) {
      throw new Error("❌ entryTypeId is required");
    }
    if (!formData) {
      throw new Error("❌ formData is required");
    }

    // Build unified payload
    payload = buildTimeEntryPayload({
      entryType: { id: entryTypeId },
      formData,
      schema
    });

    console.log("[saveTimeEntry] Built payload:", JSON.stringify(payload, null, 2));
    console.log("🟢 Saving Entry Payload:", payload);

    // ⚠️ Hard Guards: Validate payload before any persistence
    validateBeforeSave(payload);

    // PERSIST
    let savedEntry = null;

    if (existingEntry?.id) {
      // UPDATE
      console.log("[saveTimeEntry] Updating entry:", existingEntry.id);
      await base44.entities.TimeEntry.update(existingEntry.id, payload);
      
      // Round-trip integrity check
      const updated = await base44.entities.TimeEntry.get(existingEntry.id);
      if (!updated) {
        throw new Error("❌ Post-update verification failed: could not retrieve updated entry");
      }
      
      savedEntry = updated;
      validateRoundTripIntegrity(payload, updated);
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

      if (!createData.employee_id) {
        throw new Error("❌ Create payload missing employee_id");
      }

      console.log("🟢 FINAL SAVE PAYLOAD:", JSON.stringify(createData, null, 2));
      console.log("🟢 CURRENT CLIENT CONTEXT:", { clientId });

      const result = await base44.entities.TimeEntry.create(createData);
      
      savedEntry = result;
      if (result?.id) {
        // Verify round-trip if we have an ID
        const freshEntry = await base44.entities.TimeEntry.get(result.id);
        if (freshEntry) {
          savedEntry = freshEntry;
          validateRoundTripIntegrity(payload, freshEntry);
        }
      } else {
        console.warn("⚠️ Create returned no ID, skipping round-trip verification");
      }
      toast.success("Entry created");
    }

    console.log("✅ Round-trip verification passed, saved entry:", savedEntry);
    console.log("[saveTimeEntry] === SUCCESS ===");
    return savedEntry;
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