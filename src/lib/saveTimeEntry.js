import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

/**
 * Unified time entry save helper.
 * 
 * Handles both create and update operations with proper:
 * - Duration normalization (minutes, hours → minutes)
 * - Date extraction from form_data (jc_date, jd_date, ls_date, etc.)
 * - Form data merging (existing + dynamic + payload)
 * - Entry type code fallback
 * - Error handling and logging
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
    // --- DURATION ---
    let durationMinutes = payload.duration_minutes || payload.duration || 0;

    // For structured forms, extract hours from form_data and convert to minutes
    if (durationMinutes === 0 && payload.form_data) {
      const hours =
        payload.form_data.jc_hours ||
        payload.form_data.jd_hours ||
        payload.form_data.development_hours ||
        payload.form_data.ls_hours;
      if (hours) {
        durationMinutes = parseFloat(hours) * 60;
      }
    }

    // --- DATE ---
    // First try payload.date
    let dateValue = payload.date;

    // If not present, extract from form_data (common structured field names)
    if (!dateValue && payload.form_data) {
      dateValue =
        payload.form_data.jc_date ||
        payload.form_data.jd_date ||
        payload.form_data.development_date ||
        payload.form_data.ls_date ||
        payload.form_data.coaching_date ||
        payload.form_data.job_dev_date;
    }

    // Normalize date (MM/DD/YYYY → YYYY-MM-DD)
    if (dateValue && !/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
      const m = dateValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (m) {
        const [, mm, dd, yyyy] = m;
        dateValue = `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
      }
    }

    console.log("[saveTimeEntry] Duration minutes:", durationMinutes);
    console.log("[saveTimeEntry] Date:", dateValue);
    console.log("[saveTimeEntry] payload.form_data:", payload.form_data);

    // --- VALIDATION ---
    if (!dateValue) throw new Error("Missing date");
    if (!durationMinutes) throw new Error("Missing duration");

    const entryTypeCode = payload.entry_type_code;
    if (!entryTypeCode) throw new Error("Missing entry type");

    // --- FORM DATA MERGE ---
    const reservedKeys = new Set([
      "id",
      "date",
      "duration",
      "duration_minutes",
      "description",
      "entry_type_code",
      "start_time",
      "end_time",
      "client_id",
      "employee_id",
      "status",
      "is_reportable",
      "is_billable",
      "is_payroll_eligible",
      "reporting_period_key",
      "entry_type_id",
      "category",
      "legacy_category",
      "created_date",
      "updated_date"
    ]);

    // Extract top-level dynamic fields from payload
    const topLevelDynamicFields = Object.fromEntries(
      Object.entries(payload).filter(
        ([key, value]) => !reservedKeys.has(key) && value !== undefined
      )
    );

    // Merge: existing form_data → dynamic top-level fields → payload.form_data
    const derivedFormData = {
      ...(existingEntry?.form_data || {}),
      ...topLevelDynamicFields,
      ...(payload.form_data || {})
    };

    console.log("[saveTimeEntry] topLevelDynamicFields:", topLevelDynamicFields);
    console.log("[saveTimeEntry] merged derivedFormData:", derivedFormData);

    // --- BUILD UPDATE DATA ---
    const updateData = {
      date: dateValue,
      duration_minutes: durationMinutes,
      description: payload.description,
      entry_type_code: entryTypeCode,
      start_time: payload.start_time || null,
      end_time: payload.end_time || null,
      form_data: derivedFormData
    };

    console.log("[saveTimeEntry] Update/create data:", updateData);

    // --- PERSIST ---
    if (existingEntry?.id) {
      // UPDATE
      console.log("[saveTimeEntry] Updating entry:", existingEntry.id);
      await base44.entities.TimeEntry.update(existingEntry.id, updateData);
      console.log("[saveTimeEntry] Update successful");
      
      // Verify
      const updated = await base44.entities.TimeEntry.get(existingEntry.id);
      console.log("[saveTimeEntry] Fresh record after update:", updated);
      
      toast.success("Entry updated");
    } else {
      // CREATE
      const currentUser = await base44.auth.me();
      const createData = {
        ...updateData,
        client_id: clientId,
        employee_id: currentUser?.id,
        status: "submitted",
        is_reportable: true,
        is_billable: false,
        is_payroll_eligible: true,
        reporting_period_key: dateValue.substring(0, 7)
      };
      console.log("[saveTimeEntry] Creating TimeEntry with payload:", createData);
      await base44.entities.TimeEntry.create(createData);
      console.log("[saveTimeEntry] Create successful");
      toast.success("Entry created");
    }

    console.log("[saveTimeEntry] === SUCCESS ===");
  } catch (err) {
    console.error("[saveTimeEntry] Full error object:", err);
    console.error("[saveTimeEntry] Error message:", err?.message);
    console.error("[saveTimeEntry] Error status:", err?.status);
    console.log("[saveTimeEntry] === FAILED ===");
    throw err;
  }
}