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

function asNumber(value, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : Number.isFinite(Number(value))
    ? Number(value)
    : fallback;
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
 * Interview helpers
 */
function mapInterviewQuestion(raw) {
  if (!raw) return null;

  return {
    question: asString(raw.question),
    category: asString(raw.category, "General"),
    answer: asString(raw.answer),
    feedback: asString(raw.feedback),
    score: typeof raw.score === "number" ? raw.score : Number(raw.score) || null,
  };
}

function mapInterviewSession(raw) {
  if (!raw) return null;

  return {
    id: raw.id,
    client_id: raw.client_id ?? null,
    job_application_id: raw.job_application_id ?? null,
    target_role: asString(raw.target_role),
    industry: asString(raw.industry),
    company: asString(raw.company),
    session_date: raw.session_date ?? null,
    session_type: asString(raw.session_type, "practice"),
    questions: asArray(raw.questions).map(mapInterviewQuestion).filter(Boolean),
    overall_feedback: asString(raw.overall_feedback),
    improvement_tips: asArray(raw.improvement_tips).filter(Boolean),
    notes: asString(raw.notes),
    tags: asArray(raw.tags).filter(Boolean),
    created_date: raw.created_date ?? null,
    updated_date: raw.updated_date ?? null,
    raw,
  };
}

function buildInterviewQuestionPayload(questions = []) {
  return asArray(questions).map((q) => ({
    question: asString(q?.question),
    category: asString(q?.category, "General"),
    answer: asString(q?.answer),
    feedback: asString(q?.feedback),
    score: typeof q?.score === "number" ? q.score : Number(q?.score) || null,
  }));
}

function buildInterviewSessionPayload(payload = {}) {
  return {
    client_id: payload.client_id ?? null,
    job_application_id: payload.job_application_id ?? null,
    target_role: asString(payload.target_role),
    industry: asString(payload.industry),
    company: asString(payload.company),
    session_date: payload.session_date ?? null,
    session_type: asString(payload.session_type, "practice"),
    questions: buildInterviewQuestionPayload(payload.questions),
    overall_feedback: asString(payload.overall_feedback),
    improvement_tips: asArray(payload.improvement_tips).filter(Boolean),
    notes: asString(payload.notes),
    tags: asArray(payload.tags).filter(Boolean),
  };
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
    created_by: asString(raw.created_by),
    is_archived: Boolean(raw.is_archived) || asString(raw.status) === "archived",
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
    visibility: asString(raw.visibility, "staff"),
    source: asString(raw.source, "staff_upload"),
    category: asString(raw.category),
    file_name: asString(raw.file_name),
    file_size: asNumber(raw.file_size, 0),
    file_type: asString(raw.file_type),
    tags: asArray(raw.tags),
    ai_tags: asArray(raw.ai_tags),
ai_summary: asString(raw.ai_summary),
ai_insights: asString(raw.ai_insights),
ai_last_processed: raw.ai_last_processed ?? null,
    notes: asString(raw.notes),
    version: asNumber(raw.version, 1),
    parent_document_id: raw.parent_document_id ?? null,
    is_archived: asBoolean(raw.is_archived, false),
    created_by: asString(raw.created_by),
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
    visibility: asString(payload.visibility, "staff"),
    source: asString(payload.source, "staff_upload"),
    category: asString(payload.category),
    file_name: asString(payload.file_name),
    file_size: asNumber(payload.file_size, 0),
    file_type: asString(payload.file_type),
    tags: asArray(payload.tags),
    notes: asString(payload.notes),
    version: asNumber(payload.version, 1),
    parent_document_id: payload.parent_document_id ?? null,
    ai_tags: asArray(payload.ai_tags),
ai_summary: asString(payload.ai_summary),
ai_insights: asString(payload.ai_insights),
ai_last_processed: payload.ai_last_processed ?? null,
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
/**
 * TIME TRACKING SHARED HELPERS
 */

function mapUser(raw) {
  if (!raw) return null;

  return {
    id: raw.id,
    full_name:
      asString(raw.full_name) ||
      [asString(raw.first_name), asString(raw.last_name)].filter(Boolean).join(" "),
    first_name: asString(raw.first_name),
    last_name: asString(raw.last_name),
    email: asString(raw.email),
    role: asString(raw.role),
    manager_id: raw.manager_id ?? null,
    organization_id: raw.organization_id ?? null,
    is_archived: Boolean(raw.is_archived),
    created_date: raw.created_date ?? null,
    updated_date: raw.updated_date ?? null,
    raw,
  };
}

function mapTimeEntry(raw) {
  if (!raw) return null;

  return {
    id: raw.id,
    client_id: raw.client_id ?? null,
    staff_id: raw.staff_id ?? raw.user_id ?? null,
    created_by: asString(raw.created_by),
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
    duration_minutes:
      typeof raw.duration_minutes === "number"
        ? raw.duration_minutes
        : Number(raw.duration_minutes) || 0,
    notes: asString(raw.notes),
    description: asString(raw.description),
    created_date: raw.created_date ?? null,
    updated_date: raw.updated_date ?? null,
    raw,
  };
}

export async function getAllUsers() {
  const rows = await base44.entities.User.list();
  return asArray(rows).map(mapUser).filter(Boolean);
}
export async function getAllClients() {
  const rows = await base44.entities.Client.list();
  return asArray(rows).map(mapClient).filter(Boolean);
}
export async function getAllTimeEntries() {
  const rows = await base44.entities.TimeEntry.list("-created_date");
  return asArray(rows).map(mapTimeEntry).filter(Boolean);
}

export async function getTimeEntryById(id) {
  if (!id) return null;
  const raw = await base44.entities.TimeEntry.get(id);
  return mapTimeEntry(raw);
}

export async function updateTimeEntry(id, payload) {
  if (!id) throw new Error("Time entry id is required");
  const raw = await base44.entities.TimeEntry.update(id, payload);
  return mapTimeEntry(raw);
}

export async function deleteTimeEntry(id) {
  if (!id) throw new Error("Time entry id is required");
  return await base44.entities.TimeEntry.delete(id);
}

export function getScopedUsers(allUsers = [], user) {
  if (!user) return [];

  if (user.role === "admin") {
    return asArray(allUsers);
  }

  if (user.role === "management") {
    return asArray(allUsers).filter(
      (u) => u.id === user.id || u.manager_id === user.id
    );
  }

  return asArray(allUsers).filter((u) => u.id === user.id);
}

export function getScopedClients(allClients = [], user, allUsers = []) {
  if (!user) return [];

  if (user.role === "admin") {
    return asArray(allClients);
  }

  if (user.role === "management") {
    const subordinateIds = new Set(
      asArray(allUsers)
        .filter((u) => u.manager_id === user.id)
        .map((u) => u.id)
    );

    return asArray(allClients).filter(
      (client) =>
        client.assigned_employee_id === user.id ||
        subordinateIds.has(client.assigned_employee_id)
    );
  }

  return asArray(allClients).filter(
    (client) =>
      client.assigned_employee_id === user.id ||
      client.created_by === user.email
  );
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

  const rows = await base44.entities.Client.filter({
    email,
  });

  const match = asArray(rows)[0] || null;
  return mapClient(match);
}

export async function getActiveClients() {
  const clients = await base44.entities.Client.list();
  return asArray(clients)
    .map(mapClient)
    .filter(Boolean)
    .filter((client) => client.status !== "archived");
}

// ============================================================
// SHARED RECOMMENDATIONS (CLIENT PORTAL)
// ============================================================

function mapRecommendation(raw) {
  if (!raw) return null;

  return {
    id: raw.id,
    client_id: raw.client_id ?? null,
    job_title: asString(raw.job_title),
    employer: asString(raw.employer),
    location: asString(raw.location),
    pay: asString(raw.pay),

    status: asString(raw.status),
    shared_with_client: asBoolean(raw.shared_with_client, false),

    fit_score: asNumber(raw.fit_score, 0),
    fit_reason: asString(raw.fit_reason),
    support_strategy: asString(raw.support_strategy),
    concerns: asString(raw.concerns),

    client_response: asString(raw.client_response),
    client_responded_at: raw.client_responded_at ?? null,
    client_response_notes: asString(raw.client_response_notes),

    created_date: raw.created_date ?? null,
    updated_date: raw.updated_date ?? null,

    raw,
  };
}

export async function updateRecommendationClientResponse({
  batchId,
  index,
  response,
}) {
  if (!batchId && batchId !== 0) return;

  const batch = await base44.entities.JobRecommendationBatch.get(batchId);

  const jobs = JSON.parse(batch.recommended_job_fields_json || "[]");

  if (!jobs[index]) return;

  const nextStatus =
    response === "interested"
      ? "job_search_target"
      : response === "not_interested"
      ? "archived"
      : jobs[index].status;

  jobs[index] = {
    ...jobs[index],
    client_response: response,
    client_responded_at: new Date().toISOString(),
    status: nextStatus,
  };

  // 🔍 Check if any jobs still need review
const stillNeedsReview = jobs.some(j => j.status === "suggested");

await base44.entities.JobRecommendationBatch.update(batchId, {
  recommended_job_fields_json: JSON.stringify(jobs),
  status: stillNeedsReview ? "pending_review" : "fully_reviewed",
});

  return true;
}

export async function getSharedRecommendations(clientId) {
  if (!clientId) return [];

  try {
    const batches = await base44.entities.JobRecommendationBatch.filter({
      client_id: clientId,
    });

    let allRecommendations = [];

    // 🔥 ONLY USE LATEST BATCH
const latestBatch = batches.sort(
  (a, b) => new Date(b.generated_at) - new Date(a.generated_at)
)[0];

for (const batch of [latestBatch]) {
      const jobs = JSON.parse(batch.recommended_job_fields_json || "[]");

      const mapped = jobs
        .map((job, index) => ({
          id: `${batch.id}-${index}`,
          client_id: batch.client_id,

                    job_title: asString(job.job_title || job.title || job.occupation_title),
          title: asString(job.title || job.job_title || job.occupation_title),
          employer: asString(job.employer),
          location: asString(job.location),
          pay: asString(job.pay),

          status: asString(job.status),
          shared_with_client: asBoolean(job.shared_with_client, false),

          fit_score: asNumber(job.fit_score, 0),
          fit_reason: asString(job.fit_reason),
          support_strategy: asString(job.support_strategy),
          concerns: asString(job.concerns),

          client_response: asString(job.client_response),
          client_responded_at: job.client_responded_at ?? null,
          client_response_notes: asString(job.client_response_notes),

          created_date: batch.generated_at,
          updated_date: batch.generated_at,
        }))
        .filter((rec) => rec.shared_with_client);

      allRecommendations.push(...mapped);
    }

        const uniqueRecommendations = [];
const seenKeys = new Set();

for (const recommendation of allRecommendations) {
  const key = `${recommendation.client_id}-${asString(
    recommendation.job_title || recommendation.title
  ).toLowerCase()}`;

  if (!seenKeys.has(key)) {
    seenKeys.add(key);
    uniqueRecommendations.push(recommendation);
  }
}

    return sortByNewest(uniqueRecommendations);
  } catch (e) {
    console.error("Failed to load shared recommendations", e);
    return [];
  }
}

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

  const [documentRows, assessmentRows] = await Promise.all([
    base44.entities.Document.filter({ client_id: clientId }),
    base44.entities.Assessment.filter({ client_id: clientId }),
  ]);

  const documents = asArray(documentRows).map(mapDocument).filter(Boolean);

    const assessmentDocs = asArray(assessmentRows).map((a) => ({
    id: `assessment-${a.id}`,
    assessment_id: a.id,
    is_assessment: true,
    client_id: a.client_id,
    title: a.assessment_type || "Assessment",
    description: a.notes || "",
    file_url: a.pdf_url || null,
    visibility: "staff",
    source: "assessment",
    category: "assessment",
    file_name: `${a.assessment_type || "assessment"}.pdf`,
    file_size: 0,
    file_type: "pdf",
    tags: [],
    ai_tags: [],
    notes: a.notes || "",
    version: 1,
    parent_document_id: null,
    is_archived: asBoolean(a.is_archived, false),
    created_by: a.created_by || "",
    created_date: a.created_date || null,
    updated_date: a.updated_date || null,
    raw: a,
  }));

  return sortByNewest([...documents, ...assessmentDocs]);
}
export async function analyzeDocumentContent(payload) {
  return await base44.functions.invoke("analyzeDocumentContent", payload);
}
export async function getClientVisibleDocuments(clientId) {
  if (!clientId) return [];

  const rows = await base44.entities.Document.filter({
    client_id: clientId,
  });

  return sortByNewest(
    asArray(rows)
      .map(mapDocument)
      .filter(Boolean)
      .filter((doc) => !doc.is_archived)
      .filter((doc) => {
        const visibility = String(doc.visibility || "").toLowerCase().trim();
        return visibility === "client" || visibility === "both";
      })
  );
}
export async function getStaffVisibleDocuments(clientId) {
  if (!clientId) return [];
  const rows = await base44.entities.Document.filter({ client_id: clientId });

  return sortByNewest(
    asArray(rows)
      .map(mapDocument)
      .filter(Boolean)
      .filter((doc) => doc.visibility === "staff" || doc.visibility === "both")
  );
}
export async function getDocumentVersions(docId) {
  if (!docId) return [];

  const [mainDoc, versionRows] = await Promise.all([
    base44.entities.Document.get(docId).catch(() => null),
    base44.entities.Document.filter({ parent_document_id: docId }),
  ]);

  return [mainDoc, ...asArray(versionRows)]
    .map(mapDocument)
    .filter(Boolean)
    .sort((a, b) => (b.version || 0) - (a.version || 0));
}
export async function createDocument(payload) {
  const builtPayload = buildDocumentPayload({
    ...payload,
    ai_tags: payload.ai_tags || [],
    ai_summary: payload.ai_summary || "",
    ai_insights: payload.ai_insights || "",
    ai_last_processed: new Date().toISOString(),
    source: payload.source || (payload.category === "generated_report" ? "generated" : "staff_upload"),
  });

  console.log("CREATE DOCUMENT PAYLOAD:", builtPayload);

  const raw = await base44.entities.Document.create(builtPayload);

  console.log("CREATE DOCUMENT RAW RESULT:", raw);

  return mapDocument(raw);
}
export async function updateDocument(id, payload) {
  if (!id) throw new Error("Document id is required");

  const existing = await base44.entities.Document.get(id);

  const raw = await base44.entities.Document.update(
    id,
    buildDocumentPayload({
      ...existing,
      ...payload,
    })
  );

  return mapDocument(raw);
}
export async function archiveDocument(id) {
  if (!id) throw new Error("Document id is required");

  console.log("ARCHIVE DOCUMENT ID", id);

  const existing = await base44.entities.Document.get(id);

  console.log("ARCHIVE EXISTING", existing);

  const raw = await base44.entities.Document.update(id, {
    ...existing,
    is_archived: true,
  });

  console.log("ARCHIVE RESULT", raw);

  return mapDocument(raw);
}
async function deleteFileByUrl(fileUrl) {
  if (!fileUrl) return;

  try {
    const filePath = fileUrl.split(".com/")[1];

    if (!filePath) return;

    await base44.integrations.Core.DeleteFile({
      file_path: filePath,
    });
  } catch (err) {
    console.error("DELETE FILE FAILED", err);
  }
}

export async function deleteDocument(docId) {
  if (!docId) throw new Error("Document id is required");

  try {
    const doc = await base44.entities.Document.get(docId);
console.log("DOC FILE URL:", doc?.file_url);
    await deleteFileByUrl(doc?.file_url);

    return await base44.entities.Document.delete(docId);
  } catch (err) {
    console.error("DELETE DOCUMENT FAILED", err);
    throw err;
  }
}


/**
 * FILE UPLOAD
 */
// AI Document Analysis (temporary Base44 bridge)
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
 * INTERVIEW PREP
 */
export async function getInterviewSessions(clientId) {
  if (!clientId) return [];
  const rows = await base44.entities.InterviewSession.filter({ client_id: clientId });
  return sortByNewest(asArray(rows).map(mapInterviewSession).filter(Boolean));
}

export async function createInterviewSession(payload) {
  const raw = await base44.entities.InterviewSession.create(
    buildInterviewSessionPayload(payload)
  );
  return mapInterviewSession(raw);
}

export async function updateInterviewSession(id, payload) {
  const raw = await base44.entities.InterviewSession.update(
    id,
    buildInterviewSessionPayload(payload)
  );
  return mapInterviewSession(raw);
}

export async function deleteInterviewSession(id) {
  return await base44.entities.InterviewSession.delete(id);
}

export async function generateInterviewQuestions({ client, jobApplication }) {
  const prompt = jobApplication
    ? `Generate 5 tailored interview questions for someone applying for a ${jobApplication.position} position at ${jobApplication.company}.
Company role: ${client.target_role} ${jobApplication.ai_fit_analysis ? `Context: ${jobApplication.ai_fit_analysis}` : ""}
Focus on:
1. Role-specific challenges at this company
2. Why they want to work there
3. Relevant experience and skills
4. Problem-solving for company's context
5. Cultural fit

For each question, categorize it appropriately.`
    : `Generate 5 common interview questions for someone applying for a ${client.target_role} position in the ${client.industry || "general"} industry.
Include a mix of:
1. Behavioral questions (STAR method)
2. Technical/role-specific questions
3. Situational questions
4. Questions about experience and skills

For each question, categorize it (e.g., Behavioral, Technical, Situational).`;

  const result = await base44.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: {
      type: "object",
      properties: {
        questions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              question: { type: "string" },
              category: { type: "string" },
            },
          },
        },
      },
    },
  });

  return asArray(result?.questions);
}

