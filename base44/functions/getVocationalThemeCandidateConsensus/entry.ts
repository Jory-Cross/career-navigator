import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

class RequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeIdentifier(value: unknown) {
  return normalizeText(value);
}

function normalizeEmail(value: unknown) {
  return normalizeText(value).toLowerCase();
}

function normalizeThemeName(value: unknown) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function isActiveRecord(record: any) {
  return record?.is_active !== false && record?.is_archived !== true;
}

function isActiveClient(client: any) {
  return (
    client?.status === "active" &&
    client?.is_archived !== true
  );
}

function isUsableCohort(cohort: any) {
  return (
    cohort &&
    cohort?.status !== "archived" &&
    cohort?.is_archived !== true
  );
}

function getPlatformAuthority(user: any) {
  const role = normalizeText(user?.role).toLowerCase();
  const accessLevel = normalizeText(user?.access_level).toLowerCase();

  if (role === "admin" || accessLevel === "admin") {
    return "admin";
  }

  if (role === "management" || accessLevel === "management") {
    return "management";
  }

  if (role === "employee" || accessLevel === "staff") {
    return "employee";
  }

  return null;
}

function getVisibleStaffIds(
  callerId: string,
  authority: string | null,
  organizationUserIds: Set<string>,
  managerAssignments: any[]
) {
  const visibleStaffIds = new Set<string>([callerId]);

  if (authority === "admin") {
    for (const userId of organizationUserIds) {
      visibleStaffIds.add(userId);
    }

    return visibleStaffIds;
  }

  if (authority === "management") {
    for (const assignment of managerAssignments) {
      const managerUserId = normalizeIdentifier(
        assignment?.manager_user_id
      );

      const employeeUserId = normalizeIdentifier(
        assignment?.employee_user_id
      );

      if (
        assignment?.is_active === true &&
        assignment?.is_archived !== true &&
        managerUserId === callerId &&
        organizationUserIds.has(employeeUserId)
      ) {
        visibleStaffIds.add(employeeUserId);
      }
    }
  }

  return visibleStaffIds;
}

function clientMatchesVisibleStaff(
  client: any,
  visibleStaffIds: Set<string>,
  visibleStaffEmails: Set<string>
) {
  const ownershipValues = [
    normalizeIdentifier(client?.assigned_employee_id),
    normalizeIdentifier(client?.created_by),
  ];

  return ownershipValues.some((value) => {
    if (!value) return false;

    return (
      visibleStaffIds.has(value) ||
      visibleStaffEmails.has(normalizeEmail(value))
    );
  });
}

async function callerHasCohortAccess(
  base44: any,
  callerId: string,
  organizationId: string,
  organizationUserIds: Set<string>,
  client: any
) {
  const clientAssignedEmployeeId = normalizeIdentifier(
    client?.assigned_employee_id
  );

  if (!clientAssignedEmployeeId) {
    return false;
  }

  const callerMemberships =
    await base44.asServiceRole.entities.CETrainingCohortMember.filter({
      user_id: callerId,
      is_active: true,
    });

  const activeCallerMemberships = asArray(callerMemberships).filter(
    (membership: any) =>
      membership?.is_active === true &&
      membership?.is_archived !== true
  );

  for (const callerMembership of activeCallerMemberships) {
    const cohortId = normalizeIdentifier(callerMembership?.cohort_id);

    if (!cohortId) {
      continue;
    }

    const cohort =
      await base44.asServiceRole.entities.CETrainingCohort.get(
        cohortId
      ).catch(() => null);

    if (
      !isUsableCohort(cohort) ||
      normalizeIdentifier(cohort?.org_id) !== organizationId
    ) {
      continue;
    }

    const cohortRole = normalizeText(
      callerMembership?.cohort_role
    ).toLowerCase();

    if (
      cohortRole === "member" &&
      clientAssignedEmployeeId === callerId
    ) {
      return true;
    }

    if (cohortRole !== "manager") {
      continue;
    }

    const cohortMembers =
      await base44.asServiceRole.entities.CETrainingCohortMember.filter({
        cohort_id: cohortId,
        is_active: true,
      });

    const cohortParticipantIds = new Set(
      asArray(cohortMembers)
        .filter(
          (membership: any) =>
            membership?.is_active === true &&
            membership?.is_archived !== true &&
            organizationUserIds.has(
              normalizeIdentifier(membership?.user_id)
            )
        )
        .map((membership: any) =>
          normalizeIdentifier(membership?.user_id)
        )
        .filter(Boolean)
    );

    if (cohortParticipantIds.has(clientAssignedEmployeeId)) {
      return true;
    }
  }

  return false;
}

