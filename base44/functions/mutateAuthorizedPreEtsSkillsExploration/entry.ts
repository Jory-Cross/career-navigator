import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

const SUPPORTED_ACTIONS = new Set([
  "get_student_skills_exploration",
  "generate_student_career_paths",
]);

const INTEREST_AREAS = {
  technology: "Technology & Computers",
  healthcare: "Healthcare & Helping Others",
  arts: "Arts, Music & Creativity",
  business: "Business & Office Work",
  construction: "Construction & Trades",
  food_service: "Food Service & Hospitality",
  retail: "Retail & Customer Service",
  education: "Education & Working with Kids",
  outdoors: "Outdoors & Environment",
  transportation: "Transportation & Logistics",
};

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

function limitText(value: unknown, maximumLength: number) {
  return normalizeText(value).slice(0, maximumLength);
}

function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function isActive(record: any) {
  return record?.is_active !== false && record?.is_archived !== true;
}

function isAuthorizedPreEtsStudent(user: any) {
  return (
    normalizeText(user?.role).toLowerCase() === "pre_ets" &&
    normalizeText(user?.access_level).toLowerCase() === "client_portal"
  );
}

function isPreEtsClientInOrganization(
  client: any,
  organizationId: string
) {
  return (
    isActive(client) &&
    normalizeText(client?.org_id) === organizationId &&
    normalizeText(client?.client_type).toLowerCase() === "pre_ets"
  );
}

function normalizeInterestIds(rawInterestIds: unknown) {
  const uniqueIds = Array.from(
    new Set(
      asArray<string>(rawInterestIds)
        .map((interestId) => normalizeText(interestId))
        .filter((interestId) =>
          Object.prototype.hasOwnProperty.call(
            INTEREST_AREAS,
            interestId
          )
        )
    )
  );

  if (uniqueIds.length === 0) {
    throw new RequestError(
      400,
      "Select at least one supported career interest area."
    );
  }

  if (uniqueIds.length > 10) {
    throw new RequestError(
      400,
      "Select no more than ten career interest areas."
    );
  }

  return uniqueIds;
}

function projectCareerPath(rawCareer: any) {
  return {
    title: limitText(rawCareer?.title, 160),
    why_its_a_fit: limitText(rawCareer?.why_its_a_fit, 1200),
    skills_developed: asArray(rawCareer?.skills_developed)
      .map((skill) => limitText(skill, 120))
      .filter(Boolean)
      .slice(0, 5),
    first_step: limitText(rawCareer?.first_step, 700),
  };
}

function normalizeCareerPaths(rawCareers: unknown) {
  const careers = asArray(rawCareers)
    .map(projectCareerPath)
    .filter(
      (career) =>
        career.title &&
        career.why_its_a_fit &&
        career.first_step
    )
    .slice(0, 4);

  if (careers.length === 0) {
    throw new RequestError(
      500,
      "Career suggestions could not be generated. Please try again."
    );
  }

  return careers;
}

function projectAssessmentSummary(assessment: any) {
  return {
    id: normalizeText(assessment?.id),
    assessment_type: normalizeText(assessment?.assessment_type),
    status: normalizeText(assessment?.status) || "completed",
    pdf_url: normalizeText(assessment?.pdf_url),
    created_date: normalizeText(assessment?.created_date),
  };
}

function projectCareerAssessment(assessment: any) {
  const responses = assessment?.responses || {};

  return {
    id: normalizeText(assessment?.id),
    created_date: normalizeText(assessment?.created_date),
    interests: asArray(responses?.interests)
      .map((interestId) => normalizeText(interestId))
      .filter((interestId) =>
        Object.prototype.hasOwnProperty.call(
          INTEREST_AREAS,
          interestId
        )
      ),
    suggestions: normalizeCareerPaths(responses?.suggestions),
  };
}

function isSavedSkillsExplorationAssessment(assessment: any) {
  if (
    normalizeText(assessment?.assessment_type) !== "career_goals"
  ) {
    return false;
  }

  const suggestions = asArray(assessment?.responses?.suggestions);

  return suggestions.length > 0;
}

async function resolveStudentContext(
  base44: any,
  authenticatedUserId: string
) {
  const caller = await base44.asServiceRole.entities.User.get(
    authenticatedUserId
  ).catch(() => null);

  if (!caller || !isActive(caller)) {
    throw new RequestError(
      403,
      "Your account could not be verified as active."
    );
  }

  if (!isAuthorizedPreEtsStudent(caller)) {
    throw new RequestError(
      403,
      "Only an authorized Pre-ETS student may use Skills Exploration."
    );
  }

  const organizationId = normalizeText(caller?.org_id);
  const clientId = normalizeText(caller?.linked_client_id);

  if (!organizationId || !clientId) {
    throw new RequestError(
      403,
      "Your Pre-ETS student account is missing its organization or student assignment."
    );
  }

  const [organization, client] = await Promise.all([
    base44.asServiceRole.entities.Organization.get(organizationId)
      .catch(() => null),
    base44.asServiceRole.entities.Client.get(clientId)
      .catch(() => null),
  ]);

  if (!organization || !isActive(organization)) {
    throw new RequestError(
      403,
      "Your organization assignment is invalid or inactive."
    );
  }

  if (!isPreEtsClientInOrganization(client, organizationId)) {
    throw new RequestError(
      403,
      "Your Pre-ETS student record is unavailable or is not assigned to your organization."
    );
  }

  return {
    organizationId,
    clientId,
    client,
  };
}