export async function analyzeInterviewAnswer({ question, category, answer }) {
  const prompt = `You are an interview coach.

Evaluate this candidate's answer to the interview question.

Question: ${question}
Category: ${category}
Answer: ${answer}

Provide:
1. A score from 0-100
2. Detailed feedback on:
- Clarity and structure
- Relevance to the question
- Use of specific examples and keywords
- Areas for improvement

Be constructive and specific.`;

  const result = await base44.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: {
      type: "object",
      properties: {
        score: { type: "number" },
        feedback: { type: "string" },
      },
    },
  });

  return {
    score: typeof result?.score === "number" ? result.score : 0,
    feedback: asString(result?.feedback),
  };
}

export async function generateInterviewOverallFeedback(questions = []) {
  const prompt = `Based on these interview practice responses, provide:
1. Overall performance summary
2. Top 3 personalized improvement tips

Questions and Scores:
${asArray(questions)
  .map(
    (q, i) =>
      `${i + 1}. ${q.question}\nScore: ${q.score}/100\nFeedback: ${q.feedback}`
  )
  .join("\n\n")}`;

  const result = await base44.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: {
      type: "object",
      properties: {
        overall_feedback: { type: "string" },
        improvement_tips: {
          type: "array",
          items: { type: "string" },
        },
      },
    },
  });

  return {
    overall_feedback: asString(result?.overall_feedback),
    improvement_tips: asArray(result?.improvement_tips).filter(Boolean),
  };
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
  const rows = await base44.entities.TimeEntry.filter({ client_id: clientId });
  return sortByNewest(asArray(rows).map(mapTimeEntry).filter(Boolean));
}

/**
 * MEETINGS
 */
export async function getMeetings(clientId) {
  if (!clientId) return [];
  return await base44.entities.Meeting.filter({ client_id: clientId });
}
