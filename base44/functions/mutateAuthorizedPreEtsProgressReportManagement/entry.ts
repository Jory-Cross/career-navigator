import { createClientFromRequest } from "npm:@base44/sdk@0.8.23";
import { PDFDocument, StandardFonts } from "npm:pdf-lib@1.17.1";

const TEMPLATE_URL =
  "https://jobs.utah.gov/usor/vr/employer/info/usor72.pdf";

const STAFF_ROLES = new Set(["admin", "management", "employee"]);
const SUPPORTED_ACTIONS = new Set([
  "regenerate_staff_progress_report_pdf",
  "delete_staff_progress_report",
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

function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function isActive(record: any) {
  return record?.is_active !== false && record?.is_archived !== true;
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

    const childIds = childrenByManagerId.get(managerId) || [];
    childIds.push(userId);
    childrenByManagerId.set(managerId, childIds);
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

function formatDate(value: string) {
  if (!value) {
    return "";
  }

  try {
    return new Date(`${value}T00:00:00.000Z`).toLocaleDateString("en-US");
  } catch {
    return value;
  }
}

function projectReport(report: any) {
  return {
    id: normalizeText(report?.id),
    client_id: normalizeText(report?.client_id),
    reporting_period_from: normalizeText(report?.reporting_period_from),
    reporting_period_to: normalizeText(report?.reporting_period_to),
    supervisor_name: normalizeText(report?.supervisor_name),
    supervisor_title: normalizeText(report?.supervisor_title),
    submitted_by: normalizeText(report?.submitted_by),
    pdf_url: normalizeText(report?.pdf_url),
    created_date: normalizeText(report?.created_date),
  };
}

async function resolveAuthorizedStaffClient(
  base44: any,
  caller: any,
  organizationId: string,
  clientId: string
) {
  const callerId = normalizeText(caller?.id);
  const callerRole = normalizeText(caller?.role).toLowerCase();

  if (!STAFF_ROLES.has(callerRole)) {
    throw new RequestError(
      403,
      "You are not authorized to manage Pre-ETS progress reports."
    );
  }

  const [organizationUsers, client] = await Promise.all([
    base44.asServiceRole.entities.User.filter({
      org_id: organizationId,
    }),
    base44.asServiceRole.entities.Client.get(clientId).catch(() => null),
  ]);

  if (!isPreEtsClientInOrganization(client, organizationId)) {
    throw new RequestError(404, "Pre-ETS client not found.");
  }

  const activeOrganizationUsers = asArray(organizationUsers).filter(
    (user: any) =>
      isActive(user) &&
      normalizeText(user?.org_id) === organizationId
  );

  const callerIsValidlyScoped = activeOrganizationUsers.some(
    (user: any) => normalizeText(user?.id) === callerId
  );

  if (!callerIsValidlyScoped) {
    throw new RequestError(
      403,
      "Your account is not validly scoped to this organization."
    );
  }

  if (callerRole === "admin") {
    return client;
  }

  if (callerRole === "management") {
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

    if (
      hasClientMembershipEvidence(
        client,
        visibleUserIds,
        visibleUserEmails
      )
    ) {
      return client;
    }
  } else {
    const ownUserIds = new Set([callerId]);
    const ownUserEmails = new Set(
      [normalizeText(caller?.email)].filter(Boolean)
    );

    if (
      hasClientMembershipEvidence(
        client,
        ownUserIds,
        ownUserEmails
      )
    ) {
      return client;
    }
  }

  throw new RequestError(404, "Pre-ETS client not found.");
}

async function resolveAuthorizedStaffReport(
  base44: any,
  caller: any,
  organizationId: string,
  reportId: string
) {
  if (!reportId) {
    throw new RequestError(400, "report_id is required.");
  }

  const report =
    await base44.asServiceRole.entities.TrainingProgressReport.get(
      reportId
    ).catch(() => null);

  if (!report || !isActive(report)) {
    throw new RequestError(404, "Training progress report not found.");
  }

  const clientId = normalizeText(report?.client_id);

  if (!clientId) {
    throw new RequestError(404, "Training progress report not found.");
  }

  const client = await resolveAuthorizedStaffClient(
    base44,
    caller,
    organizationId,
    clientId
  );

  return {
    report,
    client,
  };
}

async function generateProgressReportPdf(
  base44: any,
  report: any,
  client: any
) {
  const templateResponse = await fetch(TEMPLATE_URL);

  if (!templateResponse.ok) {
    throw new Error(
      `Unable to load the official progress-report template (${templateResponse.status}).`
    );
  }

  const templateBytes = await templateResponse.arrayBuffer();
  const pdfDocument = await PDFDocument.load(templateBytes);
  const form = pdfDocument.getForm();

  const setText = (fieldName: string, value: unknown) => {
    try {
      form.getTextField(fieldName).setText(normalizeText(value));
    } catch {
      // The official PDF template may change field names.
    }
  };

  const setRadio = (fieldName: string, value: unknown) => {
    try {
      form.getRadioGroup(fieldName).select(normalizeText(value));
    } catch {
      // The official PDF template may change field names.
    }
  };

  const supervisorName =
    normalizeText(report?.supervisor_name) ||
    normalizeText(client?.employer_contact_name) ||
    normalizeText(client?.employer_name);

  const supervisorAddress =
    normalizeText(report?.supervisor_address) ||
    normalizeText(client?.employer_address);

  setText("Return Completed Form To", report?.return_completed_to);
  setText(
    "ClientEmployee Name",
    `${normalizeText(client?.first_name)} ${normalizeText(
      client?.last_name
    )}`.trim()
  );
  setText("SupervisorEmployer Name", supervisorName);
  setText("Supervisor Employer Address", supervisorAddress);
  setText("From", formatDate(normalizeText(report?.reporting_period_from)));
  setText("To", formatDate(normalizeText(report?.reporting_period_to)));
  setText("Date", formatDate(normalizeText(report?.signature_date)));
  setText("EmployerSupervisor Title", report?.supervisor_title);

  setRadio("Late?", report?.was_late ? "Late - Yes" : "Late - No");
  setText("Late? If yes how often", report?.late_how_often);

  setRadio(
    "Unexcused?",
    report?.had_absences ? "Unexcused - Yes" : "Unexcused - No"
  );
  setText("Unexcused? If yes how often", report?.absences_how_often);

  setRadio("Quality of Work", report?.quality_of_work);
  setRadio("Rate of Progress", report?.rate_of_progress);
  setRadio("Get Along", report?.ability_get_along);
  setRadio("Appearance", report?.personal_appearance);
  setRadio("Task Completion", report?.rate_of_task_completion);
  setRadio("Attitude", report?.attitude);

  setText("Comments", report?.comments);
  setRadio(
    "Changes to training scedule?",
    report?.training_schedule_changes ? "Changes - Yes" : "Changes - No"
  );
  setText(
    "Changes - Explanation",
    report?.training_schedule_changes_explain
  );
  setText("Addtional hours needed", report?.additional_hours_needed);

  form.flatten();

  const signature = normalizeText(report?.supervisor_signature);

  if (signature) {
    const [firstPage] = pdfDocument.getPages();
    const font = await pdfDocument.embedFont(StandardFonts.Helvetica);

    firstPage.drawText(signature, {
      x: 345,
      y: 109,
      size: 11,
      font,
      maxWidth: 250,
    });
  }

  const pdfBytes = await pdfDocument.save();
  const pdfBlob = new Blob([pdfBytes], {
    type: "application/pdf",
  });
  const pdfFile = new File(
    [pdfBlob],
    "Training_Progress_Report.pdf",
    {
      type: "application/pdf",
    }
  );

  const { file_url } =
    await base44.asServiceRole.integrations.Core.UploadFile({
      file: pdfFile,
    });

  return normalizeText(file_url);
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
    const action = normalizeText(requestBody?.action);

    if (!SUPPORTED_ACTIONS.has(action)) {
      return Response.json(
        { error: "Unsupported action." },
        { status: 400 }
      );
    }

    const caller = await base44.asServiceRole.entities.User.get(
      authenticatedUser.id
    ).catch(() => null);

    if (!caller || !isActive(caller)) {
      throw new RequestError(
        403,
        "Authenticated user record was not found or is inactive."
      );
    }

    const organizationId = normalizeText(caller?.org_id);

    if (!organizationId) {
      throw new RequestError(
        403,
        "Your account is not assigned to an organization."
      );
    }

    const organization = await base44.asServiceRole.entities.Organization.get(
      organizationId
    ).catch(() => null);

    if (!organization || !isActive(organization)) {
      throw new RequestError(
        403,
        "Your organization assignment is invalid or inactive."
      );
    }

    const reportId = normalizeText(requestBody?.report_id);

    const { report, client } = await resolveAuthorizedStaffReport(
      base44,
      caller,
      organizationId,
      reportId
    );

    if (action === "regenerate_staff_progress_report_pdf") {
      const pdfUrl = await generateProgressReportPdf(
        base44,
        report,
        client
      );

      const updated =
        await base44.asServiceRole.entities.TrainingProgressReport.update(
          reportId,
          {
            pdf_url: pdfUrl,
          }
        );

      await base44.asServiceRole.entities.Activity.create({
        org_id: organizationId,
        client_id: normalizeText(client?.id),
        activity_type: "status_changed",
        title: "Training progress report PDF regenerated",
        description:
          "An authorized staff member regenerated the DWS-USOR 72 progress-report PDF.",
        metadata: {
          related_entity_id: reportId,
          related_entity_type: "TrainingProgressReport",
        },
      });

      return Response.json({
        ok: true,
        action,
        report: projectReport(updated),
      });
    }

    await base44.asServiceRole.entities.TrainingProgressReport.delete(
      reportId
    );

    await base44.asServiceRole.entities.Activity.create({
      org_id: organizationId,
      client_id: normalizeText(client?.id),
      activity_type: "status_changed",
      title: "Training progress report deleted",
      description:
        "An authorized staff member deleted a DWS-USOR 72 training progress report.",
      metadata: {
        related_entity_id: reportId,
        related_entity_type: "TrainingProgressReport",
      },
    });

    return Response.json({
      ok: true,
      action,
      deleted_report_id: reportId,
    });
  } catch (error: any) {
    const status =
      error instanceof RequestError ? error.status : 500;

    const message =
      error instanceof RequestError
        ? error.message
        : error?.message ||
          "Unable to process the Pre-ETS progress-report request.";

    if (!(error instanceof RequestError)) {
      console.error(
        "mutateAuthorizedPreEtsProgressReportManagement error:",
        error?.message || error
      );
    }

    return Response.json(
      { error: message },
      { status }
    );
  }
});
