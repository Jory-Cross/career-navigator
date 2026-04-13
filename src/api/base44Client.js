import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

const {
  appId,
  token,
  functionsVersion,
  appBaseUrl,
} = appParams;

/**
 * Raw SDK client
 * Keep this private to this module as much as possible.
 */
const rawBase44 = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: '',
  requiresAuth: false,
  appBaseUrl,
});

/**
 * Minimal debug toggle.
 * Enable in browser console with:
 *   localStorage.setItem('debug:base44', 'true')
 * Disable with:
 *   localStorage.removeItem('debug:base44')
 */
function isDebugEnabled() {
  try {
    return typeof window !== 'undefined' && localStorage.getItem('debug:base44') === 'true';
  } catch {
    return false;
  }
}

function debugLog(...args) {
  if (!isDebugEnabled()) return;
  console.log('[base44Client]', ...args);
}

function normalizeError(error, context = {}) {
  const message =
    error?.message ||
    error?.response?.data?.message ||
    error?.data?.message ||
    'Unknown Base44 error';

  const normalized = new Error(message);
  normalized.name = 'Base44ClientError';
  normalized.cause = error;
  normalized.context = context;
  normalized.status =
    error?.status ||
    error?.response?.status ||
    error?.data?.status ||
    null;

  return normalized;
}

async function safeCall(label, fn, context = {}) {
  try {
    debugLog('start', label, context);
    const result = await fn();
    debugLog('success', label, context);
    return result;
  } catch (error) {
    const normalized = normalizeError(error, { label, ...context });
    console.error(`[base44Client] ${label} failed`, {
      context: normalized.context,
      status: normalized.status,
      message: normalized.message,
      cause: error,
    });
    throw normalized;
  }
}

/**
 * Auth wrapper
 */
const auth = {
  me: () => safeCall('auth.me', () => rawBase44.auth.me()),
};

/**
 * Entity wrapper factory
 * Gives us one place to standardize calls later.
 */
function makeEntityApi(entityName) {
  const entity = rawBase44.entities?.[entityName];

  if (!entity) {
    return {
      get: async () => {
        throw new Error(`Base44 entity "${entityName}" is not available`);
      },
      list: async () => {
        throw new Error(`Base44 entity "${entityName}" is not available`);
      },
      filter: async () => {
        throw new Error(`Base44 entity "${entityName}" is not available`);
      },
      create: async () => {
        throw new Error(`Base44 entity "${entityName}" is not available`);
      },
      update: async () => {
        throw new Error(`Base44 entity "${entityName}" is not available`);
      },
      delete: async () => {
        throw new Error(`Base44 entity "${entityName}" is not available`);
      },
    };
  }

  return {
    get: (id) =>
      safeCall(`${entityName}.get`, () => entity.get(id), { entityName, id }),

    list: (params) =>
      safeCall(`${entityName}.list`, () => entity.list(params), {
        entityName,
        params,
      }),

    filter: (filters) =>
      safeCall(`${entityName}.filter`, () => entity.filter(filters), {
        entityName,
        filters,
      }),

    create: (payload) =>
      safeCall(`${entityName}.create`, () => entity.create(payload), {
        entityName,
        payload,
      }),

    update: (id, payload) =>
      safeCall(`${entityName}.update`, () => entity.update(id, payload), {
        entityName,
        id,
        payload,
      }),

    delete: (id) =>
      safeCall(`${entityName}.delete`, () => entity.delete(id), {
        entityName,
        id,
      }),
  };
}

/**
 * Integrations wrapper
 */
const integrations = {
  Core: {
    UploadFile: (payload) =>
      safeCall('Core.UploadFile', () => rawBase44.integrations.Core.UploadFile(payload), {
        integration: 'Core',
        action: 'UploadFile',
      }),
  },
};

/**
 * Stable client interface for the app.
 * This is what new API modules should use.
 */
export const base44Client = {
  auth,
  entities: {
    Client: makeEntityApi('Client'),
    JobApplication: makeEntityApi('JobApplication'),
    Task: makeEntityApi('Task'),
    Document: makeEntityApi('Document'),
    Activity: makeEntityApi('Activity'),
    Assessment: makeEntityApi('Assessment'),
    InterviewSession: makeEntityApi('InterviewSession'),
    TimeEntry: makeEntityApi('TimeEntry'),
    Meeting: makeEntityApi('Meeting'),
  },
  integrations,
  raw: rawBase44,
};

/**
 * Backward-compatible export.
 * Leave this in place so old files do not break immediately.
 * New code should prefer base44Client.
 */
export const base44 = base44Client;

export default base44Client;
