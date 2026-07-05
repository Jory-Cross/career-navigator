import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

const PLATFORM_OWNER_ROLE = "platform_owner";
const SAMPLE_LIMIT = 50;

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value: unknown) {
  return normalizeText(value).toLowerCase();
}

function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function isActive(record: any) {
  return record?.is_active !== false && record?.is_archived !== true;
}

function isCanonicalStaffUser(user: any) {
  const role = normalizeText(user?.role).toLowerCase();
  const accessLevel = normalizeText(user?.access_level).toLowerCase();

  return (
    (role === "admin" && accessLevel === "admin") ||
    ((role === "management" || role === "employee") && accessLevel === "staff")
  );
}

function pushSample(samples: any[], sample: any) {
  if (samples.length < SAMPLE_LIMIT) samples.push(sample);
}

async function requireCanonicalPlatformOwner(
  base44: any,
  authenticatedUserId: string
) {
  const caller = await base44.asServiceRole.entities.User.get(
    authenticatedUserId
  ).catch(() => null);

  if (!caller || !isActive(caller) || !isCanonicalStaffUser(caller)) {
    throw new Error("Canonical Platform Owner access is required to review legacy Pre-ETS staff assignments.");
  }

  const callerRole = normalizeText(caller?.role).toLowerCase();
  if (callerRole !== "admin") {
    throw new Error("Canonical Platform Owner access is required to review legacy Pre-ETS staff assignments.");
  }

  const platformAdminRows = await base44.asServiceRole.entities.PlatformAdmin.filter({
    user_id: caller.id,
  });
  const isPlatformOwner = asArray(platformAdminRows).some(
    (record: any) =>
      isActive(record) &&
      normalizeText(record?.user_id) === normalizeText(caller?.id) &&
      normalizeText(record?.platform_role).toLowerCase() === PLATFORM_OWNER_ROLE
  );

  if (!isPlatformOwner) {
    throw new Error("Canonical Platform Owner access is required to review legacy Pre-ETS staff assignments.");
  }
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json(
        { ok: false, error: "This route accepts POST requests only." },
        { status: 405 }
      );
    }

    await req.json().catch(() => ({}));

    const base44 = createClientFromRequest(req);
    const authenticatedUser = await base44.auth.me().catch(() => null);

    if (!authenticatedUser?.id) {
      return Response.json(
        { ok: false, error: "Please sign in before reviewing legacy Pre-ETS staff assignments." },
        { status: 401 }
      );
    }

    await requireCanonicalPlatformOwner(base44, authenticatedUser.id);

    const [users, clients] = await Promise.all([
      base44.asServiceRole.entities.User.list("-created_date"),
      base44.asServiceRole.entities.Client.list("-created_date"),
    ]);

    const activeStaffByOrgAndId = new Map<string, any>();
    const activeStaffByOrgAndEmail = new Map<string, any[]>();

    for (const user of asArray(users)) {
      const userId = normalizeText(user?.id);
      const organizationId = normalizeText(user?.org_id);
      const email = normalizeEmail(user?.email);

      if (!isActive(user) || !isCanonicalStaffUser(user) || !userId || !organizationId) {
        continue;
      }

      activeStaffByOrgAndId.set(`${organizationId}::${userId}`, user);

      if (email) {
        const emailKey = `${organizationId}::${email}`;
        const matches = activeStaffByOrgAndEmail.get(emailKey) || [];
        matches.push(user);
        activeStaffByOrgAndEmail.set(emailKey, matches);
      }
    }

    const summary = {
      pre_ets_clients_reviewed: 0,
      canonical_id_assignments: 0,
      legacy_email_assignments_with_one_safe_match: 0,
      ambiguous_legacy_email_assignments: 0,
      invalid_or_unassigned_values: 0,
    };
    const samples = {
      legacy_email_assignments_with_one_safe_match: [] as any[],
      ambiguous_legacy_email_assignments: [] as any[],
      invalid_or_unassigned_values: [] as any[],
    };

    for (const client of asArray(clients)) {
      const organizationId = normalizeText(client?.org_id);
      const clientId = normalizeText(client?.id);
      const clientType = normalizeText(client?.client_type).toLowerCase();

      if (!isActive(client) || clientType !== "pre_ets" || !organizationId || !clientId) {
        continue;
      }

      summary.pre_ets_clients_reviewed += 1;

      const assignmentValue = normalizeText(client?.assigned_employee_id);
      const canonicalMatch = assignmentValue
        ? activeStaffByOrgAndId.get(`${organizationId}::${assignmentValue}`)
        : null;

      if (canonicalMatch) {
        summary.canonical_id_assignments += 1;
        continue;
      }

      const emailMatches = assignmentValue
        ? activeStaffByOrgAndEmail.get(
            `${organizationId}::${assignmentValue.toLowerCase()}`
          ) || []
        : [];
      const baseSample = {
        client_id: clientId,
        org_id: organizationId,
        assigned_employee_value: assignmentValue || null,
      };

      if (emailMatches.length === 1) {
        summary.legacy_email_assignments_with_one_safe_match += 1;
        pushSample(samples.legacy_email_assignments_with_one_safe_match, {
          ...baseSample,
          proposed_assigned_employee_id: normalizeText(emailMatches[0]?.id),
        });
        continue;
      }

      if (emailMatches.length > 1) {
        summary.ambiguous_legacy_email_assignments += 1;
        pushSample(samples.ambiguous_legacy_email_assignments, {
          ...baseSample,
          matching_active_staff_ids: emailMatches
            .map((user) => normalizeText(user?.id))
            .filter(Boolean),
        });
        continue;
      }

      summary.invalid_or_unassigned_values += 1;
      pushSample(samples.invalid_or_unassigned_values, baseSample);
    }

    return Response.json({
      ok: true,
      preview_only: true,
      generated_at: new Date().toISOString(),
      summary,
      samples,
      instructions:
        "This audit does not change any client, user, time-entry, or Time Card record. Only the one-safe-match candidates are eligible for a future separately reviewed normalization plan.",
    });
  } catch (error: any) {
    console.error(
      "auditPreEtsLegacyStaffAssignments error:",
      error?.message || error
    );

    const message =
      typeof error?.message === "string" && error.message
        ? error.message
        : "Unable to review legacy Pre-ETS staff assignments.";

    return Response.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
});
