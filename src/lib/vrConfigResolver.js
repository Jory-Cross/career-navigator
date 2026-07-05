/**
 * Legacy browser VR configuration resolver disabled during the security
 * remediation freeze.
 *
 * This module previously listed EntryType and ReportFieldTemplate records in
 * the browser. Active TimeEntry forms must use getAuthorizedTimeEntryConfig.
 */
const REMEDIATION_ERROR =
  "VR configuration is available only through the authorized TimeEntry workflow during security remediation.";

function unavailable() {
  throw new Error(REMEDIATION_ERROR);
}

export async function getAllEntryTypes() {
  return unavailable();
}

export async function getEntryType() {
  return unavailable();
}

export async function getFieldTemplatesForEntryType() {
  return unavailable();
}

export async function getFieldTemplate() {
  return unavailable();
}

export async function isVRConfigSeeded() {
  return unavailable();
}

export function invalidateCache() {}

export async function getFieldTemplatesSorted() {
  return unavailable();
}

export async function getRequiredFields() {
  return unavailable();
}

export async function getReportableFields() {
  return unavailable();
}

export async function getFieldsBySection() {
  return unavailable();
}

export async function validateFieldAnswers() {
  return unavailable();
}
