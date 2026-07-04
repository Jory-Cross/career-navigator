/**
 * Legacy TimeEntry factory disabled during the security remediation freeze.
 *
 * TimeEntry creation, updates, validation, and EntryType resolution must use
 * the server-authorized mutation workflow. These compatibility exports remain
 * only to prevent an accidental browser-side bypass if an old import returns.
 */

const REMEDIATION_ERROR =
  "This legacy TimeEntry workflow is unavailable during security remediation.";

export async function createTimeEntry() {
  return { success: false, error: REMEDIATION_ERROR };
}

export async function validateTimeEntryData() {
  return { valid: false, errors: [REMEDIATION_ERROR] };
}

export async function getActiveEntryTypes() {
  return [];
}

export async function getEntryType() {
  return null;
}

export async function bulkCreateTimeEntries(_base44, dataArray = []) {
  return {
    success: [],
    failed: Array.isArray(dataArray)
      ? dataArray.map((data, index) => ({
          index,
          data,
          errors: [REMEDIATION_ERROR],
        }))
      : [],
  };
}

export async function updateTimeEntry() {
  return { success: false, error: REMEDIATION_ERROR };
}
