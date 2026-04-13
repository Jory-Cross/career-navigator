import { base44 } from "@/api/base44Client";

let currentUserPromise = null;

const persistTimeEntryApi = {
  async getCurrentUser() {
    if (!currentUserPromise) {
      currentUserPromise = base44.auth.me().catch((error) => {
        currentUserPromise = null;
        throw error;
      });
    }

    return await currentUserPromise;
  },

  async updateTimeEntry(id, payload) {
    return await base44.entities.TimeEntry.update(id, payload);
  },

  async getTimeEntry(id) {
    return await base44.entities.TimeEntry.get(id);
  },

  async createTimeEntry(payload) {
    return await base44.entities.TimeEntry.create(payload);
  },

  clearUserCache() {
    currentUserPromise = null;
  },
};

function sanitizeCreateData(payload, clientId, employeeId) {
  const createData = {
    ...payload,
    client_id: clientId ?? payload.client_id ?? null,
    employee_id: payload.employee_id ?? employeeId ?? null,
  };

  if (createData.client_id === undefined) {
    createData.client_id = null;
  }

  return createData;
}

/**
 * Thin persistence-only helper.
 * Receives a FULLY BUILT, ALREADY VALIDATED payload and writes it to the DB.
 * Does NOT build payloads.
 * Does NOT validate.
 * Does NOT call toast.
 *
 * @param {Object} payload - Final, frozen payload from buildTimeEntryPayload
 * @param {string|null} existingEntryId - Entry ID for updates; null for creates
 * @param {string|null} clientId - Client ID to stamp on new entries
 * @returns {Promise<Object>} Saved entry record
 */
export async function persistTimeEntry(payload, existingEntryId, clientId) {
  if (!payload || typeof payload !== "object") {
    throw new Error("❌ Cannot persist entry: payload is missing or invalid");
  }

  if (existingEntryId) {
    console.log("[persistTimeEntry] Updating entry:", existingEntryId);

    await persistTimeEntryApi.updateTimeEntry(existingEntryId, payload);

    const updated = await persistTimeEntryApi.getTimeEntry(existingEntryId);

    if (!updated) {
      throw new Error("❌ Post-update fetch failed: could not retrieve updated entry");
    }

    return updated;
  }

  const currentUser = await persistTimeEntryApi.getCurrentUser();

  if (!currentUser?.id) {
    throw new Error("❌ Cannot create entry: user not authenticated");
  }

  const createData = sanitizeCreateData(payload, clientId, currentUser.id);

  if (!createData.employee_id) {
    throw new Error("❌ Create payload missing employee_id");
  }

  console.log(
    "[persistTimeEntry] Creating entry:",
    JSON.stringify(createData, null, 2)
  );

  const result = await persistTimeEntryApi.createTimeEntry(createData);

  if (!result) {
    throw new Error("❌ Create returned no result");
  }

  return result;
}

export function clearPersistTimeEntryCaches() {
  persistTimeEntryApi.clearUserCache();
}
