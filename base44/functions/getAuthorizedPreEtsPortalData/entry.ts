import { createClientFromRequest } from "npm:@base44/sdk@0.8.23";

const STAFF_ROLES = new Set(["admin", "management", "employee"]);

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function isActive(record: any) {
  return record?.is_active !== false && record?.is_archived !== true;
}

function isPreEtsClientInOrganization(client: any, organizationId: string) {
  return (
    isActive(client) &&
    normalizeText(client?.org_id) === organizationId &&
    normalizeText(client?.client_type).toLowerCase() === "pre_ets"
  );
}

function hasClientMembershipEvidence(
  client: any,
  userIds: Set<string>,
  userEmails: Set<string>
) {
  const candidates = [
    normalizeText(client?.assigned_employee_id),
    normalizeText(client?.created_by),
  ];

  return candidates.some(
    (value) => userIds.has(value) || userEmails.has(value)
  );
}

function getDescendantUserIds(rootUserId: string, organizationUsers: any[]) {
  const childrenByManagerId = new Map<string, string[]>();

  for (const user of organizationUsers) {
    const managerId = normalizeText(user?.manager_id);
    const userId = normalizeText(user?.id);

    if (!managerId || !userId) {
      continue;
    }

    const existing = childrenByManagerId.get(managerId) || [];
    existing.push(userId);
    childrenByManagerId.set(managerId, existing);
  }

  const descendantIds = new Set<string>();
  const queue = [rootUserId];

  while (queue.length > 0) {
    const currentUserId = queue.shift() || "";
    const directReportIds = childrenByManagerId.get(currentUserId) || [];

    for (const directReportId of directReportIds) {
      if (descendantIds.has(directReportId)) {
        continue;
      }

      descendantIds.add(directReportId);
      queue.push(directReportId);
    }
  }

  return descendantIds;
}

function projectClient(client: any) {
  return {
    id: normalizeText(client?.id),
    first_name: normalizeText(client?.first_name),
    last_name: normalizeText(client?.last_name),
    email: normalizeText(client?.email),
    status: normalizeText(client?.status) || "active",
    school: normalizeText(client?.school),
    graduation_year: normalizeText(client?.graduation_year),
    target_role: normalizeText(client?.target_role),
    industry: normalizeText(client?.industry),
    avatar_url: normalizeText(client?.avatar_url),
  };
}

function projectTask(task: any) {
  return {
    id: normalizeText(task?.id),
    title: normalizeText(task?.title),
    description: normalizeText(task?.description),
    status: normalizeText(task?.status) || "pending",
    priority: normalizeText(task?.priority) || "medium",
    due_date: normalizeText(task?.due_date),
    category: normalizeText(task?.category),
    checklist: asArray(task?.checklist).map((item: any) => ({
      text: normalizeText(item?.text),
      completed: item?.completed === true,
    })),
    client_completed_at: normalizeText(task?.client_completed_at),
    created_date: normalizeText(task?.created_date),
  };
}

function projectAssessment(assessment: any) {
  return {
    id: normalizeText(assessment?.id),
    assessment_type: normalizeText(assessment?.assessment_type),
    status: normalizeText(assessment?.status) || "completed",
    pdf_url: normalizeText(assessment?.pdf_url),
    created_date: normalizeText(assessment?.created_date),
  };
}

function projectWbleForm(form: any) {
  return {
    id: normalizeText(form?.id),
    status: normalizeText(form?.status) || "draft",
    employer_name: normalizeText(form?.employer_name),
    start_date: normalizeText(form?.start_date),
    end_date: normalizeText(form?.end_date),
    trainee_wages: normalizeText(form?.trainee_wages),
    pdf_url: normalizeText(form?.pdf_url),
    created_date: normalizeText(form?.created_date),
  };
}

function projectTrainingProgressReport(report: any) {
  return {
    id: normalizeText(report?.id),
    reporting_period_from: normalizeText(report?.reporting_period_from),
    reporting_period_to: normalizeText(report?.reporting_period_to),
    supervisor_name: normalizeText(report?.supervisor_name),
    supervisor_title: normalizeText(report?.supervisor_title),
    pdf_url: normalizeText(report?.pdf_url),
    created_date: normalizeText(report?.created_date),
  };
}

