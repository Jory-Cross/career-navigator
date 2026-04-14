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
