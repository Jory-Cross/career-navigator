import { createClientFromRequest } from "npm:@base44/sdk@0.8.23";

const PLATFORM_OWNER_ROLE = "platform_owner";
const SAMPLE_LIMIT = 50;

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isActive(record: any) {
  return record?.is_active !== false && record?.is_archived !== true;
}

function getClientName(client: any) {
  return (
    `${normalizeText(client?.first_name)} ${normalizeText(
      client?.last_name
    )}`.trim() || "Unnamed client"
  );
}

function createSummary() {
  return {
    correctly_scoped: 0,
    unscoped_with_safe_client_scope: 0,
    mismatched_scope: 0,
    missing_or_unscoped_client: 0,
  };
}

function createSamples() {
  return {
    unscoped_with_safe_client_scope: [] as any[],
    mismatched_scope: [] as any[],
    missing_or_unscoped_client: [] as any[],
  };
}

function classifyPlan(
  plan: any,
  clientsById: Map<string, any>,
  validOrganizationIds: Set<string>,
  summary: ReturnType<typeof createSummary>,
  samples: ReturnType<typeof createSamples>
) {
  const planId = normalizeText(plan?.id);
  const clientId = normalizeText(plan?.client_id);
  const planOrganizationId = normalizeText(plan?.org_id);
  const client = clientsById.get(clientId) || null;
  const clientOrganizationId = normalizeText(client?.org_id);

  const sample = {
    id: planId || null,
    entity: "IEPPlan",
    client_id: clientId || null,
    client_name: client ? getClientName(client) : null,
    current_org_id: planOrganizationId || null,
    proposed_org_id: clientOrganizationId || null,
  };

  if (
    !client ||
    !clientOrganizationId ||
    !validOrganizationIds.has(clientOrganizationId)
  ) {
    summary.missing_or_unscoped_client += 1;
    if (samples.missing_or_unscoped_client.length < SAMPLE_LIMIT) {
      samples.missing_or_unscoped_client.push(sample);
    }
    return;
  }

  if (!planOrganizationId) {
    summary.unscoped_with_safe_client_scope += 1;
    if (samples.unscoped_with_safe_client_scope.length < SAMPLE_LIMIT) {
      samples.unscoped_with_safe_client_scope.push(sample);
    }
    return;
  }

  if (planOrganizationId !== clientOrganizationId) {
    summary.mismatched_scope += 1;
    if (samples.mismatched_scope.length < SAMPLE_LIMIT) {
      samples.mismatched_scope.push(sample);
    }
    return;
  }

  summary.correctly_scoped += 1;
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json(
        { error: "This route accepts POST requests only." },
        { status: 405 }
      );
    }

    await req.json().catch(() => ({}));

    const base44 = createClientFromRequest(req);
    const authenticatedUser = await base44.auth.me().catch(() => null);

    if (!authenticatedUser?.id) {
      return Response.json(
        { error: "You must be signed in to review IEP plan data scope." },
        { status: 401 }
      );
    }

    const caller = await base44.asServiceRole.entities.User.get(
      authenticatedUser.id
    ).catch(() => null);

    if (!caller || !isActive(caller)) {
      return Response.json(
        { error: "Your account is inactive or unavailable." },
        { status: 403 }
      );
    }

    const platformAdmins = await base44.asServiceRole.entities.PlatformAdmin.filter({
      user_id: caller.id,
    });
    const isPlatformOwner = platformAdmins.some(
      (record: any) =>
        isActive(record) &&
        normalizeText(record?.platform_role).toLowerCase() ===
          PLATFORM_OWNER_ROLE
    );

    if (!isPlatformOwner) {
      return Response.json(
        {
          error:
            "Platform Owner access is required to review IEP plan data scope.",
        },
        { status: 403 }
      );
    }

    const [organizations, clients, iepPlans] = await Promise.all([
      base44.asServiceRole.entities.Organization.list(),
      base44.asServiceRole.entities.Client.list("-created_date"),
      base44.asServiceRole.entities.IEPPlan.list("-created_date"),
    ]);

    const validOrganizationIds = new Set(
      organizations
        .filter((organization: any) => isActive(organization))
        .map((organization: any) => normalizeText(organization?.id))
        .filter(Boolean)
    );
    const clientsById = new Map(
      clients
        .filter((client: any) => normalizeText(client?.id))
        .map((client: any) => [normalizeText(client.id), client])
    );
    const summary = createSummary();
    const samples = createSamples();

    for (const plan of iepPlans) {
      classifyPlan(
        plan,
        clientsById,
        validOrganizationIds,
        summary,
        samples
      );
    }

    return Response.json({
      ok: true,
      preview_only: true,
      generated_at: new Date().toISOString(),
      instructions:
        "This audit does not change records. Review only the candidates whose proposed organization scope matches their active client.",
      records: {
        iep_plans: {
          total: iepPlans.length,
          ...summary,
          samples,
        },
      },
    });
  } catch (error: any) {
    console.error(
      "auditIepPlanOrganizationScope error:",
      error?.message || error
    );

    return Response.json(
      { error: "Unable to review IEP plan organization scope." },
      { status: 500 }
    );
  }
});