async function resolveAuthorizedClientContext(
  base44: any,
  authenticatedUserId: string,
  clientId: string
) {
  const canonicalUser = await base44.asServiceRole.entities.User.get(
    authenticatedUserId
  ).catch(() => null);

  if (!canonicalUser || !isActiveRecord(canonicalUser)) {
    throw new RequestError(
      403,
      "Your account could not be verified as active."
    );
  }

  const callerId = normalizeIdentifier(canonicalUser?.id);
  const organizationId = normalizeIdentifier(canonicalUser?.org_id);

  if (!callerId || !organizationId) {
    throw new RequestError(
      403,
      "Your account is missing its organization assignment."
    );
  }

  const [
    organization,
    client,
    organizationUsers,
    managerAssignments,
  ] = await Promise.all([
    base44.asServiceRole.entities.Organization.get(organizationId)
      .catch(() => null),
    base44.asServiceRole.entities.Client.get(clientId)
      .catch(() => null),
    base44.asServiceRole.entities.User.filter({
      org_id: organizationId,
    }),
    base44.asServiceRole.entities.ManagerEmployeeAssignment.filter({
      org_id: organizationId,
    }),
  ]);

  if (!organization || !isActiveRecord(organization)) {
    throw new RequestError(
      403,
      "Your organization assignment is invalid or inactive."
    );
  }

  const activeOrganizationUsers = asArray(organizationUsers).filter(
    (user: any) =>
      isActiveRecord(user) &&
      normalizeIdentifier(user?.org_id) === organizationId
  );

  const organizationUserIds = new Set(
    activeOrganizationUsers
      .map((user: any) => normalizeIdentifier(user?.id))
      .filter(Boolean)
  );

  if (!organizationUserIds.has(callerId)) {
    throw new RequestError(
      403,
      "Your account is not validly scoped to this organization."
    );
  }

  if (
    !client ||
    !isActiveClient(client) ||
    normalizeIdentifier(client?.org_id) !== organizationId
  ) {
    throw new RequestError(
      404,
      "The selected client is not available in your organization."
    );
  }

  const authority = getPlatformAuthority(canonicalUser);

  const visibleStaffIds = getVisibleStaffIds(
    callerId,
    authority,
    organizationUserIds,
    asArray(managerAssignments).filter(
      (assignment: any) =>
        normalizeIdentifier(assignment?.org_id) === organizationId
    )
  );

  const visibleStaffEmails = new Set(
    activeOrganizationUsers
      .filter((user: any) =>
        visibleStaffIds.has(normalizeIdentifier(user?.id))
      )
      .map((user: any) => normalizeEmail(user?.email))
      .filter(Boolean)
  );

  const platformAccessAllowed =
    authority === "admin" ||
    (authority !== null &&
      clientMatchesVisibleStaff(
        client,
        visibleStaffIds,
        visibleStaffEmails
      ));

  const cohortAccessAllowed = await callerHasCohortAccess(
    base44,
    callerId,
    organizationId,
    organizationUserIds,
    client
  );

  if (!platformAccessAllowed && !cohortAccessAllowed) {
    throw new RequestError(
      403,
      "You are not authorized to view consensus for this client."
    );
  }

  return {
    organizationId,
  };
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json(
        {
          ok: false,
          error: "Method not allowed.",
        },
        { status: 405 }
      );
    }

    const base44 = createClientFromRequest(req);
    const authenticatedUser = await base44.auth.me().catch(() => null);

    if (!authenticatedUser?.id) {
      return Response.json(
        {
          ok: false,
          error: "Please sign in before viewing consensus.",
        },
        { status: 401 }
      );
    }

    const requestBody = await req.json().catch(() => ({}));

    const clientId = normalizeIdentifier(
      requestBody?.client_id || requestBody?.clientId
    );

    const candidateThemeName = normalizeText(
      requestBody?.candidate_theme_name ||
        requestBody?.candidateThemeName
    );

    if (!clientId || !candidateThemeName) {
      throw new RequestError(
        400,
        "Client and candidate theme are required."
      );
    }

    if (candidateThemeName.length > 300) {
      throw new RequestError(
        400,
        "Candidate theme must be 300 characters or fewer."
      );
    }

    const normalizedThemeName = normalizeThemeName(
      candidateThemeName
    );

    if (!normalizedThemeName) {
      throw new RequestError(
        400,
        "Candidate theme is required."
      );
    }

    const { organizationId } =
      await resolveAuthorizedClientContext(
        base44,
        authenticatedUser.id,
        clientId
      );

    const allFeedback =
      await base44.asServiceRole.entities.VocationalThemeCandidateFeedback.filter(
        {
          org_id: organizationId,
          client_id: clientId,
          is_active: true,
        }
      );

    const candidateFeedback = asArray(allFeedback).filter(
      (feedback: any) =>
        normalizeIdentifier(feedback?.org_id) === organizationId &&
        normalizeIdentifier(feedback?.client_id) === clientId &&
        feedback?.is_active === true &&
        normalizeThemeName(feedback?.candidate_theme_name) ===
          normalizedThemeName
    );

    const stats = {
      supported: 0,
      needs_more_discovery: 0,
      not_relevant: 0,
      sufficient_evidence: 0,
      more_evidence_needed: 0,
      weak_evidence_base: 0,
      future_discovery_yes: 0,
      future_discovery_no: 0,
    };

    for (const feedback of candidateFeedback) {
      if (feedback?.staff_validation === "supported") {
        stats.supported++;
      } else if (
        feedback?.staff_validation === "needs_more_discovery"
      ) {
        stats.needs_more_discovery++;
      } else if (feedback?.staff_validation === "not_relevant") {
        stats.not_relevant++;
      }

      if (
        feedback?.evidence_quality === "sufficient_evidence"
      ) {
        stats.sufficient_evidence++;
      } else if (
        feedback?.evidence_quality === "more_evidence_needed"
      ) {
        stats.more_evidence_needed++;
      } else if (
        feedback?.evidence_quality === "weak_evidence_base"
      ) {
        stats.weak_evidence_base++;
      }

      if (feedback?.use_for_future_discovery === "yes") {
        stats.future_discovery_yes++;
      } else if (
        feedback?.use_for_future_discovery === "no"
      ) {
        stats.future_discovery_no++;
      }
    }

    const reviewerCount = candidateFeedback.length;

    const supportedPercent =
      reviewerCount > 0
        ? (stats.supported / reviewerCount) * 100
        : 0;

    const needsMorePercent =
      reviewerCount > 0
        ? (stats.needs_more_discovery / reviewerCount) * 100
        : 0;

    const notRelevantPercent =
      reviewerCount > 0
        ? (stats.not_relevant / reviewerCount) * 100
        : 0;

    let consensusStatus = "No Feedback";

    if (reviewerCount > 0) {
      consensusStatus = "Mixed Feedback";

      if (supportedPercent >= 75 && reviewerCount >= 2) {
        consensusStatus = "Strongly Supported";
      } else if (
        stats.supported > stats.not_relevant &&
        needsMorePercent < 50 &&
        supportedPercent > 0
      ) {
        consensusStatus = "Emerging Support";
      } else if (notRelevantPercent > 50) {
        consensusStatus = "Weak Support";
      } else if (needsMorePercent >= 50) {
        consensusStatus = "Needs More Discovery";
      }
    }

    return Response.json({
      ok: true,
      candidate_theme_name: candidateThemeName,
      consensus_status: consensusStatus,
      feedback_count: candidateFeedback.length,
      reviewer_count: reviewerCount,
      stats,
      percentages: {
        supported: Number(supportedPercent.toFixed(1)),
        needs_more_discovery: Number(
          needsMorePercent.toFixed(1)
        ),
        not_relevant: Number(notRelevantPercent.toFixed(1)),
      },
    });
  } catch (error: any) {
    const status =
      error instanceof RequestError ? error.status : 500;

    const message =
      error instanceof RequestError
        ? error.message
        : "Consensus could not be loaded.";

    if (!(error instanceof RequestError)) {
      console.error(
        "[getVocationalThemeCandidateConsensus] Unexpected error:",
        error?.message || error
      );
    }

    return Response.json(
      {
        ok: false,
        error: message,
      },
      { status }
    );
  }
});
