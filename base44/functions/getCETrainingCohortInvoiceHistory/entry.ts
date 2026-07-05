import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

const CANONICAL_ACCESS_BY_ROLE: Record<string, string> = {
  admin: "admin",
  management: "staff",
  ce_instructor: "ce_training_portal",
};

class RequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function normalizeText(value: unknown) {
  return String(value || "").trim();
}

function normalizeEmail(value: unknown) {
  return normalizeText(value).toLowerCase();
}

function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function toSafeInteger(value: unknown) {
  const numberValue = Number(value);
  return Number.isInteger(numberValue) ? numberValue : 0;
}

function isActive(record: any) {
  return record?.is_active !== false && record?.is_archived !== true;
}

function getCanonicalRole(user: any) {
  const role = normalizeText(user?.role).toLowerCase();
  const accessLevel = normalizeText(user?.access_level).toLowerCase();
  return CANONICAL_ACCESS_BY_ROLE[role] === accessLevel ? role : "";
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function sortNewestFirst(rows: any[]) {
  return [...rows].sort((left, right) => {
    const rightTime = new Date(
      right?.paid_at || right?.issued_at || right?.created_date || 0
    ).getTime();
    const leftTime = new Date(
      left?.paid_at || left?.issued_at || left?.created_date || 0
    ).getTime();
    return rightTime - leftTime;
  });
}

async function resolveCanonicalCaller(base44: any, authenticatedUserId: string) {
  const caller = await base44.asServiceRole.entities.User.get(
    authenticatedUserId
  ).catch(() => null);

  if (!caller || !isActive(caller)) {
    throw new RequestError(403, "Your account is inactive or unavailable.");
  }

  const callerId = normalizeText(caller?.id);
  const callerEmail = normalizeEmail(caller?.email);
  const callerRole = getCanonicalRole(caller);
  const organizationId = normalizeText(caller?.org_id);

  if (!callerId || !isValidEmail(callerEmail) || !callerRole || !organizationId) {
    throw new RequestError(
      403,
      "Your account is not authorized to view cohort invoice history."
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
    callerId,
    callerRole,
    organizationId,
  };
}

async function resolveAuthorizedTrainingCohort(
  base44: any,
  context: any,
  cohortId: string
) {
  const cohort = await base44.asServiceRole.entities.CETrainingCohort.get(
    cohortId
  ).catch(() => null);

  if (
    !cohort ||
    !isActive(cohort) ||
    normalizeText(cohort?.org_id) !== context.organizationId ||
    normalizeText(cohort?.cohort_type).toLowerCase() !== "training" ||
    normalizeText(cohort?.status).toLowerCase() === "archived"
  ) {
    throw new RequestError(404, "The selected Training cohort is unavailable.");
  }

  if (["admin", "management"].includes(context.callerRole)) {
    return cohort;
  }

  const memberships =
    await base44.asServiceRole.entities.CETrainingCohortMember.filter({
      org_id: context.organizationId,
      cohort_id: cohortId,
      user_id: context.callerId,
      cohort_role: "manager",
      is_active: true,
    });

  const isActiveManager = asArray(memberships).some(
    (membership: any) =>
      isActive(membership) &&
      normalizeText(membership?.org_id) === context.organizationId &&
      normalizeText(membership?.cohort_id) === cohortId &&
      normalizeText(membership?.user_id) === context.callerId &&
      normalizeText(membership?.cohort_role).toLowerCase() === "manager"
  );

  if (!isActiveManager) {
    throw new RequestError(
      403,
      "You must be an active manager of this Training cohort to view its invoice history."
    );
  }

  return cohort;
}

function buildInvoiceHistory(
  invoices: any[],
  lines: any[],
  organizationId: string,
  cohortId: string
) {
  const validLines = lines.filter(
    (line) =>
      normalizeText(line?.organization_id) === organizationId &&
      normalizeText(line?.cohort_id) === cohortId &&
      normalizeText(line?.cohort_invoice_id)
  );

  const linesByInvoiceId = new Map<string, any[]>();
  for (const line of validLines) {
    const invoiceId = normalizeText(line?.cohort_invoice_id);
    const rows = linesByInvoiceId.get(invoiceId) || [];
    rows.push(line);
    linesByInvoiceId.set(invoiceId, rows);
  }

  const safeInvoices = invoices
    .filter(
      (invoice) =>
        normalizeText(invoice?.organization_id) === organizationId &&
        normalizeText(invoice?.cohort_id) === cohortId
    )
    .map((invoice) => {
      const invoiceId = normalizeText(invoice?.id);
      const invoiceLines = sortNewestFirst(linesByInvoiceId.get(invoiceId) || []);
      const lineTotalCents = invoiceLines.reduce(
        (total, line) => total + toSafeInteger(line?.amount_cents),
        0
      );
      const expectedStudentCount = toSafeInteger(invoice?.student_count);
      const expectedAmountCents = toSafeInteger(invoice?.amount_cents);
      const integrityIssues: string[] = [];

      if (!invoiceId) integrityIssues.push("Invoice ID is missing.");
      if (!normalizeText(invoice?.currency)) {
        integrityIssues.push("Invoice currency is missing.");
      }
      if (
        expectedStudentCount > 0 &&
        invoiceLines.length !== expectedStudentCount
      ) {
        integrityIssues.push("Saved line count does not match the locked student count.");
      }
      if (
        expectedAmountCents > 0 &&
        lineTotalCents !== expectedAmountCents
      ) {
        integrityIssues.push("Saved line total does not match the locked invoice total.");
      }

      return {
        id: invoiceId,
        invoice_status: normalizeText(invoice?.invoice_status) || "unknown",
        currency: normalizeText(invoice?.currency).toUpperCase(),
        student_count: expectedStudentCount,
        amount_cents: expectedAmountCents,
        issued_at: invoice?.issued_at || null,
        paid_at: invoice?.paid_at || null,
        created_date: invoice?.created_date || null,
        line_count: invoiceLines.length,
        line_total_cents: lineTotalCents,
        integrity_status:
          integrityIssues.length === 0 ? "valid" : "review_required",
        integrity_issues: integrityIssues,
        lines: invoiceLines.map((line) => ({
          id: normalizeText(line?.id),
          subject_verified_email: normalizeEmail(line?.subject_verified_email),
          amount_cents: toSafeInteger(line?.amount_cents),
          currency: normalizeText(line?.currency).toUpperCase(),
          line_status: normalizeText(line?.line_status) || "unknown",
          paid_at: line?.paid_at || null,
        })),
      };
    });

  return sortNewestFirst(safeInvoices);
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json(
        {
          ok: false,
          error: "This cohort invoice-history request must use POST.",
        },
        { status: 405 }
      );
    }

    const body: any = await req.json().catch(() => ({}));
    const cohortId = normalizeText(body?.cohort_id);
    if (!cohortId) {
      throw new RequestError(400, "A Training cohort must be selected.");
    }

    const base44 = createClientFromRequest(req);
    const authenticatedUser = await base44.auth.me().catch(() => null);
    if (!authenticatedUser?.id) {
      throw new RequestError(401, "Please sign in before viewing cohort invoice history.");
    }

    const context = await resolveCanonicalCaller(base44, authenticatedUser.id);
    await resolveAuthorizedTrainingCohort(base44, context, cohortId);

    const [invoiceRows, lineRows] = await Promise.all([
      base44.asServiceRole.entities.CETrainingCohortInvoice.filter({
        organization_id: context.organizationId,
        cohort_id: cohortId,
      }),
      base44.asServiceRole.entities.CETrainingCohortInvoiceLine.filter({
        organization_id: context.organizationId,
        cohort_id: cohortId,
      }),
    ]);

    const invoices = buildInvoiceHistory(
      asArray(invoiceRows),
      asArray(lineRows),
      context.organizationId,
      cohortId
    );

    return Response.json({
      ok: true,
      cohort_id: cohortId,
      summary: {
        invoice_count: invoices.length,
        paid_invoice_count: invoices.filter(
          (invoice: any) => invoice.invoice_status === "paid"
        ).length,
        open_invoice_count: invoices.filter((invoice: any) =>
          ["draft", "ready_for_checkout", "payment_processing", "failed"].includes(
            invoice.invoice_status
          )
        ).length,
        review_required_count: invoices.filter(
          (invoice: any) => invoice.integrity_status === "review_required"
        ).length,
      },
      invoices,
    });
  } catch (error: any) {
    const status = error instanceof RequestError ? error.status : 500;
    if (!(error instanceof RequestError)) {
      console.error(
        "getCETrainingCohortInvoiceHistory error:",
        error?.message || error
      );
    }

    return Response.json(
      {
        ok: false,
        error:
          error instanceof RequestError
            ? error.message
            : "Unable to load CE Training cohort invoice history.",
      },
      { status }
    );
  }
});
