let currentOrgId = null;

export function setOrgId(orgId) {
  currentOrgId = orgId || null;
}

export function getOrgId() {
  return currentOrgId;
}

export function clearOrgId() {
  currentOrgId = null;
}
