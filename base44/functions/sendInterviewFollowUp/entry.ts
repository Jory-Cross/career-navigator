import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

const INTERVIEW_STATUSES = new Map([
  ["phone_screen", "phone screen"],
  ["interview", "interview"],
  ["final_round", "final round interview"],
]);

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

function normalizeEmail(value: unknown) {
  return normalizeText(value).toLowerCase();
}

function limitText(value: unknown, maximumLength: number) {
  return normalizeText(value).slice(0, maximumLength);
}

function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function isActive(record: any) {
  return record?.is_active !== false && record?.is_archived !== true;
}

function isActiveManagerAssignment(record: any) {
  return (
    record?.is_active === true &&
    record?.is_archived !== true
  );
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isAuthorizedStaff(caller: any) {
  const role = normalizeText(caller?.role).toLowerCase();
  const accessLevel = normalizeText(
    caller?.access_level
  ).toLowerCase();

  return (
    role === "admin" ||
    accessLevel === "admin" ||
    role === "management" ||
    accessLevel === "management" ||
    role === "employee"
  );
}

function getStaffAuthority(caller: any) {
  const role = normalizeText(caller?.role).toLowerCase();
  const accessLevel = normalizeText(
    caller?.access_level
  ).toLowerCase();

  if (role === "admin" || accessLevel === "admin") {
    return "admin";
  }

  if (
    role === "management" ||
    accessLevel === "management"
  ) {
    return "management";
  }

  return "employee";
}

function getVisibleStaffIds(
  callerId: string,
  authority: string,
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
      const managerUserId = normalizeText(
        assignment?.manager_user_id
      );
      const employeeUserId = normalizeText(
        assignment?.employee_user_id
      );

      if (
        isActiveManagerAssignment(assignment) &&
        managerUserId === callerId &&
        organizationUserIds.has(employeeUserId)
      ) {
        visibleStaffIds.add(employeeUserId);
      }
    }
  }

  return visibleStaffIds;
}

function callerCanAccessClient(
  client: any,
  authority: string,
  visibleStaffIds: Set<string>,
  visibleStaffEmails: Set<string>
) {
  if (authority === "admin") {
    return true;
  }

  const ownershipEvidence = [
    normalizeText(client?.assigned_employee_id),
    normalizeText(client?.created_by),
  ];

  return ownershipEvidence.some(
    (value) =>
      visibleStaffIds.has(value) ||
      visibleStaffEmails.has(normalizeEmail(value))
  );
}

function buildEmailDraft(
  client: any,
  application: any,
  interviewType: string
) {
  return `Draft a professional, warm thank-you follow-up email after a job ${interviewType}.

Candidate: ${limitText(client?.first_name, 120)} ${limitText(
    client?.last_name,
    120
  )}
Position: ${limitText(application?.position, 300)}
Company: ${limitText(application?.company, 300)}
Contact Name: ${
    limitText(application?.contact_name, 300) ||
    "Hiring Manager"
  }

Write a concise, genuine thank-you email in three short paragraphs:
1. Express gratitude for the opportunity and mention the specific role.
2. Reinforce interest and briefly highlight one relevant strength.
3. State interest in next steps and staying in touch.

Requirements:
- Keep it under 150 words.
- Use professional, natural language.
- Do not use placeholders in brackets.
- Do not invent interview details, qualifications, promises, or outcomes.
- Return only the requested structured response.`;
}

