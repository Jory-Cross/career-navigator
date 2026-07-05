import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

const STAFF_ROLE_ACCESS: Record<string, string> = {
  admin: "admin",
  management: "staff",
  employee: "staff",
};

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function isActiveRecord(record: any) {
  return (
    record &&
    record.is_active !== false &&
    record.is_archived !== true
  );
}

function getCanonicalStaffProfile(user: any) {
  const role = normalizeText(user?.role).toLowerCase();
  const accessLevel = normalizeText(
    user?.access_level
  ).toLowerCase();

  if (STAFF_ROLE_ACCESS[role] !== accessLevel) {
    return null;
  }

  return {
    role,
    accessLevel,
  };
}

function resolveEntryOwnerId(
  entry: any,
  allowedEmployeeIds: Set<string>
) {
  const candidates = [
    entry?.employee_id,
    entry?.staff_id,
    entry?.user_id,
  ];

  for (const candidate of candidates) {
    const employeeId = normalizeText(candidate);

    if (employeeId && allowedEmployeeIds.has(employeeId)) {
      return employeeId;
    }
  }

  return "";
}

function failure(error: string, status = 400) {
  return Response.json(
    {
      ok: false,
      error,
    },
    { status }
  );
}

async function resolveCanonicalCaller(
  base44: any,
  authenticatedUserId: string
) {
  const caller = await base44.asServiceRole.entities.User.get(
    authenticatedUserId
  ).catch(() => null);

  if (!caller || !isActiveRecord(caller)) {
    throw new Error("Your account is unavailable or inactive.");
  }

  const callerId = normalizeText(caller?.id);
  const organizationId = normalizeText(caller?.org_id);
  const profile = getCanonicalStaffProfile(caller);

  if (!callerId || !organizationId || !profile) {
    throw new Error(
      "You are not authorized to view staff Time Entries."
    );
  }

  const organization =
    await base44.asServiceRole.entities.Organization.get(
      organizationId
    ).catch(() => null);

  if (!organization || !isActiveRecord(organization)) {
    throw new Error(
      "Your organization assignment is unavailable or inactive."
    );
  }

  return {
    callerId,
    callerRole: profile.role,
    organizationId,
  };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return failure(
      "This TimeEntry request must use POST.",
      405
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = normalizeText(body?.action).toLowerCase();

    if (action !== "list") {
      return failure("Choose a TimeEntry action.");
    }

    const base44 = createClientFromRequest(req);
    const authenticatedUser = await base44.auth.me().catch(
      () => null
    );

    if (!authenticatedUser?.id) {
      return failure(
        "Please sign in before viewing Time Entries.",
        401
      );
    }

    const {
      callerId,
      callerRole,
      organizationId,
    } = await resolveCanonicalCaller(
      base44,
      authenticatedUser.id
    );

    const organizationUsers =
      await base44.asServiceRole.entities.User.filter({
        org_id: organizationId,
      });

    const activeStaffById = new Map(
      asArray(organizationUsers)
        .filter((user: any) => isActiveRecord(user))
        .map((user: any) => {
          const profile = getCanonicalStaffProfile(user);

          return profile
            ? [
                normalizeText(user?.id),
                {
                  user,
                  profile,
                },
              ]
            : null;
        })
        .filter(Boolean) as Array<
          [
            string,
            {
              user: any;
              profile: {
                role: string;
                accessLevel: string;
              };
            }
          ]
        >
    );

    if (!activeStaffById.has(callerId)) {
      return failure(
        "Your account is not validly scoped to this organization.",
        403
      );
    }

    const allowedEmployeeIds = new Set<string>([callerId]);

    if (callerRole === "admin") {
      for (const employeeId of activeStaffById.keys()) {
        allowedEmployeeIds.add(employeeId);
      }
    }

    if (callerRole === "management") {
      const assignmentRows =
        await base44.asServiceRole.entities.ManagerEmployeeAssignment.filter(
          {
            org_id: organizationId,
            manager_user_id: callerId,
            is_active: true,
          }
        );

      for (const assignment of asArray(assignmentRows)) {
        const employeeId = normalizeText(
          assignment?.employee_user_id
        );

        if (
          assignment?.is_active === true &&
          assignment?.is_archived !== true &&
          normalizeText(assignment?.org_id) === organizationId &&
          normalizeText(assignment?.manager_user_id) === callerId &&
          activeStaffById.has(employeeId)
        ) {
          allowedEmployeeIds.add(employeeId);
        }
      }
    }

    const [organizationClients, timeEntryRows] = await Promise.all([
      base44.asServiceRole.entities.Client.filter({
        org_id: organizationId,
      }),
      base44.asServiceRole.entities.TimeEntry.filter(
        {
          org_id: organizationId,
        },
        "-created_date"
      ),
    ]);

    const organizationClientIds = new Set(
      asArray(organizationClients)
        .filter(
          (client: any) =>
            normalizeText(client?.org_id) === organizationId
        )
        .map((client: any) => normalizeText(client?.id))
        .filter(Boolean)
    );

    const entries = asArray(timeEntryRows).filter(
      (entry: any) => {
        if (
          normalizeText(entry?.org_id) !== organizationId ||
          entry?.is_archived === true
        ) {
          return false;
        }

        const clientId = normalizeText(entry?.client_id);

        if (clientId && !organizationClientIds.has(clientId)) {
          return false;
        }

        return Boolean(
          resolveEntryOwnerId(entry, allowedEmployeeIds)
        );
      }
    );

    return Response.json({
      ok: true,
      entries,
      entry_count: entries.length,
      visible_employee_ids: Array.from(allowedEmployeeIds),
    });
  } catch (error) {
    console.error(
      "[getAuthorizedTimeEntries] Unexpected error:",
      error instanceof Error ? error.message : error
    );

    return failure(
      error instanceof Error &&
        error.message &&
        !error.message.includes("Unexpected")
        ? error.message
        : "Time Entries could not be loaded. Please try again or contact your organization administrator.",
      500
    );
  }
});