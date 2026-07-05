import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

const PLATFORM_OWNER_ROLE = "platform_owner";
const SAMPLE_LIMIT = 50;

class RequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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

async function requirePlatformOwner(base44: any, authenticatedUserId: string) {
  const caller = await base44.asServiceRole.entities.User.get(
    authenticatedUserId
  ).catch(() => null);

  if (
    !caller ||
    !isActive(caller) ||
    normalizeText(caller?.role).toLowerCase() !== "admin" ||
    normalizeText(caller?.access_level).toLowerCase() !== "admin"
  ) {
    throw new RequestError(
      403,
      "Canonical Platform Owner access is required to review legacy TimeEntry ownership."
    );
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
    throw new RequestError(
      403,
      "Canonical Platform Owner access is required to review legacy TimeEntry ownership."
    );
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
        { ok: false, error: "Please sign in before reviewing legacy TimeEntry ownership." },
        { status: 401 }
      );
    }

    await requirePlatformOwner(base44, authenticatedUser.id);

    const [users, entries] = await Promise.all([
      base44.asServiceRole.entities.User.list("-created_date"),
      base44.asServiceRole.entities.TimeEntry.list("-created_date"),
    ]);

    const activeStaffByOrgAndId = new Map<string, any>();
    for (const user of asArray(users)) {
      const userId = normalizeText(user?.id);
      const organizationId = normalizeText(user?.org_id);

      if (!isActive(user) || !isCanonicalStaffUser(user) || !userId || !organizationId) {
        continue;
      }

      activeStaffByOrgAndId.set(`${organizationId}::${userId}`, user);
    }

    const summary = {
      entries_reviewed: 0,
      canonical_employee_id: 0,
      safe_legacy_owner_id_candidate: 0,
      conflicting_or_ambiguous_legacy_owner_fields: 0,
      invalid_or_missing_owner: 0,
    };
    const samples = {
      safe_legacy_owner_id_candidate: [] as any[],
      conflicting_or_ambiguous_legacy_owner_fields: [] as any[],
      invalid_or_missing_owner: [] as any[],
    };

    for (const entry of asArray(entries)) {
      if (!isActive(entry)) continue;

      const entryId = normalizeText(entry?.id);
      const organizationId = normalizeText(entry?.org_id);
      if (!entryId || !organizationId) {
        summary.invalid_or_missing_owner += 1;
        pushSample(samples.invalid_or_missing_owner, {
          time_entry_id: entryId || null,
          org_id: organizationId || null,
          employee_id: normalizeText(entry?.employee_id) || null,
          staff_id: normalizeText(entry?.staff_id) || null,
          user_id: normalizeText(entry?.user_id) || null,
        });
        continue;
      }

      summary.entries_reviewed += 1;

      const employeeId = normalizeText(entry?.employee_id);
      const staffId = normalizeText(entry?.staff_id);
      const userId = normalizeText(entry?.user_id);
      const canonicalEmployee = employeeId
        ? activeStaffByOrgAndId.get(`${organizationId}::${employeeId}`)
        : null;

      if (canonicalEmployee) {
        summary.canonical_employee_id += 1;
        continue;
      }

      const legacyOwnerIds = Array.from(new Set([staffId, userId].filter(Boolean)));
      const candidateUsers = legacyOwnerIds
        .map((legacyId) => activeStaffByOrgAndId.get(`${organizationId}::${legacyId}`))
        .filter(Boolean);
      const uniqueCandidateIds = Array.from(
        new Set(candidateUsers.map((user) => normalizeText(user?.id)).filter(Boolean))
      );
      const baseSample = {
        time_entry_id: entryId,
        org_id: organizationId,
        employee_id: employeeId || null,
        staff_id: staffId || null,
        user_id: userId || null,
      };

      if (!employeeId && legacyOwnerIds.length === 1 && uniqueCandidateIds.length === 1) {
        summary.safe_legacy_owner_id_candidate += 1;
        pushSample(samples.safe_legacy_owner_id_candidate, {
          ...baseSample,
          proposed_employee_id: uniqueCandidateIds[0],
        });
        continue;
      }

      if (employeeId || legacyOwnerIds.length > 1 || uniqueCandidateIds.length > 1) {
        summary.conflicting_or_ambiguous_legacy_owner_fields += 1;
        pushSample(samples.conflicting_or_ambiguous_legacy_owner_fields, {
          ...baseSample,
          matching_active_staff_ids: uniqueCandidateIds,
        });
        continue;
      }

      summary.invalid_or_missing_owner += 1;
      pushSample(samples.invalid_or_missing_owner, baseSample);
    }

    return Response.json({
      ok: true,
      preview_only: true,
      generated_at: new Date().toISOString(),
      summary,
      samples,
      instructions:
        "This audit does not change Time Entries, authorization balances, Time Cards, or user records. Only one-safe-candidate rows may be considered in a separately reviewed normalization plan.",
    });
  } catch (error: any) {
    if (!(error instanceof RequestError)) {
      console.error(
        "auditLegacyTimeEntryOwnerFields error:",
        error?.message || error
      );
    }

    return Response.json(
      {
        ok: false,
        error:
          error instanceof RequestError
            ? error.message
            : "Unable to review legacy TimeEntry ownership.",
      },
      { status: error instanceof RequestError ? error.status : 500 }
    );
  }
});
