import { createClientFromRequest } from "npm:@base44/sdk@0.8.23";
import { PDFDocument, StandardFonts } from "npm:pdf-lib@1.17.1";

const TEMPLATE_URL =
  "https://jobs.utah.gov/usor/vr/employer/info/usor72.pdf";

const CANONICAL_STAFF_ACCESS: Record<string, string> = {
  admin: "admin",
  management: "staff",
  employee: "staff",
};

const RATING_VALUES = new Set([
  "",
  "Excellent",
  "Good",
  "Average",
  "Poor",
]);

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function limitText(value: unknown, maximumLength = 4000) {
  return normalizeText(value).slice(0, maximumLength);
}

function isActive(record: any) {
  return record?.is_active !== false && record?.is_archived !== true;
}

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function isCanonicalStaffUser(user: any, organizationId: string) {
  const role = normalizeText(user?.role).toLowerCase();
  const accessLevel = normalizeText(user?.access_level).toLowerCase();

  return (
    isActive(user) &&
    normalizeText(user?.org_id) === organizationId &&
    CANONICAL_STAFF_ACCESS[role] === accessLevel
  );
}

function formatDate(value: string) {
  if (!value) return "";

  try {
    return new Date(`${value}T00:00:00.000Z`).toLocaleDateString("en-US");
  } catch {
    return value;
  }
}