async function resolveAuthorizedFollowUpContext(
  base44: any,
  authenticatedUserId: string,
  clientId: string,
  applicationId: string
) {
  const caller = await base44.asServiceRole.entities.User.get(
    authenticatedUserId
  ).catch(() => null);

  if (!caller || !isActive(caller)) {
    throw new RequestError(
      403,
      "Your staff account could not be verified as active."
    );
  }

  if (!isAuthorizedStaff(caller)) {
    throw new RequestError(
      403,
      "Only authorized staff may send an interview follow-up."
    );
  }

  const callerId = normalizeText(caller?.id);
  const organizationId = normalizeText(caller?.org_id);
  const authority = getStaffAuthority(caller);

  if (!callerId || !organizationId) {
    throw new RequestError(
      403,
      "Your staff account is missing its organization assignment."
    );
  }

  const [
    organization,
    client,
    application,
    organizationUsers,
    managerAssignments,
  ] = await Promise.all([
    base44.asServiceRole.entities.Organization.get(organizationId)
      .catch(() => null),
    base44.asServiceRole.entities.Client.get(clientId)
      .catch(() => null),
    base44.asServiceRole.entities.JobApplication.get(applicationId)
      .catch(() => null),
    base44.asServiceRole.entities.User.filter({
      org_id: organizationId,
    }),
    base44.asServiceRole.entities.ManagerEmployeeAssignment.filter({
      org_id: organizationId,
    }),
  ]);

  if (!organization || !isActive(organization)) {
    throw new RequestError(
      403,
      "Your organization assignment is invalid or inactive."
    );
  }

  const activeOrganizationUsers = asArray(organizationUsers).filter(
    (user: any) =>
      isActive(user) &&
      normalizeText(user?.org_id) === organizationId
  );

  const organizationUserIds = new Set(
    activeOrganizationUsers
      .map((user: any) => normalizeText(user?.id))
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
    !isActive(client) ||
    normalizeText(client?.org_id) !== organizationId
  ) {
    throw new RequestError(
      404,
      "The selected client is not available in your organization."
    );
  }

  if (
    !application ||
    !isActive(application) ||
    normalizeText(application?.client_id) !== clientId ||
    normalizeText(application?.org_id) !== organizationId
  ) {
    throw new RequestError(
      404,
      "The selected job application is not available in your organization."
    );
  }

  const visibleStaffIds = getVisibleStaffIds(
    callerId,
    authority,
    organizationUserIds,
    asArray(managerAssignments).filter(
      (assignment: any) =>
        normalizeText(assignment?.org_id) === organizationId
    )
  );

  const visibleStaffEmails = new Set(
    activeOrganizationUsers
      .filter((user: any) =>
        visibleStaffIds.has(normalizeText(user?.id))
      )
      .map((user: any) => normalizeEmail(user?.email))
      .filter(Boolean)
  );

  if (
    !callerCanAccessClient(
      client,
      authority,
      visibleStaffIds,
      visibleStaffEmails
    )
  ) {
    throw new RequestError(
      403,
      "You are not authorized to send a follow-up for this client."
    );
  }

  return {
    caller,
    client,
    application,
    organizationId,
  };
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json(
        {
          success: false,
          error: "Method not allowed.",
        },
        { status: 405 }
      );
    }

    const base44 = createClientFromRequest(req);
    const authenticatedUser = await base44.auth.me();

    if (!authenticatedUser?.id) {
      return Response.json(
        {
          success: false,
          error: "Please sign in before sending a follow-up.",
        },
        { status: 401 }
      );
    }

    const requestBody = await req.json().catch(() => ({}));

    const applicationId = normalizeText(
      requestBody?.applicationId || requestBody?.application_id
    );

    const clientId = normalizeText(
      requestBody?.clientId || requestBody?.client_id
    );

    if (!applicationId || !clientId) {
      throw new RequestError(
        400,
        "Choose both a client and job application before sending a follow-up."
      );
    }

    const {
      caller,
      client,
      application,
      organizationId,
    } = await resolveAuthorizedFollowUpContext(
      base44,
      authenticatedUser.id,
      clientId,
      applicationId
    );

    const interviewType = INTERVIEW_STATUSES.get(
      normalizeText(application?.status)
    );

    if (!interviewType) {
      throw new RequestError(
        409,
        "A follow-up email can only be sent for a phone screen, interview, or final-round interview."
      );
    }

    if (application?.follow_up_enabled === false) {
      throw new RequestError(
        409,
        "Follow-up email is disabled for this job application."
      );
    }

    const generatedDraft =
      await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: buildEmailDraft(
          client,
          application,
          interviewType
        ),
        add_context_from_internet: false,
        response_json_schema: {
          type: "object",
          properties: {
            subject: {
              type: "string",
            },
            body: {
              type: "string",
            },
          },
        },
      });

    const subject = limitText(generatedDraft?.subject, 180);
    const body = limitText(generatedDraft?.body, 6000);

    if (!subject || !body) {
      throw new Error(
        "The follow-up draft could not be generated."
      );
    }

    const contactEmail = normalizeEmail(
      application?.contact_email
    );

    const today = new Date().toISOString().slice(0, 10);

    if (!contactEmail || !isValidEmail(contactEmail)) {
      const task = await base44.asServiceRole.entities.Task.create({
        org_id: organizationId,
        client_ids: [clientId],
        title: `Send follow-up email: ${limitText(
          application?.position,
          300
        )} at ${limitText(application?.company, 300)}`,
        description: `DRAFT SUBJECT: ${subject}\n\nDRAFT BODY:\n${body}`,
        category: "follow_up",
        priority: "high",
        due_date: today,
        status: "pending",
        assigned_to_client: false,
        assigned_by:
          normalizeText(caller?.id) ||
          normalizeEmail(caller?.email),
      });

      await base44.asServiceRole.entities.Activity.create({
        org_id: organizationId,
        client_id: clientId,
        activity_type: "task_created",
        title: "Interview follow-up draft created",
        description:
          "An authorized staff member created a follow-up task because the job application has no valid contact email.",
        metadata: {
          related_entity_id: normalizeText(task?.id),
          related_entity_type: "Task",
        },
      });

      return Response.json({
        success: true,
        sent: false,
        reason:
          "No valid contact email is stored for this job application. A draft task was created.",
        task_id: normalizeText(task?.id),
        subject,
        body,
      });
    }

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: contactEmail,
      subject,
      body,
      from_name: `${limitText(
        client?.first_name,
        120
      )} ${limitText(client?.last_name, 120)}`.trim(),
    });

    const currentFollowUpCount = Number(
      application?.follow_up_count
    );

    await base44.asServiceRole.entities.JobApplication.update(
      applicationId,
      {
        last_follow_up_date: today,
        follow_up_count: Number.isFinite(currentFollowUpCount)
          ? Math.max(0, currentFollowUpCount) + 1
          : 1,
      }
    );

    await base44.asServiceRole.entities.Activity.create({
      org_id: organizationId,
      client_id: clientId,
      activity_type: "email_sent",
      title: `Interview follow-up email sent: ${limitText(
        application?.position,
        300
      )} at ${limitText(application?.company, 300)}`,
      description:
        "An authorized staff member sent an interview follow-up email from the secured workflow.",
      metadata: {
        related_entity_id: applicationId,
        related_entity_type: "JobApplication",
      },
    });

    return Response.json({
      success: true,
      sent: true,
      subject,
      body,
    });
  } catch (error: any) {
    const status =
      error instanceof RequestError ? error.status : 500;

    const message =
      error instanceof RequestError
        ? error.message
        : "The interview follow-up could not be completed.";

    if (!(error instanceof RequestError)) {
      console.error(
        "[sendInterviewFollowUp] Unexpected error:",
        error?.message || error
      );
    }

    return Response.json(
      {
        success: false,
        error: message,
      },
      { status }
    );
  }
});
