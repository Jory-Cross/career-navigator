import { createClientFromRequest } from "npm:@base44/sdk@0.8.23";
import { jsPDF } from "npm:jspdf@2.5.1";

const STAFF_ROLES = new Set(["admin", "management", "employee"]);
const SUPPORTED_ACTIONS = new Set([
  "create_staff_wble_form",
  "delete_staff_wble_form",
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

function limitText(value: unknown, maximumLength: number) {
  return normalizeText(value).slice(0, maximumLength);
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

function isValidIsoDate(value: string) {
  if (!value) {
    return true;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function formatPdfDate(value: string) {
  if (!value) {
    return "";
  }

  try {
    return new Date(`${value}T00:00:00.000Z`).toLocaleDateString("en-US");
  } catch {
    return value;
  }
}

function buildWblePayload(rawForm: any) {
  const fieldLimits: Record<string, number> = {
    vr_counselor_name: 300,
    vr_office_address: 1500,
    vr_office_phone: 100,
    vr_fax: 100,
    vr_email: 320,
    employer_name: 500,
    employer_address: 1500,
    employer_phone: 100,
    employer_fax: 100,
    employer_trainer: 300,
    employer_email: 320,
    pre_ets_specialist_name: 300,
    pre_ets_office_address: 1500,
    pre_ets_office_phone: 100,
    pre_ets_fax: 100,
    pre_ets_email: 320,
    trainee_wages: 1500,
    training_fee: 1000,
  };

  const payload: Record<string, string> = {};

  for (const [field, maximumLength] of Object.entries(fieldLimits)) {
    payload[field] = limitText(rawForm?.[field], maximumLength);
  }

  const startDate = normalizeText(rawForm?.start_date);
  const endDate = normalizeText(rawForm?.end_date);

  if (!isValidIsoDate(startDate) || !isValidIsoDate(endDate)) {
    throw new RequestError(
      400,
      "WBLE start and end dates must use valid YYYY-MM-DD dates."
    );
  }

  if (startDate && endDate && startDate > endDate) {
    throw new RequestError(
      400,
      "WBLE start date cannot be after the end date."
    );
  }

  return {
    ...payload,
    start_date: startDate,
    end_date: endDate,
    status: "completed",
  };
}

function projectWbleForm(form: any) {
  return {
    id: normalizeText(form?.id),
    client_id: normalizeText(form?.client_id),
    employer_name: normalizeText(form?.employer_name),
    start_date: normalizeText(form?.start_date),
    end_date: normalizeText(form?.end_date),
    trainee_wages: normalizeText(form?.trainee_wages),
    status: normalizeText(form?.status) || "draft",
    pdf_url: normalizeText(form?.pdf_url),
    created_date: normalizeText(form?.created_date),
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
      "You are not authorized to manage Pre-ETS WBLE forms."
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

async function generateWblePdf(base44: any, form: any, client: any) {
  const doc = new jsPDF();
  const margin = 20;
  let y = 15;

  doc.setFontSize(10);
  doc.text("DWS-USOR 163", margin, y);
  doc.text("State of Utah", 105, y, { align: "center" });
  y += 5;

  doc.text("04/2022", margin, y);
  doc.text("Department of Workforce Services", 105, y, {
    align: "center",
  });
  y += 5;

  doc.text("Utah State Office of Rehabilitation", 105, y, {
    align: "center",
  });
  y += 8;

  doc.setFontSize(14);
  doc.setFont(undefined, "bold");
  doc.text(
    "STUDENT WORK BASED LEARNING EXPERIENCE",
    105,
    y,
    { align: "center" }
  );
  y += 10;

  doc.setFontSize(10);
  doc.setFont(undefined, "normal");

  doc.setFont(undefined, "bold");
  doc.text("1. Client Information:", margin, y);
  doc.text("2. VR Counselor Information:", 110, y);
  y += 5;

  doc.setFont(undefined, "normal");
  doc.text(
    `Client name: ${normalizeText(client?.first_name)} ${normalizeText(
      client?.last_name
    )}`.trim(),
    margin,
    y
  );
  doc.text(`Counselor name: ${normalizeText(form?.vr_counselor_name)}`, 110, y);
  y += 5;

  doc.text(`Address: ${normalizeText(client?.location)}`, margin, y);
  doc.text(`Office address: ${normalizeText(form?.vr_office_address)}`, 110, y);
  y += 5;

  doc.text(`Home phone: ${normalizeText(client?.phone)}`, margin, y);
  doc.text(`Office phone: ${normalizeText(form?.vr_office_phone)}`, 110, y);
  y += 5;

  doc.text(`Email address: ${normalizeText(client?.email)}`, margin, y);
  doc.text(`Fax number: ${normalizeText(form?.vr_fax)}`, 110, y);
  y += 5;

  doc.text(`Email address: ${normalizeText(form?.vr_email)}`, 110, y);
  y += 10;

  doc.setFont(undefined, "bold");
  doc.text("3. Employer Information:", margin, y);
  doc.text("4. Pre-ETS Provider Information:", 110, y);
  y += 5;

  doc.setFont(undefined, "normal");
  doc.text(`Employer name: ${normalizeText(form?.employer_name)}`, margin, y);
  doc.text(
    `Specialist name: ${normalizeText(form?.pre_ets_specialist_name)}`,
    110,
    y
  );
  y += 5;

  doc.text(`Address: ${normalizeText(form?.employer_address)}`, margin, y);
  doc.text(
    `Office address: ${normalizeText(form?.pre_ets_office_address)}`,
    110,
    y
  );
  y += 5;

  doc.text(`Office phone: ${normalizeText(form?.employer_phone)}`, margin, y);
  doc.text(
    `Office phone: ${normalizeText(form?.pre_ets_office_phone)}`,
    110,
    y
  );
  y += 5;

  doc.text(`Fax number: ${normalizeText(form?.employer_fax)}`, margin, y);
  doc.text(`Fax number: ${normalizeText(form?.pre_ets_fax)}`, 110, y);
  y += 5;

  doc.text(
    `WBLE Employer Trainer: ${normalizeText(form?.employer_trainer)}`,
    margin,
    y
  );
  doc.text(`Email address: ${normalizeText(form?.pre_ets_email)}`, 110, y);
  y += 5;

  doc.text(`Email address: ${normalizeText(form?.employer_email)}`, margin, y);
  y += 10;

  doc.setFont(undefined, "bold");
  doc.text(
    "5. Work Based Learning Experience Start Date:",
    margin,
    y
  );
  doc.setFont(undefined, "normal");
  doc.text(formatPdfDate(normalizeText(form?.start_date)), 130, y);
  y += 5;

  doc.setFont(undefined, "bold");
  doc.text(
    "6. Work Based Learning Experience End Date:",
    margin,
    y
  );
  doc.setFont(undefined, "normal");
  doc.text(formatPdfDate(normalizeText(form?.end_date)), 130, y);
  y += 10;

  doc.setFont(undefined, "bold");
  doc.text("7. Employer Expectations:", margin, y);
  y += 5;

  doc.setFont(undefined, "normal");
  doc.text("The employer agrees to:", margin, y);
  y += 5;

  doc.text(
    "A. Provide training and supervision for the employee/client.",
    margin + 5,
    y
  );
  y += 5;

  const wagesText = doc.splitTextToSize(
    `B. Pay trainee's wages as follows: ${normalizeText(form?.trainee_wages)}`,
    165
  );
  doc.text(wagesText, margin + 5, y);
  y += wagesText.length * 5;

  doc.text(
    "(Note: The payment amount and schedule should be at least commensurate with the",
    margin + 8,
    y
  );
  y += 4;

  doc.text(
    "prevailing wage for the position within the organization)",
    margin + 8,
    y
  );
  y += 5;

  doc.text(
    "C. Employer/trainers must be willing to cover the client's social security, worker's",
    margin + 5,
    y
  );
  y += 4;

  doc.text(
    "compensation, or other appropriate insurance coverage, and fringe benefits normally",
    margin + 8,
    y
  );
  y += 4;

  doc.text("provided to other employees.", margin + 8, y);
  y += 6;

  if (y > 240) {
    doc.addPage();
    y = 20;
  }

  doc.text(
    "D. Employer/trainers will provide weekly updates regarding the employee's progress to the",
    margin + 5,
    y
  );
  y += 4;

  doc.text("Pre-ETS Provider.", margin + 8, y);
  y += 5;

  doc.text(
    "E. Employer/trainers will submit billing to the VR Counselor at the end of each week or month",
    margin + 5,
    y
  );
  y += 4;

  doc.text(
    "or as needed for reimbursement for training costs.",
    margin + 8,
    y
  );
  y += 10;

  doc.setFont(undefined, "bold");
  doc.text(
    "8. Utah State Office of Rehabilitation (USOR) Expectations:",
    margin,
    y
  );
  y += 5;

  doc.setFont(undefined, "normal");
  doc.text("The USOR VR Counselor agrees to:", margin, y);
  y += 5;

  const feeText = doc.splitTextToSize(
    `A. Pay the employer/trainer a negotiated training fee as follows: ${normalizeText(
      form?.training_fee
    )}`,
    165
  );
  doc.text(feeText, margin + 5, y);
  y += feeText.length * 5;

  doc.text(
    "B. When appropriate, furnish equipment, tools, and supplies that are required by the",
    margin + 5,
    y
  );
  y += 4;

  doc.text(
    "client/trainee for training and/or employment.",
    margin + 8,
    y
  );
  y += 5;

  doc.text(
    "C. Provide technical assistance, counseling, support, and follow-up to the Pre-ETS Provider",
    margin + 5,
    y
  );
  y += 4;

  doc.text(
    "and employer in resolving problems that may arise during the period of the WBLE.",
    margin + 8,
    y
  );
  y += 10;

  doc.text("Employer/Trainer Signature: /s/", margin, y);
  doc.text(`Date: ${new Date().toLocaleDateString()}`, 140, y);
  y += 6;

  doc.text("Client/Trainee Signature: /s/", margin, y);
  doc.text(`Date: ${new Date().toLocaleDateString()}`, 140, y);
  y += 6;

  doc.text("VR Counselor Signature: /s/", margin, y);
  doc.text(`Date: ${new Date().toLocaleDateString()}`, 140, y);
  y += 6;

  doc.text("Pre-ETS Provider: /s/", margin, y);
  doc.text(`Date: ${new Date().toLocaleDateString()}`, 140, y);

  const pdfBlob = doc.output("blob");
  const pdfFile = new File(
    [pdfBlob],
    `wble-form-${normalizeText(form?.id)}.pdf`,
    { type: "application/pdf" }
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

    if (action === "create_staff_wble_form") {
      const clientId = normalizeText(requestBody?.client_id);

      if (!clientId) {
        throw new RequestError(400, "client_id is required.");
      }

      const client = await resolveAuthorizedStaffClient(
        base44,
        caller,
        organizationId,
        clientId
      );

      const payload = buildWblePayload(requestBody?.form);

      const created =
        await base44.asServiceRole.entities.WBLEForm.create({
          client_id: normalizeText(client?.id),
          ...payload,
        });

      let pdfUrl = "";
      let documentCreated = false;

      try {
        pdfUrl = await generateWblePdf(base44, created, client);

        if (pdfUrl) {
          await base44.asServiceRole.entities.WBLEForm.update(
            created.id,
            { pdf_url: pdfUrl }
          );

          const document =
            await base44.asServiceRole.entities.Document.create({
              org_id: organizationId,
              client_id: normalizeText(client?.id),
              title: "WBLE Agreement Form",
              file_url: pdfUrl,
              file_name: "WBLE_Agreement.pdf",
              file_type: "application/pdf",
              category: "generated_report",
              document_subtype: "usor163",
              source_type: "WBLEForm",
              source_id: normalizeText(created?.id),
              is_generated: true,
              visibility: "staff",
            });

          documentCreated = Boolean(document?.id);

          await base44.asServiceRole.entities.Activity.create({
            org_id: organizationId,
            client_id: normalizeText(client?.id),
            activity_type: "document_uploaded",
            title: "WBLE form completed",
            description:
              "A Work Based Learning Experience agreement was completed and generated.",
            metadata: {
              related_entity_id: normalizeText(created?.id),
              related_entity_type: "WBLEForm",
            },
          });
        }
      } catch (pdfError: any) {
        console.error(
          "mutateAuthorizedPreEtsWbleForm PDF generation error:",
          pdfError?.message || pdfError
        );
      }

      return Response.json({
        ok: true,
        action,
        form: projectWbleForm({
          ...created,
          pdf_url: pdfUrl,
        }),
        pdf_generated: Boolean(pdfUrl),
        document_created: documentCreated,
      });
    }

    const formId = normalizeText(requestBody?.form_id);

    if (!formId) {
      throw new RequestError(400, "form_id is required.");
    }

    const form = await base44.asServiceRole.entities.WBLEForm.get(
      formId
    ).catch(() => null);

    if (!form || !isActive(form)) {
      throw new RequestError(404, "WBLE form not found.");
    }

    const client = await resolveAuthorizedStaffClient(
      base44,
      caller,
      organizationId,
      normalizeText(form?.client_id)
    );

    await base44.asServiceRole.entities.WBLEForm.delete(formId);

    await base44.asServiceRole.entities.Activity.create({
      org_id: organizationId,
      client_id: normalizeText(client?.id),
      activity_type: "status_changed",
      title: "WBLE form deleted",
      description:
        "A Work Based Learning Experience form was deleted by authorized staff.",
      metadata: {
        related_entity_id: formId,
        related_entity_type: "WBLEForm",
      },
    });

    return Response.json({
      ok: true,
      action,
      deleted_form_id: formId,
    });
  } catch (error: any) {
    const status =
      error instanceof RequestError ? error.status : 500;

    const message =
      error instanceof RequestError
        ? error.message
        : error?.message ||
          "Unable to process the Pre-ETS WBLE form request.";

    if (!(error instanceof RequestError)) {
      console.error(
        "mutateAuthorizedPreEtsWbleForm error:",
        error?.message || error
      );
    }

    return Response.json(
      { error: message },
      { status }
    );
  }
});
