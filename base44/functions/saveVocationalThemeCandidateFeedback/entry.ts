import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

const STAFF_VALIDATION_VALUES = new Set([
  "supported",
  "needs_more_discovery",
  "not_relevant",
]);

const EVIDENCE_QUALITY_VALUES = new Set([
  "sufficient_evidence",
  "more_evidence_needed",
  "weak_evidence_base",
]);

const FUTURE_DISCOVERY_VALUES = new Set(["yes", "no"]);

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

function normalizeThemeName(value: unknown) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizeEmail(value: unknown) {
  return normalizeText(value).toLowerCase();
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

  if (
    role === "employee" ||
    accessLevel === "staff"
  ) {
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

function validateOptionalEnum(
  value: unknown,
  allowedValues: Set<string>,
  label: string
) {
  const normalizedValue = normalizeText(value);

  if (!normalizedValue) {
    return null;
  }

  if (!allowedValues.has(normalizedValue)) {
    throw new RequestError(
      400,
      `${label} contains an unsupported value.`
    );
  }

  return normalizedValue;
}

function validateLength(
  value: string,
  label: string,
  maximumLength: number
) {
  if (value.length > maximumLength) {
    throw new RequestError(
      400,
      `${label} must be ${maximumLength} characters or fewer.`
    );
  }
}

function sortMostRecent(records: any[]) {
  return [...records].sort((left, right) => {
    const leftDate =
      normalizeText(left?.updated_date) ||
      normalizeText(left?.created_date) ||
      normalizeText(left?.created_at);

    const rightDate =
      normalizeText(right?.updated_date) ||
      normalizeText(right?.created_date) ||
      normalizeText(right?.created_at);

    return rightDate.localeCompare(leftDate);
  });
}

function isExactFeedbackRecord(
  record: any,
  organizationId: string,
  clientId: string,
  reviewerUserId: string,
  normalizedThemeName: string
) {
  return (
    normalizeIdentifier(record?.org_id) === organizationId &&
    normalizeIdentifier(record?.client_id) === clientId &&
    normalizeIdentifier(record?.reviewer_user_id) === reviewerUserId &&
    normalizeThemeName(record?.candidate_theme_name) === normalizedThemeName
  );
}

async function resolveAuthorizedContext(
  base44: any,
  authenticatedUserId: string,
  clientId: string,
  cohortId: string
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
    cohort,
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
    cohortId
      ? base44.asServiceRole.entities.CETrainingCohort.get(cohortId)
          .catch(() => null)
      : Promise.resolve(null),
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

  if (cohortId) {
    if (
      !isUsableCohort(cohort) ||
      normalizeIdentifier(cohort?.org_id) !== organizationId
    ) {
      throw new RequestError(
        404,
        "The selected cohort is not available in your organization."
      );
    }
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

  let cohortAccessAllowed = false;

  if (cohortId && cohort) {
    const cohortMemberships =
      await base44.asServiceRole.entities.CETrainingCohortMember.filter({
        cohort_id: cohortId,
        is_active: true,
      });

    const activeCohortMemberships = asArray(
      cohortMemberships
    ).filter(
      (membership: any) =>
        membership?.is_active === true &&
        membership?.is_archived !== true &&
        organizationUserIds.has(
          normalizeIdentifier(membership?.user_id)
        )
    );

    const callerMembership = activeCohortMemberships.find(
      (membership: any) =>
        normalizeIdentifier(membership?.user_id) === callerId
    );

    const clientAssignedEmployeeId = normalizeIdentifier(
      client?.assigned_employee_id
    );

    if (callerMembership && clientAssignedEmployeeId) {
      const cohortRole = normalizeText(
        callerMembership?.cohort_role
      ).toLowerCase();

      if (cohortRole === "manager") {
        const cohortParticipantIds = new Set(
          activeCohortMemberships
            .map((membership: any) =>
              normalizeIdentifier(membership?.user_id)
            )
            .filter(Boolean)
        );

        cohortAccessAllowed = cohortParticipantIds.has(
          clientAssignedEmployeeId
        );
      }

      if (cohortRole === "member") {
        cohortAccessAllowed =
          clientAssignedEmployeeId === callerId;
      }
    }
  }

  if (!platformAccessAllowed && !cohortAccessAllowed) {
    throw new RequestError(
      403,
      "You are not authorized to provide feedback for this client."
    );
  }

  return {
    canonicalUser,
    client,
    organizationId,
    callerId,
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
          error: "Please sign in before saving feedback.",
        },
        { status: 401 }
      );
    }

    const requestBody = await req.json().catch(() => ({}));

    const clientId = normalizeIdentifier(requestBody?.client_id);
    const candidateThemeName = normalizeText(
      requestBody?.candidate_theme_name
    );

    const categoryLabel = normalizeText(
      requestBody?.category_label
    );

    const cohortId = normalizeIdentifier(requestBody?.cohort_id);

    const notes = normalizeText(requestBody?.notes);

    const staffValidation = validateOptionalEnum(
      requestBody?.staff_validation,
      STAFF_VALIDATION_VALUES,
      "Staff validation"
    );

    const evidenceQuality = validateOptionalEnum(
      requestBody?.evidence_quality,
      EVIDENCE_QUALITY_VALUES,
      "Evidence quality"
    );

    const useForFutureDiscovery = validateOptionalEnum(
      requestBody?.use_for_future_discovery,
      FUTURE_DISCOVERY_VALUES,
      "Future discovery selection"
    );

    if (!clientId || !candidateThemeName || !categoryLabel) {
      throw new RequestError(
        400,
        "Client, candidate theme, and category are required."
      );
    }

    validateLength(candidateThemeName, "Candidate theme", 300);
    validateLength(categoryLabel, "Category", 300);
    validateLength(notes, "Notes", 10000);

    if (
      !staffValidation &&
      !evidenceQuality &&
      !useForFutureDiscovery &&
      !notes
    ) {
      throw new RequestError(
        400,
        "Provide at least one feedback selection or note before saving."
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

    const {
      canonicalUser,
      organizationId,
      callerId,
    } = await resolveAuthorizedContext(
      base44,
      authenticatedUser.id,
      clientId,
      cohortId
    );

    const feedbackKey =
      `${clientId}::${normalizedThemeName}::${callerId}`;

    const feedbackData = {
      org_id: organizationId,
      feedback_key: feedbackKey,
      client_id: clientId,
      candidate_theme_name: candidateThemeName,
      category_label: categoryLabel,
      reviewer_user_id: callerId,
      reviewer_role:
        normalizeText(canonicalUser?.role) || "user",
      cohort_id: cohortId || null,
      staff_validation: staffValidation,
      evidence_quality: evidenceQuality,
      use_for_future_discovery: useForFutureDiscovery,
      notes: notes || null,
      is_active: true,
      feedback_date: new Date().toISOString().slice(0, 10),
    };

    let existingRecords =
      await base44.asServiceRole.entities.VocationalThemeCandidateFeedback.filter(
        {
          feedback_key: feedbackKey,
          is_active: true,
        }
      );

    existingRecords = asArray(existingRecords);

    const invalidExistingRecords = existingRecords.filter(
      (record: any) =>
        !isExactFeedbackRecord(
          record,
          organizationId,
          clientId,
          callerId,
          normalizedThemeName
        )
    );

    if (invalidExistingRecords.length > 0) {
      throw new RequestError(
        409,
        "An existing feedback record has an invalid ownership scope and must be repaired before this feedback can be saved."
      );
    }

    const sortedExistingRecords = sortMostRecent(existingRecords);

    let feedback: any = null;
    let wasCreated = false;

    if (sortedExistingRecords.length > 0) {
      feedback =
        await base44.asServiceRole.entities.VocationalThemeCandidateFeedback.update(
          sortedExistingRecords[0].id,
          feedbackData
        );

      for (const duplicateRecord of sortedExistingRecords.slice(1)) {
        try {
          await base44.asServiceRole.entities.VocationalThemeCandidateFeedback.update(
            duplicateRecord.id,
            {
              is_active: false,
            }
          );
        } catch (duplicateError) {
          console.error(
            "[saveVocationalThemeCandidateFeedback] Duplicate cleanup failed:",
            duplicateError
          );
        }
      }
    } else {
      try {
        feedback =
          await base44.asServiceRole.entities.VocationalThemeCandidateFeedback.create(
            feedbackData
          );

        wasCreated = true;
      } catch (createError) {
        const retryRecords =
          await base44.asServiceRole.entities.VocationalThemeCandidateFeedback.filter(
            {
              feedback_key: feedbackKey,
              is_active: true,
            }
          );

        const validRetryRecords = asArray(retryRecords).filter(
          (record: any) =>
            isExactFeedbackRecord(
              record,
              organizationId,
              clientId,
              callerId,
              normalizedThemeName
            )
        );

        if (validRetryRecords.length === 0) {
          throw createError;
        }

        const retryPrimary = sortMostRecent(validRetryRecords)[0];

        feedback =
          await base44.asServiceRole.entities.VocationalThemeCandidateFeedback.update(
            retryPrimary.id,
            feedbackData
          );

        wasCreated = false;
      }
    }

    if (!feedback?.id) {
      throw new Error("Feedback save did not return a record.");
    }

    return Response.json({
      ok: true,
      feedback_id: feedback.id,
      feedback_key: feedbackKey,
      message: wasCreated
        ? "Feedback created."
        : "Feedback updated.",
    });
  } catch (error: any) {
    const status =
      error instanceof RequestError ? error.status : 500;

    const message =
      error instanceof RequestError
        ? error.message
        : "Feedback could not be saved.";

    if (!(error instanceof RequestError)) {
      console.error(
        "[saveVocationalThemeCandidateFeedback] Unexpected error:",
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
