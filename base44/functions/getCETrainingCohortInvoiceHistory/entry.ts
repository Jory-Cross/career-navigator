import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

const ALLOWED_ROLES = new Set([
  "admin",
  "management",
  "ce_instructor",
]);

function normalizeText(value: unknown) {
  return String(value || "").trim();
}

function normalizeEmail(value: unknown) {
  return normalizeText(value).toLowerCase();
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function toSafeInteger(value: unknown) {
  const numberValue = Number(value);

  return Number.isInteger(numberValue) ? numberValue : 0;
}

function sortNewestFirst(rows: any[]) {
  return [...rows].sort((left, right) => {
    const rightTime = new Date(
      right?.paid_at ||
        right?.issued_at ||
        right?.created_date ||
        0
    ).getTime();

    const leftTime = new Date(
      left?.paid_at ||
        left?.issued_at ||
        left?.created_date ||
        0
    ).getTime();

    return rightTime - leftTime;
  });
}

async function getCallerRecord(base44: any, caller: any) {
  const rows = await base44.asServiceRole.entities.User.filter({
    id: caller.id,
  });

  return asArray(rows)[0] || caller;
}

async function resolveOrganizationId(
  base44: any,
  caller: any,
  callerRecord: any
) {
  const directOrganizationId = normalizeText(
    callerRecord?.org_id || caller?.org_id
  );

  if (directOrganizationId) {
    return directOrganizationId;
  }

  const callerEmail = normalizeEmail(
    callerRecord?.email || caller?.email
  );

  if (!callerEmail) {
    return "";
  }

  const organizationRows =
    await base44.asServiceRole.entities.Organization.filter({
      owner_email: callerEmail,
    });

  return normalizeText(asArray(organizationRows)[0]?.id);
}

async function assertHistoryAccess(
  base44: any,
  caller: any,
  callerRole: string,
  cohortId: string
) {
  if (!ALLOWED_ROLES.has(callerRole)) {
    throw new Error(
      "Only authorized CE organization users may view cohort invoice history."
    );
  }

  if (callerRole !== "ce_instructor") {
    return;
  }

  const membershipRows =
    await base44.asServiceRole.entities.CETrainingCohortMember.filter({
      cohort_id: cohortId,
      user_id: caller.id,
    });

  const isActiveManager = asArray(membershipRows).some(
    (membership) =>
      normalizeText(membership?.cohort_role) === "manager" &&
      membership?.is_active !== false
  );

  if (!isActiveManager) {
    throw new Error(
      "You must be an active manager of this Training cohort to view its invoice history."
    );
  }
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
    const invoiceId = normalizeText(line.cohort_invoice_id);

    if (!linesByInvoiceId.has(invoiceId)) {
      linesByInvoiceId.set(invoiceId, []);
    }

    linesByInvoiceId.get(invoiceId)?.push(line);
  }

  const safeInvoices = invoices
    .filter(
      (invoice) =>
        normalizeText(invoice?.organization_id) === organizationId &&
        normalizeText(invoice?.cohort_id) === cohortId
    )
    .map((invoice) => {
      const invoiceId = normalizeText(invoice.id);
      const invoiceLines = sortNewestFirst(
        linesByInvoiceId.get(invoiceId) || []
      );

      const lineTotalCents = invoiceLines.reduce(
        (total, line) => total + toSafeInteger(line.amount_cents),
        0
      );

      const expectedStudentCount = toSafeInteger(
        invoice.student_count
      );

      const expectedAmountCents = toSafeInteger(
        invoice.amount_cents
      );

      const integrityIssues: string[] = [];

      if (!invoiceId) {
        integrityIssues.push("Invoice ID is missing.");
      }

      if (!normalizeText(invoice.currency)) {
        integrityIssues.push("Invoice currency is missing.");
      }

      if (
        expectedStudentCount > 0 &&
        invoiceLines.length !== expectedStudentCount
      ) {
        integrityIssues.push(
          "Saved line count does not match the locked student count."
        );
      }

      if (
        expectedAmountCents > 0 &&
        lineTotalCents !== expectedAmountCents
      ) {
        integrityIssues.push(
          "Saved line total does not match the locked invoice total."
        );
      }

      const returnedLines = invoiceLines.map((line) => ({
        id: normalizeText(line.id),
        subject_verified_email: normalizeEmail(
          line.subject_verified_email
        ),
        amount_cents: toSafeInteger(line.amount_cents),
        currency: normalizeText(line.currency).toUpperCase(),
        line_status: normalizeText(line.line_status) || "unknown",
        paid_at: line.paid_at || null,
      }));

      return {
        id: invoiceId,
        invoice_status:
          normalizeText(invoice.invoice_status) || "unknown",
        currency: normalizeText(invoice.currency).toUpperCase(),
        student_count: expectedStudentCount,
        amount_cents: expectedAmountCents,
        issued_at: invoice.issued_at || null,
        paid_at: invoice.paid_at || null,
        created_date: invoice.created_date || null,
        line_count: returnedLines.length,
        line_total_cents: lineTotalCents,
        integrity_status:
          integrityIssues.length === 0
            ? "valid"
            : "review_required",
        integrity_issues: integrityIssues,
        lines: returnedLines,
      };
    });

  return sortNewestFirst(safeInvoices);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me();

    if (!caller) {
      return Response.json(
        {
          ok: false,
          error: "Unauthorized",
        },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const cohortId = normalizeText(body?.cohort_id);

    if (!cohortId) {
      return Response.json(
        {
          ok: false,
          error: "cohort_id is required.",
        },
        { status: 400 }
      );
    }

    const callerRecord = await getCallerRecord(base44, caller);
    const callerRole = normalizeText(
      callerRecord?.role || caller?.role
    );

    const organizationId = await resolveOrganizationId(
      base44,
      caller,
      callerRecord
    );

    if (!organizationId) {
      return Response.json(
        {
          ok: false,
          error: "Your account is not connected to an organization.",
        },
        { status: 403 }
      );
    }

    await assertHistoryAccess(
      base44,
      caller,
      callerRole,
      cohortId
    );

    const cohortRows =
      await base44.asServiceRole.entities.CETrainingCohort.filter({
        id: cohortId,
      });

    const cohort = asArray(cohortRows)[0] || null;

    if (!cohort) {
      return Response.json(
        {
          ok: false,
          error: "The requested CE Training cohort was not found.",
        },
        { status: 404 }
      );
    }

    if (
      normalizeText(cohort.org_id) !== organizationId
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "The requested CE Training cohort belongs to a different organization.",
        },
        { status: 403 }
      );
    }

    if (normalizeText(cohort.cohort_type) !== "training") {
      return Response.json(
        {
          ok: false,
          error:
            "Cohort invoice history is available only for Training cohorts.",
        },
        { status: 409 }
      );
    }

    const [invoiceRows, lineRows] = await Promise.all([
      base44.asServiceRole.entities.CETrainingCohortInvoice.filter({
        organization_id: organizationId,
        cohort_id: cohortId,
      }),
      base44.asServiceRole.entities.CETrainingCohortInvoiceLine.filter({
        organization_id: organizationId,
        cohort_id: cohortId,
      }),
    ]);

    const invoices = buildInvoiceHistory(
      asArray(invoiceRows),
      asArray(lineRows),
      organizationId,
      cohortId
    );

    const summary = {
      invoice_count: invoices.length,
      paid_invoice_count: invoices.filter(
        (invoice) => invoice.invoice_status === "paid"
      ).length,
      open_invoice_count: invoices.filter((invoice) =>
        [
          "draft",
          "ready_for_checkout",
          "payment_processing",
          "failed",
        ].includes(invoice.invoice_status)
      ).length,
      review_required_count: invoices.filter(
        (invoice) =>
          invoice.integrity_status === "review_required"
      ).length,
    };

    return Response.json({
      ok: true,
      cohort_id: cohortId,
      summary,
      invoices,
    });
  } catch (error) {
    console.error(
      "getCETrainingCohortInvoiceHistory error:",
      error?.message || error
    );

    return Response.json(
      {
        ok: false,
        error:
          error?.message ||
          "Unable to load CE Training cohort invoice history.",
      },
      { status: 500 }
    );
  }
});