function projectCreatedReport(report: any) {
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

function buildReportPayload(
  rawReport: any,
  returnCompletedTo: string,
  submittedBy: string
) {
  const reportingPeriodFrom = normalizeText(rawReport?.reporting_period_from);
  const reportingPeriodTo = normalizeText(rawReport?.reporting_period_to);
  const signatureDate = normalizeText(rawReport?.signature_date);

  if (!isValidDate(reportingPeriodFrom) || !isValidDate(reportingPeriodTo)) {
    return {
      error: "A valid reporting-period start and end date are required.",
      value: null,
    };
  }

  if (reportingPeriodFrom > reportingPeriodTo) {
    return {
      error: "The reporting-period start date cannot be after the end date.",
      value: null,
    };
  }

  if (signatureDate && !isValidDate(signatureDate)) {
    return {
      error: "Signature date must use a valid YYYY-MM-DD date.",
      value: null,
    };
  }

  const ratingKeys = [
    "quality_of_work",
    "rate_of_progress",
    "ability_get_along",
    "personal_appearance",
    "rate_of_task_completion",
    "attitude",
  ];

  for (const key of ratingKeys) {
    const rating = normalizeText(rawReport?.[key]);

    if (!RATING_VALUES.has(rating)) {
      return {
        error: "One or more performance ratings are invalid.",
        value: null,
      };
    }
  }

  return {
    error: "",
    value: {
      return_completed_to: returnCompletedTo,
      supervisor_name: limitText(rawReport?.supervisor_name, 300),
      supervisor_address: limitText(rawReport?.supervisor_address, 1000),
      reporting_period_from: reportingPeriodFrom,
      reporting_period_to: reportingPeriodTo,
      was_late: rawReport?.was_late === true,
      late_how_often: limitText(rawReport?.late_how_often, 500),
      had_absences: rawReport?.had_absences === true,
      absences_how_often: limitText(rawReport?.absences_how_often, 500),
      quality_of_work: normalizeText(rawReport?.quality_of_work),
      rate_of_progress: normalizeText(rawReport?.rate_of_progress),
      ability_get_along: normalizeText(rawReport?.ability_get_along),
      personal_appearance: normalizeText(rawReport?.personal_appearance),
      rate_of_task_completion: normalizeText(rawReport?.rate_of_task_completion),
      attitude: normalizeText(rawReport?.attitude),
      comments: limitText(rawReport?.comments, 5000),
      training_schedule_changes:
        rawReport?.training_schedule_changes === true,
      training_schedule_changes_explain: limitText(
        rawReport?.training_schedule_changes_explain,
        3000
      ),
      additional_hours_needed: limitText(
        rawReport?.additional_hours_needed,
        3000
      ),
      supervisor_signature: limitText(rawReport?.supervisor_signature, 300),
      signature_date: signatureDate,
      supervisor_title: limitText(rawReport?.supervisor_title, 300),
      submitted_by: submittedBy,
    },
  };
}

async function resolveReturnCompletedTo(
  base44: any,
  client: any,
  organizationId: string,
  fallbackEmail: string
) {
  const assignedStaffId = normalizeText(client?.assigned_employee_id);

  if (!assignedStaffId) return fallbackEmail;

  const assignedStaff = await base44.asServiceRole.entities.User.get(
    assignedStaffId
  ).catch(() => null);

  if (
    isCanonicalStaffUser(assignedStaff, organizationId) &&
    normalizeText(assignedStaff?.email)
  ) {
    return normalizeText(assignedStaff.email);
  }

  return fallbackEmail;
}

async function generateProgressReportPdf(
  base44: any,
  report: any,
  client: any
) {
  const templateResponse = await fetch(TEMPLATE_URL);

  if (!templateResponse.ok) {
    throw new Error("The official progress-report template could not be loaded.");
  }

  const templateBytes = await templateResponse.arrayBuffer();
  const pdfDocument = await PDFDocument.load(templateBytes);
  const form = pdfDocument.getForm();

  const setText = (fieldName: string, value: unknown) => {
    try {
      form.getTextField(fieldName).setText(normalizeText(value));
    } catch {
      // The official PDF may evolve; an unavailable field does not invalidate
      // an otherwise authorized report submission.
    }
  };

  const setRadio = (fieldName: string, value: unknown) => {
    try {
      form.getRadioGroup(fieldName).select(normalizeText(value));
    } catch {
      // See the note above for unavailable official-template fields.
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
  const pdfBlob = new Blob([pdfBytes], { type: "application/pdf" });
  const pdfFile = new File([pdfBlob], "Training_Progress_Report.pdf", {
    type: "application/pdf",
  });
  const { file_url } =
    await base44.asServiceRole.integrations.Core.UploadFile({ file: pdfFile });

  return normalizeText(file_url);
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json(
        { error: "This route accepts POST requests only." },
        { status: 405 }
      );
    }

    const base44 = createClientFromRequest(req);
    const authenticatedUser = await base44.auth.me().catch(() => null);

    if (!authenticatedUser?.id) {
      return Response.json(
        { error: "You must be signed in to submit an employer progress report." },
        { status: 401 }
      );
    }

    const requestBody = await req.json().catch(() => ({}));
    const action = normalizeText(requestBody?.action).toLowerCase();
    const clientId = normalizeText(requestBody?.client_id);

    if (action !== "submit_employer_progress_report") {
      return Response.json(
        { error: "This progress-report action is unavailable." },
        { status: 400 }
      );
    }

    if (!clientId) {
      return Response.json(
        { error: "Choose a Pre-ETS student before submitting a report." },
        { status: 400 }
      );
    }

    const caller = await base44.asServiceRole.entities.User.get(
      authenticatedUser.id
    ).catch(() => null);

    if (!caller || !isActive(caller)) {
      return Response.json(
        { error: "Your account is inactive or unavailable." },
        { status: 403 }
      );
    }

    const callerId = normalizeText(caller.id);
    const callerRole = normalizeText(caller.role).toLowerCase();
    const callerAccessLevel = normalizeText(caller.access_level).toLowerCase();
    const callerEmail = normalizeText(caller.email);
    const organizationId = normalizeText(caller.org_id);

    if (
      callerRole !== "pre_ets_employer" ||
      callerAccessLevel !== "pre_ets_employer_portal"
    ) {
      return Response.json(
        {
          error:
            "You are not authorized to submit Pre-ETS employer progress reports.",
        },
        { status: 403 }
      );
    }

    if (!organizationId) {
      return Response.json(
        { error: "Your account is not assigned to an organization." },
        { status: 403 }
      );
    }

    const organization = await base44.asServiceRole.entities.Organization.get(
      organizationId
    ).catch(() => null);

    if (!organization || !isActive(organization)) {
      return Response.json(
        { error: "Your organization is inactive or unavailable." },
        { status: 403 }
      );
    }

    const client = await base44.asServiceRole.entities.Client.get(
      clientId
    ).catch(() => null);

    if (
      !client ||
      !isActive(client) ||
      normalizeText(client?.org_id) !== organizationId ||
      normalizeText(client?.client_type).toLowerCase() !== "pre_ets" ||
      normalizeText(client?.assigned_employer_id) !== callerId
    ) {
      return Response.json(
        {
          error:
            "This Pre-ETS student is not available for employer reporting.",
        },
        { status: 403 }
      );
    }

    const returnCompletedTo = await resolveReturnCompletedTo(
      base44,
      client,
      organizationId,
      callerEmail
    );
    const payloadResult = buildReportPayload(
      requestBody?.report,
      returnCompletedTo,
      callerEmail
    );

    if (!payloadResult.value) {
      return Response.json(
        { error: payloadResult.error || "Report details are incomplete or invalid." },
        { status: 400 }
      );
    }

    const report = await base44.asServiceRole.entities.TrainingProgressReport.create(
      {
        org_id: organizationId,
        client_id: normalizeText(client.id),
        ...payloadResult.value,
      }
    );

    let pdfUrl = "";
    let documentCreated = false;

    try {
      pdfUrl = await generateProgressReportPdf(base44, report, client);

      if (pdfUrl) {
        await base44.asServiceRole.entities.TrainingProgressReport.update(
          report.id,
          { pdf_url: pdfUrl }
        );

        const document = await base44.asServiceRole.entities.Document.create({
          org_id: organizationId,
          client_id: normalizeText(client.id),
          title: `Training Progress Report (${payloadResult.value.reporting_period_from} – ${payloadResult.value.reporting_period_to})`,
          file_url: pdfUrl,
          file_name: "Training_Progress_Report.pdf",
          file_type: "application/pdf",
          category: "generated_report",
          document_subtype: "usor72",
          source_type: "TrainingProgressReport",
          source_id: normalizeText(report.id),
          is_generated: true,
          visibility: "staff",
        });

        documentCreated = Boolean(document?.id);

        await base44.asServiceRole.entities.Activity.create({
          org_id: organizationId,
          client_id: normalizeText(client.id),
          activity_type: "document_uploaded",
          title: "Employer training progress report submitted",
          description:
            "A Pre-ETS employer submitted a DWS-USOR 72 training progress report.",
          metadata: {
            related_entity_id: normalizeText(report.id),
            related_entity_type: "TrainingProgressReport",
          },
        });
      }
    } catch (pdfError: any) {
      console.error(
        "mutateAuthorizedPreEtsProgressReport PDF generation error:",
        pdfError?.message || pdfError
      );
    }

    const updatedReport = pdfUrl ? { ...report, pdf_url: pdfUrl } : report;

    return Response.json({
      ok: true,
      report: projectCreatedReport(updatedReport),
      pdf_generated: Boolean(pdfUrl),
      document_created: documentCreated,
    });
  } catch (error: any) {
    console.error(
      "mutateAuthorizedPreEtsProgressReport error:",
      error?.message || error
    );

    return Response.json(
      {
        error:
          "Unable to submit the employer training progress report. Please try again.",
      },
      { status: 500 }
    );
  }
});
