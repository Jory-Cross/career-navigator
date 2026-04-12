import { base44 } from "@/api/base44Client";

/**
 * 🔹 AUTH
 */
export const getCurrentUser = async () => {
  return await base44.auth.me();
};

/**
 * 🔹 CLIENT
 */
export const getClientById = async (id) => {
  return await base44.entities.Client.get(id);
};

export const getClientByEmail = async (email) => {
  const clients = await base44.entities.Client.list();
  return clients.find((c) => c.email === email) || null;
};

/**
 * 🔹 APPLICATIONS
 */
export const getApplications = async (clientId) => {
  return await base44.entities.JobApplication.filter({
    client_id: clientId,
  });
};

export const createApplication = async (payload) => {
  return await base44.entities.JobApplication.create(payload);
};

export const updateApplication = async (id, payload) => {
  return await base44.entities.JobApplication.update(id, payload);
};

/**
 * 🔹 TASKS
 */
export const getTasks = async (clientId) => {
  try {
    return await base44.entities.Task.filter({
      client_ids: clientId,
    });
  } catch {
    // fallback (Base44 inconsistency fix)
    const all = await base44.entities.Task.list();
    return all.filter((t) => t.client_ids?.includes(clientId));
  }
};

export const createTask = async (payload) => {
  return await base44.entities.Task.create(payload);
};

export const updateTask = async (id, payload) => {
  return await base44.entities.Task.update(id, payload);
};

export const deleteTask = async (id) => {
  return await base44.entities.Task.delete(id);
};

/**
 * 🔹 DOCUMENTS
 */
export const getDocuments = async (clientId) => {
  return await base44.entities.Document.filter({
    client_id: clientId,
  });
};

export const createDocument = async (payload) => {
  return await base44.entities.Document.create(payload);
};

/**
 * 🔹 FILE UPLOAD
 */
export const uploadFile = async (file) => {
  const res = await base44.integrations.Core.UploadFile({ file });
  return res.file_url;
};

/**
 * 🔹 ACTIVITY
 */
export const getActivities = async (clientId) => {
  return await base44.entities.Activity.filter({
    client_id: clientId,
  });
};

export const createActivity = async (payload) => {
  return await base44.entities.Activity.create(payload);
};

/**
 * 🔹 OPTIONAL (future-ready)
 * Add more here as needed:
 * - assessments
 * - meetings
 * - time entries
 * - interviews
 */
