import { base44 } from "@/api/base44Client";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asString(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asBoolean(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function asNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function mapClient(raw) {
  if (!raw) return null;

  const { created_by: _legacyCreatedBy, ...safeRaw } = raw;

  return {
    ...safeRaw,
    id: raw.id,
    first_name: asString(raw.first_name),
    last_name: asString(raw.last_name),
    full_name:
      [asString(raw.first_name), asString(raw.last_name)].filter(Boolean).join(" ") ||
      asString(raw.full_name),
    email: asString(raw.email),
    status: asString(raw.status, "active"),
    client_type: asString(raw.client_type, "job_seeker"),
    target_role: asString(raw.target_role),
    location: asString(raw.location),
    assigned_employee_id: raw.assigned_employee_id ?? null,
    assigned_employer_id: raw.assigned_employer_id ?? null,
    is_archived: raw.is_archived === true || asString(raw.status) === "archived",
  };
}

function mapTimeEntry(raw) {
  if (!raw) return null;

  const { created_by: _legacyCreatedBy, ...safeRaw } = raw;

  return {
    ...safeRaw,
    id: raw.id,
    client_id: raw.client_id ?? null,
    employee_id: raw.employee_id ?? raw.staff_id ?? raw.user_id ?? null,
    staff_id: raw.staff_id ?? raw.user_id ?? null,
    entry_type_id: raw.entry_type_id ?? null,
    entry_type_code: asString(raw.entry_type_code),
    entry_type: asString(raw.entry_type),
    entry_type_key: asString(raw.entry_type_key),
    type: asString(raw.type),
    category: asString(raw.category),
    status: asString(raw.status),
    date: raw.date ?? null,
    start_time: raw.start_time ?? null,
    end_time: raw.end_time ?? null,
    duration_minutes: asNumber(raw.duration_minutes),
    notes: asString(raw.notes),
    description: asString(raw.description),
    service_authorization_id: raw.service_authorization_id ?? null,
    form_data:
      raw.form_data && typeof raw.form_data === "object" ? raw.form_data : null,
    is_billable: asBoolean(raw.is_billable, false),
    is_payroll_eligible: asBoolean(raw.is_payroll_eligible, true),
    is_reportable: asBoolean(raw.is_reportable, true),
    created_date: raw.created_date ?? null,
    updated_date: raw.updated_date ?? null,
  };
}

async function invokeAuthorizedRoute(functionName, payload) {
  const response = await base44.functions.invoke(functionName, payload);
  return response?.data ?? response ?? {};
}

/**
 * Compatibility adapter limited to the current server-authorized Time Tracking
 * workflow. Legacy client-workspace helpers were removed because they directly
 * read and mutated browser entities without tenant authority.
 *
 * Creator identity is deliberately not projected. Browser callers must use
 * canonical server-authorized employee and assignment relationships instead of
 * legacy creator fields for visibility or mutability decisions.
 */
export async function getCurrentUser() {
  return base44.auth.me();
}

export async function getAllClients() {
  const payload = await invokeAuthorizedRoute("getClientsForUser", {});

  if (!Array.isArray(payload?.clients)) {
    throw new Error(payload?.error || "Unable to load authorized clients.");
  }

  return payload.clients.map(mapClient).filter(Boolean);
}

export async function getAllTimeEntries() {
  const payload = await invokeAuthorizedRoute("getAuthorizedTimeEntries", {
    action: "list",
  });

  if (!payload?.ok || !Array.isArray(payload?.entries)) {
    throw new Error(payload?.error || "Unable to load authorized Time Entries.");
  }

  return payload.entries.map(mapTimeEntry).filter(Boolean);
}

/**
 * User lists supplied to Time Tracking are already server-scoped. Management
 * never receives a browser-expandable organization roster.
 */
export function getScopedUsers(allUsers = [], user) {
  if (!user) return [];

  if (user.role === "employee") {
    return asArray(allUsers).filter((candidate) => candidate?.id === user.id);
  }

  return asArray(allUsers);
}

/**
 * Clients supplied by getClientsForUser are already server-scoped. Do not apply
 * legacy manager_id or browser-created-by expansion here.
 */
export function getScopedClients(allClients = []) {
  return asArray(allClients);
}

export async function analyzeDocumentContent(payload) {
  return base44.functions.invoke("analyzeDocumentContent", payload);
}

const LEGACY_ERROR =
  "This legacy client-workspace API is unavailable during security remediation.";

export async function getClientById() {
  throw new Error(LEGACY_ERROR);
}

export async function getClientByEmail() {
  throw new Error(LEGACY_ERROR);
}

export async function updateClientContacts() {
  throw new Error(LEGACY_ERROR);
}

export async function updateTimeEntry() {
  throw new Error(LEGACY_ERROR);
}

export async function deleteTimeEntry() {
  throw new Error(LEGACY_ERROR);
}
