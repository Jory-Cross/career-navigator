const BASE = '/api/time-entries'; // TODO: point to real backend or Base44 SDK proxy

export async function listTimeEntries(params = {}) {
  // Placeholder: returns empty list until backend is ready
  return [];
}

export async function createTimeEntry(payload) {
  // Placeholder: no-op
  console.log('createTimeEntry', payload);
  return { ok: true };
}

export async function deleteTimeEntry(id) {
  // Placeholder: no-op
  console.log('deleteTimeEntry', id);
  return { ok: true };
}

export async function startTimer(payload = {}) {
  console.log('startTimer', payload);
}

export async function stopTimer(id) {
  console.log('stopTimer', id);
}