function projectDocument(document: any) {
  return {
    id: normalizeText(document?.id),
    title: normalizeText(document?.title),
    file_url: normalizeText(document?.file_url),
    file_name: normalizeText(document?.file_name),
    file_size: Number(document?.file_size) || 0,
    file_type: normalizeText(document?.file_type),
    category: normalizeText(document?.category) || "other",
    document_subtype: normalizeText(document?.document_subtype),
    created_date: normalizeText(document?.created_date),
  };
}

function projectMeeting(meeting: any) {
  return {
    id: normalizeText(meeting?.id),
    title: normalizeText(meeting?.title),
    meeting_type: normalizeText(meeting?.meeting_type),
    start_datetime: normalizeText(meeting?.start_datetime),
    end_datetime: normalizeText(meeting?.end_datetime),
    location: normalizeText(meeting?.location),
    status: normalizeText(meeting?.status) || "scheduled",
  };
}

function projectOnboardingStep(step: any, includeNotes: boolean) {
  const projected: Record<string, unknown> = {
    id: normalizeText(step?.id),
    step_name: normalizeText(step?.step_name),
    step_type: normalizeText(step?.step_type) || "custom",
    status: normalizeText(step?.status) || "pending",
    completed_date: normalizeText(step?.completed_date),
    order: Number(step?.order) || 0,
  };

  if (includeNotes) {
    projected.notes = normalizeText(step?.notes);
  }

  return projected;
}

function projectPreEtsTimeEntry(entry: any) {
  return {
    id: normalizeText(entry?.id),
    date: normalizeText(entry?.date),
    start_time: normalizeText(entry?.start_time),
    end_time: normalizeText(entry?.end_time),
    duration_minutes: Number(entry?.duration_minutes) || 0,
    description: normalizeText(entry?.description),
    source: normalizeText(entry?.source) || "client_portal",
    status: normalizeText(entry?.status) || "pending",
    created_date: normalizeText(entry?.created_date),
    updated_date: normalizeText(entry?.updated_date),
  };
}

function createEmptyPortalData() {
  return {
    tasks: [],
    assessments: [],
    wble_forms: [],
    progress_reports: [],
    documents: [],
    meetings: [],
    onboarding_steps: [],
    time_entries: [],
  };
}

