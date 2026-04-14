import { base44 } from "@/api/base44Client";

/**
 * Small normalizers
 */
function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asString(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asNullableString(value) {
  return typeof value === "string" && value.trim() ? value : null;
}

function sortByNewest(items) {
  return [...asArray(items)].sort((a, b) => {
    const aTime = new Date(a?.updated_date || a?.created_date || 0).getTime();
    const bTime = new Date(b?.updated_date || b?.created_date || 0).getTime();
    return bTime - aTime;
  });
}

/**
 * Contact helpers
 */
function mapContact(raw) {
  if (!raw) return null;

  return {
    type: asString(raw.type, "other"),
    label: asString(raw.label),
    name: asString(raw.name),
    phone: asString(raw.phone),
    email: asString(raw.email),
    notes: asString(raw.notes),
  };
}

function buildClientContactsPayload(contacts = []) {
  return asArray(contacts).map((contact) => ({
    type: asString(contact?.type, "other"),
    label: asString(contact?.label),
    name: asString(contact?.name),
    phone: asString(contact?.phone),
    email: asString(contact?.email),
    notes: asString(contact?.notes),
  }));
}

/**
 * Mapping layer
 * Keeps page code less dependent on raw Base44 field shapes.
 */
function mapClient(raw) {
  if (!raw) return null;

  return {
    id: raw.id,
    first_name: asString(raw.first_name),
    last_name: asString(raw.last_name),
    full_name:
      [asString(raw.first_name), asString(raw.last_name)].filter(Boolean).join(" ") ||
      asString(raw.full_name),
    email: asString(raw.email),
    phone: asString(raw.phone),
    status: asString(raw.status, "active"),
    assigned_employee_id: raw.assigned_employee_id ?? raw.employee_id ?? null,
    contacts: asArray(raw.contacts).map(mapContact).filter(Boolean),
    raw,
  };
}

function mapApplication(raw) {
  if (!raw) return null;

  return {
    id: raw.id,
    client_id: raw.client_id ?? null,
    company: asString(raw.company),
    position: asString(raw.position),
    status: asString(raw.status, "active"),
    notes: asString(raw.notes),
    running_notes: asString(raw.running_notes),
    created_date: raw.created_date ?? null,
    updated_date: raw.updated_date ?? null,
    raw,
  };
}

function mapTask(raw) {
  if (!raw) return null;

  return {
    id: raw.id,
    title: asString(raw.title),
    description: asString(raw.description),
    notes: asString(raw.notes),
    status: asString(raw.status, "open"),
    due_date: raw.due_date ?? null,
    client_ids: asArray(raw.client_ids),
    created_date: raw.created_date ?? null,
    updated_date: raw.updated_date ?? null,
    raw,
  };
}

function mapDocument(raw) {
  if (!raw) return null;

  return {
    id: raw.id,
    client_id: raw.client_id ?? null,
    title: asString(raw.title),
    description: asString(raw.description),
    file_url: asNullableString(raw.file_url),
    created_date: raw.created_date ?? null,
    updated_date: raw.updated_date ?? null,
    raw,
  };
}

function mapActivity(raw) {
  if (!raw) return null;

  return {
    id: raw.id,
    client_id: raw.client_id ?? null,
    activity_type: asString(raw.type),
    title: asString(raw.title),
    notes: asString(raw.notes),
    created_date: raw.created_date ?? null,
    updated_date: raw.updated_date ?? null,
    raw,
  };
}

/**
 * Payload builders
 */
function buildApplicationPayload(payload = {}) {
  return {
    client_id: payload.client_id ?? null,
    company: asString(payload.company),
    position: asString(payload.position),
    status: asString(payload.status, "active"),
    notes: asString(payload.notes),
    running_notes: asString(payload.running_notes),
  };
}

function buildTaskPayload(payload = {}) {
  return {
    title: asString(payload.title),
    description: asString(payload.description),
    notes: asString(payload.notes),
    status: asString(payload.status, "open"),
    due_date: payload.due_date ?? null,
    client_ids: asArray(payload.client_ids),
  };
}

function buildDocumentPayload(payload = {}) {
  return {
    client_id: payload.client_id ?? null,
    title: asString(payload.title),
    description: asString(payload.description),
    file_url: asNullableString(payload.file_url),
  };
}

function buildActivityPayload(payload = {}) {
  return {
    client_id: payload.client_id ?? null,
    type: asString(payload.type),
    title: asString(payload.title),
    notes: asString(payload.notes),
  };
}

/**
 * AUTH
 */
export async function getCurrentUser() {
  return await base44.auth.me();
}

/**
 * CLIENT
 */
export async function getClientById(id) {
  if (!id) return null;
  const raw = await base44.entities.Client.get(id);
  return mapClient(raw);
}

export async function updateClientContacts(id, contacts) {
  if (!id) throw new Error("Client id is required");

  const raw = await base44.entities.Client.update(id, {
    contacts: buildClientContactsPayload(contacts),
  });

  return mapClient(raw);
}

export async function getClientByEmail(email) {
  if (!email) return null;
  const clients = await base44.entities.Client.list();
  const match = asArray(clients).find((c) => c.email === email);
  return mapClient(match || null);
}

/**
 * APPLICATIONS
 */
export async function getApplications(clientId) {
  if (!clientId) return [];
  const rows = await base44.entities.JobApplication.filter({ client_id: clientId });
  return sortByNewest(asArray(rows).map(mapApplication).filter(Boolean));
}

export async function createApplication(payload) {
  const raw = await base44.entities.JobApplication.create(buildApplicationPayload(payload));
  return mapApplication(raw);
}

export async function updateApplication(id, payload) {
  const raw = await base44.entities.JobApplication.update(id, buildApplicationPayload(payload));
  return mapApplication(raw);
}

/**
 * TASKS
 */
export async function getTasks(clientId) {
  if (!clientId) return [];

  try {
    const rows = await base44.entities.Task.filter({ client_ids: clientId });
    return sortByNewest(asArray(rows).map(mapTask).filter(Boolean));
  } catch {
    const all = await base44.entities.Task.list();
    return sortByNewest(
      asArray(all)
        .filter((t) => asArray(t.client_ids).includes(clientId))
        .map(mapTask)
        .filter(Boolean)
    );
  }
}

export async function createTask(payload) {
  const raw = await base44.entities.Task.create(buildTaskPayload(payload));
  return mapTask(raw);
}

export async function updateTask(id, payload) {
  const raw = await base44.entities.Task.update(id, buildTaskPayload(payload));
  return mapTask(raw);
}

export async function deleteTask(id) {
  return await base44.entities.Task.delete(id);
}

/**
 * DOCUMENTS
 */
export async function getDocuments(clientId) {
  if (!clientId) return [];
  const rows = await base44.entities.Document.filter({ client_id: clientId });
  return sortByNewest(asArray(rows).map(mapDocument).filter(Boolean));
}

export async function createDocument(payload) {
  const raw = await base44.entities.Document.create(buildDocumentPayload(payload));
  return mapDocument(raw);
}

/**
 * FILE UPLOAD
 */
export async function uploadFile(file) {
  const res = await base44.integrations.Core.UploadFile({ file });
  return res?.file_url || null;
}

/**
 * ACTIVITY
 */
export async function getActivities(clientId) {
  if (!clientId) return [];
  const rows = await base44.entities.Activity.filter({ client_id: clientId });
  return sortByNewest(asArray(rows).map(mapActivity).filter(Boolean));
}

export async function createActivity(payload) {
  const raw = await base44.entities.Activity.create(buildActivityPayload(payload));
  return mapActivity(raw);
}

/**
 * ASSESSMENTS
 */
export async function getAssessments(clientId) {
  if (!clientId) return [];
  return await base44.entities.Assessment.filter({ client_id: clientId });
}

/**
 * INTERVIEWS
 */
export async function getInterviews(clientId) {
  if (!clientId) return [];
  return await base44.entities.InterviewSession.filter({ client_id: clientId });
}

/**
 * TIME ENTRIES
 */
export async function getTimeEntries(clientId) {
  if (!clientId) return [];
  return await base44.entities.TimeEntry.filter({ client_id: clientId });
}

/**
 * MEETINGS
 */
export async function getMeetings(clientId) {
  if (!clientId) return [];
  return await base44.entities.Meeting.filter({ client_id: clientId });
}
