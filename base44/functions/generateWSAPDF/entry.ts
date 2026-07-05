import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";
import { PDFDocument } from "npm:pdf-lib@1.17.1";

const FILLABLE_WSA_URL = "https://jobs.utah.gov/usor/vr/partners/usor94.pdf";

const CANONICAL_STAFF_ACCESS: Record<string, string> = {
  admin: "admin",
  management: "staff",
  employee: "staff",
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

function isActive(record: any) {
  return record?.is_active !== false && record?.is_archived !== true;
}

function getCanonicalStaffRole(user: any) {
  const role = normalizeText(user?.role).toLowerCase();
  const accessLevel = normalizeText(user?.access_level).toLowerCase();
  return CANONICAL_STAFF_ACCESS[role] === accessLevel ? role : "";
}

function cleanPdfText(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

function getResponseValue(responses: any, officialFields: any, key: string) {
  if (officialFields && officialFields[key] !== undefined && officialFields[key] !== null) {
    return officialFields[key];
  }

  if (responses && responses[key] !== undefined && responses[key] !== null) {
    return responses[key];
  }

  return "";
}

async function resolveCallerContext(base44: any, authenticatedUserId: string) {
  const caller = await base44.asServiceRole.entities.User.get(
    authenticatedUserId
  ).catch(() => null);

  if (!caller || !isActive(caller)) {
    throw new RequestError(403, "Your account is inactive or unavailable.");
  }

  const role = getCanonicalStaffRole(caller);
  const organizationId = normalizeText(caller?.org_id);
  if (!role || !organizationId) {
    throw new RequestError(
      403,
      "Your account is not authorized to generate WSA PDFs."
    );
  }

  const organization = await base44.asServiceRole.entities.Organization.get(
    organizationId
  ).catch(() => null);
  if (!organization || !isActive(organization)) {
    throw new RequestError(403, "Your organization is inactive or unavailable.");
  }

  return {
    caller,
    role,
    organizationId,
    isOrganizationAdmin: role === "admin",
    isManagement: role === "management",
  };
}

async function assertCallerMayAccessClient(
  base44: any,
  context: any,
  client: any
) {
  if (normalizeText(client?.org_id) !== context.organizationId) {
    throw new RequestError(
      403,
      "The requested WSA is not available in your organization."
    );
  }

  if (context.isOrganizationAdmin) return;

  const assignedEmployeeId = normalizeText(client?.assigned_employee_id);
  if (!assignedEmployeeId) {
    throw new RequestError(
      403,
      "This client does not have an assigned staff member who can generate the WSA PDF."
    );
  }

  if (assignedEmployeeId === context.caller.id) return;

  if (!context.isManagement) {
    throw new RequestError(
      403,
      "You may generate WSA PDFs only for clients assigned to you."
    );
  }

  const assignedEmployee = await base44.asServiceRole.entities.User.get(
    assignedEmployeeId
  ).catch(() => null);
  if (
    !assignedEmployee ||
    !isActive(assignedEmployee) ||
    normalizeText(assignedEmployee?.org_id) !== context.organizationId ||
    !getCanonicalStaffRole(assignedEmployee)
  ) {
    throw new RequestError(
      403,
      "This client’s assigned staff member is unavailable in your organization."
    );
  }

  const assignments =
    await base44.asServiceRole.entities.ManagerEmployeeAssignment.filter({
      manager_user_id: context.caller.id,
      employee_user_id: assignedEmployeeId,
    });
  const hasActiveDirectReportAssignment = Array.isArray(assignments) &&
    assignments.some(
      (assignment: any) =>
        assignment?.is_active === true &&
        assignment?.is_archived !== true &&
        normalizeText(assignment?.org_id) === context.organizationId &&
        normalizeText(assignment?.manager_user_id) === context.caller.id &&
        normalizeText(assignment?.employee_user_id) === assignedEmployeeId
    );

  if (!hasActiveDirectReportAssignment) {
    throw new RequestError(
      403,
      "Management may generate WSA PDFs only for clients assigned to active direct reports."
    );
  }
}

async function loadAuthorizedWsaAssessment(
  base44: any,
  context: any,
  assessmentId: string
) {
  const assessment = await base44.asServiceRole.entities.Assessment.get(
    assessmentId
  ).catch(() => null);
  if (!assessment) {
    throw new RequestError(404, "The requested WSA was not found.");
  }

  if (
    normalizeText(assessment?.assessment_type) !== "work_strategy_assessment"
  ) {
    throw new RequestError(400, "Choose a Work Strategy Assessment to generate a WSA PDF.");
  }

  const clientId = normalizeText(assessment?.client_id);
  if (!clientId) {
    throw new RequestError(409, "The requested WSA is not linked to a client.");
  }

  const client = await base44.asServiceRole.entities.Client.get(clientId).catch(
    () => null
  );
  if (!client) {
    throw new RequestError(404, "The client linked to this WSA was not found.");
  }

  const assessmentOrganizationId = normalizeText(assessment?.org_id);
  if (
    assessmentOrganizationId &&
    assessmentOrganizationId !== context.organizationId
  ) {
    throw new RequestError(
      403,
      "The requested WSA is not available in your organization."
    );
  }

  await assertCallerMayAccessClient(base44, context, client);
  return { assessment, client };
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json(
        { success: false, error: "This route accepts POST requests only." },
        { status: 405 }
      );
    }

    const body: any = await req.json().catch(() => ({}));
    const assessmentId = normalizeText(body?.assessment_id);
    if (!assessmentId) {
      throw new RequestError(400, "Choose a WSA before generating a PDF.");
    }

    const base44 = createClientFromRequest(req);
    const authenticatedUser = await base44.auth.me().catch(() => null);
    if (!authenticatedUser?.id) {
      throw new RequestError(401, "You must be signed in to generate a WSA PDF.");
    }

    const context = await resolveCallerContext(base44, authenticatedUser.id);
    const { assessment, client } = await loadAuthorizedWsaAssessment(
      base44,
      context,
      assessmentId
    );

    const responses = assessment?.responses || {};
    const officialFields =
      responses.official_wsa_fields &&
      typeof responses.official_wsa_fields === "object"
        ? responses.official_wsa_fields
        : responses._official_wsa_fields &&
            typeof responses._official_wsa_fields === "object"
          ? responses._official_wsa_fields
          : {};

    const pdfResponse = await fetch(FILLABLE_WSA_URL);
    if (!pdfResponse.ok) {
      throw new Error("Unable to fetch the WSA PDF template.");
    }

    const pdfBytes = await pdfResponse.arrayBuffer();
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const form = pdfDoc.getForm();

    const TEXT_FIELD_MAP = {
      crp_referring_to: "CRP Referring to",
      guardian_name_phone: "Parent/Guardian name and phone",
      referral_question: "Referral question",
      benefits_summary_info: "Benefits Summary Info",
      other_services_benefits: "Other ServicesBenefits",

      current_work_skills: "Current Work Skills knowledge skills and abilities",
      work_skill_development_needs: "Work Skill Development Needs",
      jobs_of_interest: "Jobs of Interest_1",
      interpersonal_social_skills: "informalformal speech",
      assistive_technology_needs:
        "Identified Assistive Technology Needs glasses UCAT device etc",
      communication_needs: "Communication Needs interpreter etc",
      behavioral_self_regulation: "BehavioralSelfregulation",
      activities_of_daily_living:
        "Activities of Daily Living hygiene meal prep etc",
      family_issues_supports: "Family IssuesSupports",
      criminal_background: "Criminal Background expungement etc",
      school_academic: "SchoolAcademic can include behavioral information",

      worksite_simulation_location: "Worksite Simulation Location",
      work_assessment_observations: "Work Assessment Observations",
      natural_support_observations: "Natural Support Assessment Observations",
      life_skills_observations: "Life Skills Observations",

      transportation_public: "Public Transportation Options (text)",
      transportation_private: "Private Transportation Options (text)",
      transportation_observations: "Transportation Assessment Observations",

      computer_skills_other: "Other skills (text)",
      computer_skill_observations: "Computer Skill Assessment Observations",
      interview_skill_observations: "Interview Skill Assessment Observations",
      other_observations: "Other Observations",

      planned_job_search_hours_week: "Planned Job Search hours/week",
      life_skills_needed: "Life Skills needed",
      life_skills_hours_requested: "Life Skills hours requested",
      recommended_target_occupations: "Recommended target occupations_1",
      recommended_supports_on_job: "Recommended supports on the job",
      job_development_supports:
        "Joint VR/CRP Recommendations for Job Development Supports",
      ongoing_supports: "Joint VR/CRP Recommendations for Ongoing Supports",

      job_goal: "Job Goal (must align with IPE goal)",
      industry_targeted_pay_range: "Industry Targeted Pay Range",
      benefits_other: "Benefits/Other",
      hours_available_to_work: "Other hours available to work",

      crp_name: "Community Rehabilitation Program Name",
      assigned_employment_specialist:
        "Assigned Employment SpecialistJob Coach",
      benefits_planning_date: "Date Scheduled",
      extended_services_provider: "Other Extended Services Provider (text)",
      health_insurance: "Other Health Insurance (text)",
    };

    const clientFields: Record<string, string> = {
      "Client Name": [client.first_name, client.last_name]
        .filter(Boolean)
        .join(" "),
      "Client Phone": client.phone || "",
      Address: client.address || "",
    };

    if (client.address) {
      const parts = String(client.address)
        .split(",")
        .map((part) => part.trim());
      if (parts.length >= 3) {
        clientFields.Address = parts[0];
        clientFields.City = parts[1];
        const stateZip = parts[2].split(" ").filter(Boolean);
        clientFields.State = stateZip[0] || "";
        clientFields.ZIP = stateZip[1] || "";
      } else if (parts.length === 2) {
        clientFields.Address = parts[0];
        clientFields.City = parts[1];
      }
    }

    for (const pdfFieldName of Object.keys(clientFields)) {
      const text = cleanPdfText(clientFields[pdfFieldName]);
      if (!text) continue;
      try {
        const field = form.getFieldMaybe(pdfFieldName);
        if (field && typeof field.setText === "function") field.setText(text);
      } catch (_error) {
        console.log("Client PDF field skipped:", pdfFieldName);
      }
    }

    for (const key of Object.keys(TEXT_FIELD_MAP)) {
      const pdfFieldName = TEXT_FIELD_MAP[key as keyof typeof TEXT_FIELD_MAP];
      const text = cleanPdfText(getResponseValue(responses, officialFields, key));
      if (!text) continue;
      try {
        const field = form.getFieldMaybe(pdfFieldName);
        if (field && typeof field.setText === "function") field.setText(text);
      } catch (_error) {
        console.log("WSA PDF field skipped:", key, pdfFieldName);
      }
    }

    try {
      const guardianshipField = form.getFieldMaybe("Guardianship");
      if (
        guardianshipField &&
        responses.guardianship &&
        typeof guardianshipField.select === "function"
      ) {
        guardianshipField.select(
          responses.guardianship === "Yes"
            ? "Guardianship-Yes"
            : "Guardianship-No"
        );
      }
    } catch (_error) {
      console.log("Guardianship PDF field skipped");
    }

    try {
      const acreField = form.getFieldMaybe("ACRE Certified?");
      if (
        acreField &&
        responses.acre_certified &&
        typeof acreField.select === "function"
      ) {
        acreField.select(responses.acre_certified);
      }
    } catch (_error) {
      console.log("ACRE PDF field skipped");
    }

    const contains = (value: unknown, keyword: string) =>
      cleanPdfText(value).toLowerCase().includes(keyword.toLowerCase());
    const checkboxMap = {
      "Division of Services for People with Disabilities DSPD": contains(
        getResponseValue(responses, officialFields, "extended_services_provider"),
        "DSPD"
      ),
      "Partnership Plus TTW":
        contains(
          getResponseValue(responses, officialFields, "extended_services_provider"),
          "TTW"
        ) ||
        contains(
          getResponseValue(responses, officialFields, "extended_services_provider"),
          "Partnership"
        ),
      Medicaid: contains(
        getResponseValue(responses, officialFields, "health_insurance"),
        "Medicaid"
      ),
      Medicare: contains(
        getResponseValue(responses, officialFields, "health_insurance"),
        "Medicare"
      ),
      "Parents Insurance": contains(
        getResponseValue(responses, officialFields, "health_insurance"),
        "Parent"
      ),
      "Spouses Insurance": contains(
        getResponseValue(responses, officialFields, "health_insurance"),
        "Spouse"
      ),
      "Supplemental Security Income SSI": contains(
        getResponseValue(responses, officialFields, "social_security_benefits"),
        "SSI"
      ),
      "Social Security Disability Insurance SSDI": contains(
        getResponseValue(responses, officialFields, "social_security_benefits"),
        "SSDI"
      ),
      Completed:
        getResponseValue(responses, officialFields, "benefits_planning") ===
        "Completed",
      "Pending Date Scheduled":
        getResponseValue(responses, officialFields, "benefits_planning") ===
        "Pending – Date Scheduled",
      "Not Applicable":
        getResponseValue(responses, officialFields, "benefits_planning") ===
        "Not Applicable",
      "Full Time": contains(
        getResponseValue(responses, officialFields, "hours_available_to_work"),
        "Full Time"
      ),
      "Part Time": contains(
        getResponseValue(responses, officialFields, "hours_available_to_work"),
        "Part Time"
      ),
      "10 hourswk": contains(
        getResponseValue(responses, officialFields, "hours_available_to_work"),
        "10 hours"
      ),
      Days: contains(
        getResponseValue(responses, officialFields, "hours_available_to_work"),
        "Days"
      ),
      "Swing shift": contains(
        getResponseValue(responses, officialFields, "hours_available_to_work"),
        "Swing"
      ),
    };

    for (const fieldName of Object.keys(checkboxMap)) {
      if (!checkboxMap[fieldName as keyof typeof checkboxMap]) continue;
      try {
        const field = form.getFieldMaybe(fieldName);
        if (field && typeof field.check === "function") field.check();
      } catch (_error) {
        console.log("WSA PDF checkbox skipped:", fieldName);
      }
    }

    const modifiedPdfBytes = await pdfDoc.save({
      updateFieldAppearances: true,
    });
    const pdfFile = new File(
      [modifiedPdfBytes],
      `Work_Strategy_Assessment_${assessmentId}.pdf`,
      { type: "application/pdf" }
    );
    const uploadResult = await base44.integrations.Core.UploadFile({
      file: pdfFile,
    });
    const fileUrl = normalizeText(uploadResult?.file_url);
    if (!fileUrl) {
      throw new Error("The generated WSA PDF could not be stored.");
    }

    await base44.asServiceRole.entities.Assessment.update(assessmentId, {
      pdf_url: fileUrl,
    });

    return Response.json({ success: true, pdf_url: fileUrl });
  } catch (error: any) {
    const status = error instanceof RequestError ? error.status : 500;
    if (!(error instanceof RequestError)) {
      console.error("generateWSAPDF error:", error?.message || error);
    }

    return Response.json(
      {
        success: false,
        error:
          error instanceof RequestError
            ? error.message
            : "Unable to generate the WSA PDF. Please try again.",
      },
      { status }
    );
  }
});