async function loadAuthorizedClientData(
  base44: any,
  organizationId: string,
  clientId: string,
  portalMode: "student" | "staff" | "employer"
) {
  const emptyData = createEmptyPortalData();

  const [
    allTasks,
    assessments,
    wbleForms,
    progressReports,
    documents,
    meetings,
    onboardingSteps,
    timeEntries,
  ] = await Promise.all([
    base44.asServiceRole.entities.Task.list("-created_date"),
    base44.asServiceRole.entities.Assessment.filter(
      { client_id: clientId },
      "-created_date"
    ),
    base44.asServiceRole.entities.WBLEForm.filter(
      { client_id: clientId },
      "-created_date"
    ),
    base44.asServiceRole.entities.TrainingProgressReport.filter(
      { client_id: clientId },
      "-created_date"
    ),
    base44.asServiceRole.entities.Document.filter(
      { client_id: clientId },
      "-created_date"
    ),
    base44.asServiceRole.entities.Meeting.filter(
      { client_id: clientId },
      "-start_datetime"
    ),
    base44.asServiceRole.entities.OnboardingStep.filter(
      { client_id: clientId }
    ),
    base44.asServiceRole.entities.PreEtsClientTimeEntry.filter(
      { client_id: clientId },
      "-created_date"
    ),
  ]);

  const visibleTasks = asArray(allTasks)
    .filter(
      (task: any) =>
        isActive(task) &&
        normalizeText(task?.org_id) === organizationId &&
        asArray(task?.client_ids).includes(clientId) &&
        (portalMode !== "student" || task?.assigned_to_client === true)
    )
    .map(projectTask);

  const visibleAssessments = asArray(assessments)
    .filter(
      (assessment: any) =>
        isActive(assessment) &&
        normalizeText(assessment?.org_id) === organizationId
    )
    .map(projectAssessment);

  const visibleWbleForms = asArray(wbleForms)
    .filter(isActive)
    .map(projectWbleForm);

  const visibleProgressReports =
    portalMode === "student"
      ? []
      : asArray(progressReports)
          .filter(isActive)
          .map(projectTrainingProgressReport);

  const visibleDocuments =
    portalMode === "employer"
      ? []
      : asArray(documents)
          .filter((document: any) => {
            if (
              !isActive(document) ||
              normalizeText(document?.org_id) !== organizationId
            ) {
              return false;
            }

            if (portalMode === "student") {
              const visibility = normalizeText(document?.visibility).toLowerCase();

              return visibility === "client" || visibility === "both";
            }

            return true;
          })
          .map(projectDocument);

  const visibleMeetings =
    portalMode === "employer"
      ? []
      : asArray(meetings)
          .filter(
            (meeting: any) =>
              isActive(meeting) &&
              normalizeText(meeting?.org_id) === organizationId
          )
          .map(projectMeeting);

  const visibleOnboardingSteps =
    portalMode === "employer"
      ? []
      : asArray(onboardingSteps)
          .filter(isActive)
          .map((step: any) =>
            projectOnboardingStep(step, portalMode === "staff")
          );

  const visibleTimeEntries =
    portalMode === "employer"
      ? []
      : asArray(timeEntries)
          .filter(
            (entry: any) =>
              isActive(entry) &&
              normalizeText(entry?.org_id) === organizationId
          )
          .map(projectPreEtsTimeEntry);

  return {
    ...emptyData,
    tasks: portalMode === "employer" ? [] : visibleTasks,
    assessments: portalMode === "employer" ? [] : visibleAssessments,
    wble_forms: visibleWbleForms,
    progress_reports: visibleProgressReports,
    documents: visibleDocuments,
    meetings: visibleMeetings,
    onboarding_steps: visibleOnboardingSteps,
    time_entries: visibleTimeEntries,
  };
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json(
        { error: "Method not allowed." },
        { status: 405 }
      );
    }

    const base44 = createClientFromRequest(req);
    const authenticatedUser = await base44.auth.me();

    if (!authenticatedUser?.id) {
      return Response.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    const requestBody = await req.json().catch(() => ({}));
    const requestedClientId = normalizeText(requestBody?.client_id);

    const caller = await base44.asServiceRole.entities.User.get(
      authenticatedUser.id
    ).catch(() => null);

    if (!caller || !isActive(caller)) {
      return Response.json(
        {
          error:
            "Authenticated user record was not found or is inactive.",
        },
        { status: 403 }
      );
    }

    const callerId = normalizeText(caller.id);
    const callerRole = normalizeText(caller.role).toLowerCase();
    const callerAccessLevel = normalizeText(caller.access_level).toLowerCase();
    const organizationId = normalizeText(caller.org_id);

    if (!callerId || !organizationId) {
      return Response.json(
        {
          error:
            "Your account is not assigned to an organization.",
        },
        { status: 403 }
      );
    }

    const organization = await base44.asServiceRole.entities.Organization.get(
      organizationId
    ).catch(() => null);

    if (!organization || !isActive(organization)) {
      return Response.json(
        {
          error:
            "Your organization assignment is invalid or inactive.",
        },
        { status: 403 }
      );
    }

    const [organizationUsers, organizationClients] = await Promise.all([
      base44.asServiceRole.entities.User.filter({
        org_id: organizationId,
      }),
      base44.asServiceRole.entities.Client.filter(
        { org_id: organizationId },
        "-created_date"
      ),
    ]);

    const activeOrganizationUsers = asArray(organizationUsers).filter(
      (user: any) =>
        isActive(user) &&
        normalizeText(user?.org_id) === organizationId
    );

    const activeOrganizationUserIds = new Set(
      activeOrganizationUsers
        .map((user: any) => normalizeText(user?.id))
        .filter(Boolean)
    );

    if (!activeOrganizationUserIds.has(callerId)) {
      return Response.json(
        {
          error:
            "Your account is not validly scoped to this organization.",
        },
        { status: 403 }
      );
    }

    const preEtsClients = asArray(organizationClients).filter((client: any) =>
      isPreEtsClientInOrganization(client, organizationId)
    );

    let portalMode: "student" | "staff" | "employer";
    let visibleClients: any[] = [];
    let selectedClient: any = null;

    if (callerRole === "pre_ets") {
      if (callerAccessLevel !== "client_portal") {
        return Response.json(
          {
            error:
              "Your account does not have Pre-ETS student portal access.",
          },
          { status: 403 }
        );
      }

      const linkedClientId = normalizeText(caller.linked_client_id);

      selectedClient = preEtsClients.find(
        (client: any) => normalizeText(client?.id) === linkedClientId
      ) || null;

      if (!selectedClient) {
        return Response.json(
          {
            error:
              "Your Pre-ETS student record is unavailable or no longer active.",
          },
          { status: 403 }
        );
      }

      portalMode = "student";
      visibleClients = [selectedClient];
    } else if (STAFF_ROLES.has(callerRole)) {
      portalMode = "staff";

      if (callerRole === "admin") {
        visibleClients = preEtsClients;
      } else if (callerRole === "management") {
        const visibleUserIds = new Set<string>([
          callerId,
          ...getDescendantUserIds(callerId, activeOrganizationUsers),
        ]);

        const visibleUserEmails = new Set(
          activeOrganizationUsers
            .filter((user: any) =>
              visibleUserIds.has(normalizeText(user?.id))
            )
            .map((user: any) => normalizeText(user?.email))
            .filter(Boolean)
        );

        visibleClients = preEtsClients.filter((client: any) =>
          hasClientMembershipEvidence(
            client,
            visibleUserIds,
            visibleUserEmails
          )
        );
      } else {
        const ownUserIds = new Set([callerId]);
        const ownUserEmails = new Set(
          [normalizeText(caller.email)].filter(Boolean)
        );

        visibleClients = preEtsClients.filter((client: any) =>
          hasClientMembershipEvidence(
            client,
            ownUserIds,
            ownUserEmails
          )
        );
      }

      if (requestedClientId) {
        selectedClient = visibleClients.find(
          (client: any) => normalizeText(client?.id) === requestedClientId
        ) || null;

        if (!selectedClient) {
          return Response.json(
            { error: "Pre-ETS client not found." },
            { status: 404 }
          );
        }
      }
    } else if (callerRole === "pre_ets_employer") {
      if (callerAccessLevel !== "pre_ets_employer_portal") {
        return Response.json(
          {
            error:
              "Your account does not have Pre-ETS employer portal access.",
          },
          { status: 403 }
        );
      }

      portalMode = "employer";
      visibleClients = preEtsClients.filter(
        (client: any) =>
          normalizeText(client?.assigned_employer_id) === callerId
      );

      if (requestedClientId) {
        selectedClient = visibleClients.find(
          (client: any) => normalizeText(client?.id) === requestedClientId
        ) || null;

        if (!selectedClient) {
          return Response.json(
            { error: "Pre-ETS client not found." },
            { status: 404 }
          );
        }
      }
    } else {
      return Response.json(
        {
          error:
            "You are not authorized to access the Pre-ETS portal.",
        },
        { status: 403 }
      );
    }

    const portalData = selectedClient
      ? await loadAuthorizedClientData(
          base44,
          organizationId,
          normalizeText(selectedClient.id),
          portalMode
        )
      : createEmptyPortalData();

    return Response.json({
      ok: true,
      portal_mode: portalMode,
      clients: visibleClients.map(projectClient),
      selected_client: selectedClient
        ? projectClient(selectedClient)
        : null,
      ...portalData,
    });
  } catch (error: any) {
    console.error(
      "getAuthorizedPreEtsPortalData error:",
      error?.message || error
    );

    return Response.json(
      {
        error:
          "Unable to load authorized Pre-ETS portal data.",
      },
      { status: 500 }
    );
  }
});