async function loadStudentSkillsExploration(
  base44: any,
  organizationId: string,
  clientId: string
) {
  const assessments =
    await base44.asServiceRole.entities.Assessment.filter(
      { client_id: clientId },
      "-created_date"
    );

  const safeAssessments = asArray(assessments).filter(
    (assessment: any) =>
      isActive(assessment) &&
      normalizeText(assessment?.org_id) === organizationId
  );

  const assessmentSummaries = safeAssessments.map(
    projectAssessmentSummary
  );

  const latestCareerAssessmentRecord = safeAssessments.find(
    isSavedSkillsExplorationAssessment
  );

  let latestCareerAssessment = null;

  if (latestCareerAssessmentRecord) {
    try {
      latestCareerAssessment = projectCareerAssessment(
        latestCareerAssessmentRecord
      );
    } catch {
      latestCareerAssessment = null;
    }
  }

  return {
    assessment_summaries: assessmentSummaries,
    latest_career_assessment: latestCareerAssessment,
  };
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json(
        {
          ok: false,
          error: "This request must use POST.",
        },
        { status: 405 }
      );
    }

    const base44 = createClientFromRequest(req);
    const authenticatedUser = await base44.auth.me();

    if (!authenticatedUser?.id) {
      return Response.json(
        {
          ok: false,
          error: "Please sign in before using Skills Exploration.",
        },
        { status: 401 }
      );
    }

    const requestBody = await req.json().catch(() => ({}));
    const action = normalizeText(requestBody?.action);

    if (!SUPPORTED_ACTIONS.has(action)) {
      throw new RequestError(
        400,
        'Choose either "get_student_skills_exploration" or "generate_student_career_paths".'
      );
    }

    const {
      organizationId,
      clientId,
      client,
    } = await resolveStudentContext(
      base44,
      authenticatedUser.id
    );

    if (action === "get_student_skills_exploration") {
      const data = await loadStudentSkillsExploration(
        base44,
        organizationId,
        clientId
      );

      return Response.json({
        ok: true,
        action,
        ...data,
      });
    }

    const interestIds = normalizeInterestIds(
      requestBody?.interest_ids
    );

    const interestLabels = interestIds.map(
      (interestId) =>
        INTEREST_AREAS[
          interestId as keyof typeof INTEREST_AREAS
        ]
    );

    const targetRole = limitText(client?.target_role, 300);

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a supportive career-exploration assistant for a Pre-ETS student.

The student selected these interest areas:
${interestLabels.map((label) => `- ${label}`).join("\n")}

${
  targetRole
    ? `The student has also recorded this possible job interest: ${targetRole}`
    : "The student has not recorded a specific target role."
}

Generate exactly four realistic entry-level career paths for a student exploring future work.

For each career path:
- Use a clear, beginner-friendly job title.
- Explain why it matches the selected interests.
- List three practical skills the student could develop.
- Give one realistic first step the student can take while in high school.

Requirements:
- Use encouraging, accessible language.
- Do not make assumptions about disability, health, support needs, or accommodations.
- Do not promise that a job is available or guaranteed.
- Do not recommend careers requiring advanced credentials as the immediate first step.
- Return only the requested structured response.`,
      add_context_from_internet: false,
      model: "claude_sonnet_4_6",
      response_json_schema: {
        type: "object",
        properties: {
          careers: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                why_its_a_fit: { type: "string" },
                skills_developed: {
                  type: "array",
                  items: { type: "string" },
                },
                first_step: { type: "string" },
              },
            },
          },
        },
      },
    });

    const careerPaths = normalizeCareerPaths(result?.careers);

    const assessment =
      await base44.asServiceRole.entities.Assessment.create({
        org_id: organizationId,
        client_id: clientId,
        assessment_type: "career_goals",
        status: "completed",
        responses: {
          source: "pre_ets_skills_exploration",
          interests: interestIds,
          suggestions: careerPaths,
        },
        completed_by: "Pre-ETS Skills Exploration",
        notes: `Interest areas: ${interestLabels.join(", ")}`,
      });

    return Response.json({
      ok: true,
      action,
      career_assessment: projectCareerAssessment(assessment),
      message: "Career paths generated.",
    });
  } catch (error: any) {
    const status =
      error instanceof RequestError ? error.status : 500;

    const message =
      error instanceof RequestError
        ? error.message
        : error?.message ||
          "Career paths could not be generated.";

    if (!(error instanceof RequestError)) {
      console.error(
        "mutateAuthorizedPreEtsSkillsExploration error:",
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
