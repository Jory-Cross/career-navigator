import { base44 } from "@/api/base44Client";
import { format } from "date-fns";

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
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asBoolean(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
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
 * Application helpers
 */
function mapApplicationNoteEntry(raw) {
  if (!raw) return null;

  return {
    text: asString(raw.text),
    created_at: raw.created_at ?? null,
    created_by: asString(raw.created_by),
  };
}

function buildApplicationNoteEntries(entries = []) {
  return asArray(entries)
    .map((entry) => ({
      text: asString(entry?.text),
      created_at: entry?.created_at ?? null,
      created_by: asString(entry?.created_by),
    }))
    .filter((entry) => entry.text);
}

/**
 * Task helpers
 */
function mapChecklistItem(raw) {
  if (!raw) return null;

  return {
    text: asString(raw.text),
    completed: asBoolean(raw.completed, false),
  };
}

function buildChecklistPayload(items = []) {
  return asArray(items)
    .map((item) => ({
      text: asString(item?.text),
      completed: asBoolean(item?.completed, false),
    }))
    .filter((item) => item.text);
}

/**
 * Onboarding helpers
 */
function mapOnboardingStep(raw) {
  if (!raw) return null;

  return {
    id: raw.id,
    client_id: raw.client_id ?? null,
    step_name: asString(raw.step_name),
    step_type: asString(raw.step_type, "custom"),
    status: asString(raw.status, "pending"),
    order: typeof raw.order === "number" ? raw.order : Number(raw.order) || 0,
    notes: asString(raw.notes),
    completed_date: raw.completed_date ?? null,
    created_date: raw.created_date ?? null,
    updated_date: raw.updated_date ?? null,
    raw,
  };
}

function buildOnboardingStepPayload(payload = {}) {
  return {
    client_id: payload.client_id ?? null,
    step_name: asString(payload.step_name),
    step_type: asString(payload.step_type, "custom"),
    status: asString(payload.status, "pending"),
    order: typeof payload.order === "number" ? payload.order : Number(payload.order) || 0,
    notes: asString(payload.notes),
    completed_date: payload.completed_date ?? null,
  };
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
    client_type: asString(raw.client_type),
    onboarding_status: asString(raw.onboarding_status),
    onboarding_started_date: raw.onboarding_started_date ?? null,
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
    applied_date: raw.applied_date ?? null,
    follow_up_date: raw.follow_up_date ?? null,
    job_url: asString(raw.job_url),
    salary_range: asString(raw.salary_range),
    location: asString(raw.location),
    work_type: asString(raw.work_type),
    contact_name: asString(raw.contact_name),
    contact_title: asString(raw.contact_title),
    contact_email: asString(raw.contact_email),
    contact_phone: asString(raw.contact_phone),
    note_entries: asArray(raw.note_entries).map(mapApplicationNoteEntry).filter(Boolean),
    next_step: asString(raw.next_step),
    next_step_date: raw.next_step_date ?? null,
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
    priority: asString(raw.priority, "medium"),
    category: asString(raw.category),
    due_date: raw.due_date ?? null,
    client_ids: asArray(raw.client_ids),
    checklist: asArray(raw.checklist).map(mapChecklistItem).filter(Boolean),
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
    description: asString(raw.description || raw.notes),
    created_by: asString(raw.created_by),
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
    applied_date: payload.applied_date ?? null,
    follow_up_date: payload.follow_up_date ?? null,
    job_url: asString(payload.job_url),
    salary_range: asString(payload.salary_range),
    location: asString(payload.location),
    work_type: asString(payload.work_type),
    contact_name: asString(payload.contact_name),
    contact_title: asString(payload.contact_title),
    contact_email: asString(payload.contact_email),
    contact_phone: asString(payload.contact_phone),
    note_entries: buildApplicationNoteEntries(payload.note_entries),
    next_step: asString(payload.next_step),
    next_step_date: payload.next_step_date ?? null,
  };
}

function buildTaskPayload(payload = {}) {
  return {
    title: asString(payload.title),
    description: asString(payload.description),
    notes: asString(payload.notes),
    status: asString(payload.status, "open"),
    priority: asString(payload.priority, "medium"),
    category: asString(payload.category),
    due_date: payload.due_date ?? null,
    client_ids: asArray(payload.client_ids),
    checklist: buildChecklistPayload(payload.checklist),
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
    type: asString(payload.type || payload.activity_type),
    title: asString(payload.title),
    notes: asString(payload.notes),
    description: asString(payload.description),
    created_by: asString(payload.created_by),
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

export async function getActiveClients() {
  const clients = await base44.entities.Client.list();
  return asArray(clients)
    .map(mapClient)
    .filter(Boolean)
    .filter((client) => client.status !== "archived");
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

export async function organizeTaskNotes(rawNotes) {
  const prompt = `
Organize the following case-management task notes into a clean, concise task description.
Keep it practical and readable. Do not invent details.

Notes:
${rawNotes}
`.trim();

  const result = await base44.integrations.Core.InvokeLLM({
    prompt,
  });

  if (typeof result === "string") return result.trim();
  if (typeof result?.text === "string") return result.text.trim();
  if (typeof result?.output === "string") return result.output.trim();

  return rawNotes;
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
 * ONBOARDING
 */
export async function getOnboardingSteps(clientId) {
  if (!clientId) return [];
  const rows = await base44.entities.OnboardingStep.filter({ client_id: clientId });
  return asArray(rows)
    .map(mapOnboardingStep)
    .filter(Boolean)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
}

export async function createOnboardingStep(payload) {
  const raw = await base44.entities.OnboardingStep.create(
    buildOnboardingStepPayload(payload)
  );
  return mapOnboardingStep(raw);
}

export async function updateOnboardingStep(id, payload) {
  const raw = await base44.entities.OnboardingStep.update(
    id,
    buildOnboardingStepPayload(payload)
  );
  return mapOnboardingStep(raw);
}

export async function initializeClientOnboarding(clientId, steps = []) {
  if (!clientId) throw new Error("Client id is required");

  for (const step of asArray(steps)) {
    await createOnboardingStep({
      client_id: clientId,
      ...step,
      status: step.status || "pending",
    });
  }

  await base44.entities.Client.update(clientId, {
    onboarding_status: "in_progress",
    onboarding_started_date: format(new Date(), "yyyy-MM-dd"),
  });

  return true;
}

export async function sendOnboardingEmail(clientId, emailType) {
  if (!clientId) throw new Error("Client id is required");

  return await base44.functions.invoke("sendOnboardingEmail", {
    client_id: clientId,
    email_type: emailType,
  });
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
