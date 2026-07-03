import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";
import Stripe from "npm:stripe@14.21.0";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";
const APP_URL = Deno.env.get("APP_URL") || "https://ability4hire.com";
const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

const ALLOWED_ACCESS_BY_ROLE = new Map([
  ["admin", "admin"],
  ["management", "staff"],
  ["ce_instructor", "ce_training_portal"],
]);

const OPEN_ASSIGNMENT_STATUSES = new Set([
  "pending",
  "invite_email_sent",
  "pending_email_failed",
]);

const REGISTRATION_FEE_KINDS = new Set([
  "training_registration",
  "training_reactivation",
]);

const OPEN_INVOICE_STATUSES = new Set([
  "draft",
  "ready_for_checkout",
  "payment_processing",
  "failed",
]);

const PAYABLE_EVENT_STATUSES = new Set([
  "pending",
  "ready_for_checkout",
  "failed",
]);

const PRE_SETTLEMENT_ENROLLMENT_STATUSES = new Set([
  "invited",
  "payment_pending",
]);

function fail(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

function text(value: unknown) {
  return String(value || "").trim();
}

function email(value: unknown) {
  return text(value).toLowerCase();
}

function active(record: any) {
  return record?.is_active !== false && record?.is_archived !== true && text(record?.status).toLowerCase() !== "archived";
}

function validEmail(value: unknown) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email(value));
}

function publicError(error: any) {
  return Number(error?.status)
    ? text(error?.message)
    : "Unable to create the CE Training cohort invoice checkout. Please try again or contact support.";
}

function registrationEventKey(orgId: string, studentEmail: string) {
  return `ce_student_registration:${orgId}:${encodeURIComponent(
    email(studentEmail),
  )}`;
}

function checkoutUrls(cohortId: string) {
  const appUrl = APP_URL.replace(/\/+$/, "");
  const encodedCohortId = encodeURIComponent(cohortId);

  return {
    success_url:
      `${appUrl}/CohortDetail?cohort_id=${encodedCohortId}` +
      "&cohort_invoice_payment=success" +
      "&session_id={CHECKOUT_SESSION_ID}",
    cancel_url:
      `${appUrl}/CohortDetail?cohort_id=${encodedCohortId}` +
      "&cohort_invoice_payment=cancelled",
  };
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );

  return Array.from(new Uint8Array(digest))
    .map((part) => part.toString(16).padStart(2, "0"))
    .join("");
}

async function invoiceKey(
  orgId: string,
  cohortId: string,
  eventIds: string[],
) {
  return `ce_training_cohort_invoice:${await sha256(
    [orgId, cohortId, ...eventIds.slice().sort()].join("|"),
  )}`;
}

async function getCallerRecord(base44: any, caller: any) {
  const callerId = text(caller?.id);
  if (!callerId) throw fail(401, "Sign in again before creating a cohort invoice checkout.");
  const rows = await base44.asServiceRole.entities.User.filter({ id: callerId });
  const record = Array.isArray(rows) ? rows.find((row) => text(row?.id) === callerId) : null;
  if (!record) throw fail(401, "Sign in again before creating a cohort invoice checkout.");
  if (!active(record)) throw fail(403, "Your account is inactive or archived and cannot create a cohort invoice checkout.");
  if (!validEmail(record?.email)) throw fail(409, "Your account needs a valid email address before creating a checkout.");
  const role = text(record?.role).toLowerCase();
  const accessLevel = text(record?.access_level).toLowerCase();
  if (ALLOWED_ACCESS_BY_ROLE.get(role) !== accessLevel) {
    throw fail(403, "Only authorized CE organization users may create a cohort registration invoice.");
  }
  if (!text(record?.org_id)) throw fail(400, "Your account is not explicitly connected to an organization.");
  return { ...record, role, access_level: accessLevel, org_id: text(record.org_id), email: email(record.email) };
}

async function getOrganization(base44: any, organizationId: string) {
  const rows = await base44.asServiceRole.entities.Organization.filter({ id: organizationId });
  const organization = Array.isArray(rows) ? rows.find((row) => text(row?.id) === organizationId) : null;
  if (!organization) throw fail(404, "Your organization could not be found.");
  if (!active(organization)) throw fail(409, "Your organization is inactive or archived and cannot create a cohort invoice checkout.");
  return organization;
}

async function assertAuthorization(base44: any, caller: any, role: string, organizationId: string, cohortId: string) {
  if (role === "admin") return;
  const rows = await base44.asServiceRole.entities.CETrainingCohortMember.filter({
    org_id: organizationId,
    cohort_id: cohortId,
    user_id: caller.id,
  });
  const isManager = (Array.isArray(rows) ? rows : []).some((membership) =>
    text(membership?.org_id) === organizationId &&
    text(membership?.cohort_id) === cohortId &&
    text(membership?.user_id) === text(caller.id) &&
    text(membership?.cohort_role).toLowerCase() === "manager" &&
    active(membership)
  );
  if (!isManager) throw fail(403, "You must be an active manager of this Training cohort to create its registration invoice.");
}

function selectedIds(value: unknown) {
  if (!Array.isArray(value)) {
    throw fail(
      400,
      "billing_event_ids must be a non-empty array of selected eligible CE registration billing-event IDs.",
    );
  }

  const ids = value.map(text).filter(Boolean);

  if (!ids.length) {
    throw fail(
      400,
      "Select at least one eligible CE registration before creating a cohort invoice.",
    );
  }

  if (new Set(ids).size !== ids.length) {
    throw fail(
      400,
      "billing_event_ids contains a duplicate CE registration billing-event ID.",
    );
  }

  return ids;
}

async function getCheckout(invoice: any) {
  const sessionId = text(invoice?.stripe_checkout_session_id);

  if (!sessionId || !stripe) {
    return null;
  }

  try {
    return await stripe.checkout.sessions.retrieve(sessionId);
  } catch (error) {
    console.error("Unable to retrieve saved Stripe checkout session:", error);
    throw fail(409, "The saved checkout session could not be verified. Please contact support before creating another checkout.");
  }
}

function linesForInvoice(lines: any[], invoiceId: string) {
  return lines.filter(
    (line) => text(line.cohort_invoice_id) === invoiceId,
  );
}

function assertExactInvoiceSelection(
  lines: any[],
  requestedIds: string[],
) {
  const lineIds = lines.map((line) =>
    text(line.organization_billing_event_id),
  );
  const requestedSet = new Set(requestedIds);

  if (
    lineIds.length !== requestedIds.length ||
    new Set(lineIds).size !== lineIds.length ||
    !lineIds.every((id) => requestedSet.has(id))
  ) {
    throw fail(
      409,
      "The saved cohort invoice does not contain exactly the selected student registration events.",
    );
  }
}

function validateCompleteLineLinkage({
  invoice,
  line,
  organizationId,
  cohortId,
  inviteById,
  eventById,
  enrollmentByEventId,
}: any) {
  const eventId = text(line.organization_billing_event_id);
  const assignmentId = text(line.pending_role_assignment_id);
  const lineEmail = email(line.subject_verified_email);
  const invite = inviteById.get(assignmentId);
  const event = eventById.get(eventId);
  const enrollments = enrollmentByEventId.get(eventId) || [];
  const enrollment = enrollments[0];
  const currency = text(invoice.currency).toLowerCase();
  const amountCents = Number(line.amount_cents);

  if (text(line.invoice_line_key) !== `ce_training_cohort_invoice_line:${text(invoice.id)}:${eventId}`) {
    throw fail(409, "A saved cohort invoice line has an invalid security key.");
  }
  if (!invite || !event || enrollments.length !== 1) {
    throw fail(409, "Each cohort invoice line must have exactly one invitation, billing event, and enrollment record.");
  }

  const enrollmentStatus = text(enrollment.enrollment_status).toLowerCase();
  if (!active(enrollment) || ["withdrawn", "revoked", "active", "completed"].includes(enrollmentStatus) || !PRE_SETTLEMENT_ENROLLMENT_STATUSES.has(enrollmentStatus)) {
    throw fail(409, "A CE Training enrollment is not in a pre-settlement state that allows cohort checkout.");
  }

  const inviteMatches =
    text(invite.org_id) === organizationId &&
    text(invite.cohort_id) === cohortId &&
    text(invite.role).toLowerCase() === "ce_student" &&
    text(invite.access_level).toLowerCase() === "ce_training_portal" &&
    OPEN_ASSIGNMENT_STATUSES.has(text(invite.status).toLowerCase()) &&
    text(invite.payment_responsibility).toLowerCase() === "instructor_paid" &&
    text(invite.instructor_payment_mode).toLowerCase() === "invoice_with_cohort" &&
    email(invite.email) === lineEmail;

  const eventMatches =
    text(event.organization_id) === organizationId &&
    text(event.cohort_id) === cohortId &&
    REGISTRATION_FEE_KINDS.has(text(event.fee_kind).toLowerCase()) &&
    text(event.billing_subject_type).toLowerCase() === "student" &&
    email(event.subject_verified_email) === lineEmail &&
    Number(event.amount_cents) === amountCents &&
    text(event.currency).toLowerCase() === currency &&
    PAYABLE_EVENT_STATUSES.has(text(event.event_status).toLowerCase());

  const enrollmentMatches =
    text(enrollment.org_id) === organizationId &&
    text(enrollment.cohort_id) === cohortId &&
    email(enrollment.student_email) === lineEmail &&
    text(enrollment.pending_role_assignment_id) === assignmentId &&
    text(enrollment.organization_billing_event_id) === eventId &&
    text(enrollment.payment_responsibility).toLowerCase() === "instructor_paid" &&
    text(enrollment.instructor_payment_mode).toLowerCase() === "invoice_with_cohort";

  if (!inviteMatches || !eventMatches || !enrollmentMatches) {
    throw fail(409, "A cohort invoice line no longer matches its CE invitation, enrollment, and billing records.");
  }
}

function processingResponse(invoice: any, message: string) {
  return {
    ok: true,
    paid: false,
    checkout_created: false,
    reused_existing_checkout: false,
    payment_confirmed_processing: true,
    cohort_invoice_id: invoice.id,
    invoice_status: text(invoice.invoice_status),
    checkout_session_id: text(invoice.stripe_checkout_session_id) || null,
    checkout_url: null,
    amount_cents: Number(invoice.amount_cents),
    currency: text(invoice.currency).toUpperCase(),
    student_count: Number(invoice.student_count),
    message,
  };
}

function verifyCheckoutSession(session: any, invoice: any, organizationId: string, cohortId: string) {
  if (!session) return false;
  const metadata = session.metadata || {};
  return (
    text(session.client_reference_id) === text(invoice.id) &&
    text(metadata.billing_flow) === "ce_training_cohort_invoice" &&
    text(metadata.cohort_invoice_id) === text(invoice.id) &&
    text(metadata.invoice_key) === text(invoice.invoice_key) &&
    text(metadata.organization_id) === organizationId &&
    text(metadata.cohort_id) === cohortId &&
    Number(session.amount_total) === Number(invoice.amount_cents) &&
    text(session.currency).toLowerCase() === text(invoice.currency).toLowerCase()
  );
}

function validateSavedInvoice({
  invoice,
  lines,
  organizationId,
  cohortId,
  inviteById,
  eventById,
  enrollmentByEventId,
}: any) {
  if (
    text(invoice.organization_id) !== organizationId ||
    text(invoice.cohort_id) !== cohortId
  ) {
    throw fail(
      409,
      "The saved cohort invoice does not match this organization and cohort.",
    );
  }

  const status = text(invoice.invoice_status);

  if (status !== "paid" && !OPEN_INVOICE_STATUSES.has(status)) {
    throw fail(
      409,
      "This cohort invoice is cancelled, refunded, or otherwise not payable.",
    );
  }

  const amountCents = Number(invoice.amount_cents);
  const studentCount = Number(invoice.student_count);
  const currency = text(invoice.currency).toLowerCase();

  if (
    !currency ||
    !Number.isInteger(amountCents) ||
    amountCents <= 0 ||
    !Number.isInteger(studentCount) ||
    studentCount <= 0 ||
    lines.length !== studentCount
  ) {
    throw fail(
      409,
      "The saved cohort invoice has an invalid locked amount, currency, or student count.",
    );
  }

  const lineEventIds = new Set<string>();
  let lineTotal = 0;

  for (const line of lines) {
    const eventId = text(line.organization_billing_event_id);
    const assignmentId = text(line.pending_role_assignment_id);
    const lineAmount = Number(line.amount_cents);
    const lineEmail = email(line.subject_verified_email);
    const invite = inviteById.get(assignmentId);
    const event = eventById.get(eventId);

    if (
      text(line.organization_id) !== organizationId ||
      text(line.cohort_id) !== cohortId ||
      text(line.cohort_invoice_id) !== text(invoice.id) ||
      text(line.currency).toLowerCase() !== currency ||
      text(line.line_status) !== "included" ||
      !eventId ||
      !assignmentId ||
      lineEventIds.has(eventId) ||
      !Number.isInteger(lineAmount) ||
      lineAmount <= 0 ||
      !invite ||
      !event
    ) {
      throw fail(
        409,
        "A saved cohort invoice line is invalid or no longer payable.",
      );
    }

    validateCompleteLineLinkage({
      invoice,
      line,
      organizationId,
      cohortId,
      inviteById,
      eventById,
      enrollmentByEventId,
    });

    lineEventIds.add(eventId);
    lineTotal += lineAmount;
  }

  if (lineEventIds.size !== studentCount || lineTotal !== amountCents) {
    throw fail(
      409,
      "The saved cohort invoice lines do not match its locked student count or total amount.",
    );
  }
}

async function ensureCheckout({
  base44,
  invoice,
  lines,
  organizationId,
  cohort,
  callerEmail,
  inviteById,
  eventById,
  enrollmentByEventId,
}: any) {
  const invoiceStatus = text(invoice.invoice_status);

  if (invoiceStatus === "paid") {
    return {
      ok: true,
      paid: true,
      checkout_created: false,
      reused_existing_checkout: false,
      cohort_invoice_id: invoice.id,
      invoice_status: "paid",
      checkout_session_id:
        text(invoice.stripe_checkout_session_id) || null,
      checkout_url: null,
      message:
        "This CE Training cohort invoice is already paid. No additional checkout was created.",
    };
  }

  validateSavedInvoice({
    invoice,
    lines,
    organizationId,
    cohortId: text(cohort.id),
    inviteById,
    eventById,
    enrollmentByEventId,
  });

  const existingSession = await getCheckout(invoice);

  if (existingSession && !verifyCheckoutSession(existingSession, invoice, organizationId, text(cohort.id))) {
    return processingResponse(invoice, "The saved checkout session could not be verified for this cohort invoice. Please contact support before trying another payment.");
  }

  if (existingSession?.status === "open" && existingSession.url) {
    return {
      ok: true,
      paid: false,
      checkout_created: false,
      reused_existing_checkout: true,
      cohort_invoice_id: invoice.id,
      invoice_status: invoiceStatus,
      checkout_session_id: existingSession.id,
      checkout_url: existingSession.url,
      amount_cents: Number(invoice.amount_cents),
      currency: text(invoice.currency).toUpperCase(),
      student_count: Number(invoice.student_count),
      message:
        "An open secure checkout already exists for this CE Training cohort invoice.",
    };
  }

  if (
    ["paid", "complete", "processing"].includes(text(existingSession?.payment_status).toLowerCase()) ||
    ["complete", "expired"].includes(text(existingSession?.status).toLowerCase())
  ) {
    return processingResponse(
      invoice,
      "This cohort invoice payment is already processing or complete. Wait for reconciliation before attempting another checkout.",
    );
  }

  if (invoiceStatus === "payment_processing") {
    throw fail(
      409,
      "This CE Training cohort invoice is already processing payment. Do not create a second checkout session.",
    );
  }

  const freshEventById = new Map<string, any>();
  for (const line of lines) {
    const eventId = text(line.organization_billing_event_id);
    const freshRows = await base44.asServiceRole.entities.OrganizationBillingEvent.filter({
      id: eventId,
      organization_id: organizationId,
      cohort_id: text(cohort.id),
    });
    const freshEvent = Array.isArray(freshRows) ? freshRows.find((event) => text(event?.id) === eventId) : null;
    if (!freshEvent || !PAYABLE_EVENT_STATUSES.has(text(freshEvent.event_status).toLowerCase())) {
      throw fail(409, "A selected CE registration billing event is no longer ready for this cohort checkout.");
    }
    freshEventById.set(eventId, freshEvent);
    eventById.set(eventId, freshEvent);
  }

  const { success_url, cancel_url } = checkoutUrls(text(cohort.id));
  const previousSessionId = text(invoice.stripe_checkout_session_id);

  const idempotencyKey = previousSessionId
    ? `ce_training_cohort_invoice_checkout:${invoice.invoice_key}:retry:${previousSessionId}`
    : `ce_training_cohort_invoice_checkout:${invoice.invoice_key}:initial`;

  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: callerEmail,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: text(invoice.currency).toLowerCase(),
            unit_amount: Number(invoice.amount_cents),
            product_data: {
              name: "CE Training Cohort Registration Invoice",
              description: `${Number(invoice.student_count)} CE Training registration${
                Number(invoice.student_count) === 1 ? "" : "s"
              } for ${text(cohort.name) || "this cohort"}.`,
            },
          },
        },
      ],
      success_url,
      cancel_url,
      client_reference_id: String(invoice.id),
      metadata: {
        billing_flow: "ce_training_cohort_invoice",
        cohort_invoice_id: String(invoice.id),
        invoice_key: String(invoice.invoice_key),
        organization_id: organizationId,
        cohort_id: String(cohort.id),
      },
      payment_intent_data: {
        metadata: {
          billing_flow: "ce_training_cohort_invoice",
          cohort_invoice_id: String(invoice.id),
          invoice_key: String(invoice.invoice_key),
          organization_id: organizationId,
          cohort_id: String(cohort.id),
        },
      },
    },
    { idempotencyKey },
  );

  if (!session.url) {
    throw fail(
      500,
      "Stripe created the cohort invoice checkout session without a checkout URL.",
    );
  }

  try {
    await base44.asServiceRole.entities.CETrainingCohortInvoice.update(
      invoice.id,
      {
        invoice_status: "ready_for_checkout",
        issued_at: invoice.issued_at || new Date().toISOString(),
        stripe_checkout_session_id: session.id,
        notes:
          "CE Training cohort invoice checkout session created from locked registration events.",
      },
    );

    for (const line of lines) {
      const event = freshEventById.get(text(line.organization_billing_event_id));
      if (!event) throw new Error("Missing freshly validated billing event after checkout creation.");
      await base44.asServiceRole.entities.OrganizationBillingEvent.update(
        event.id,
        {
          event_status: "ready_for_checkout",
          stripe_checkout_session_id: session.id,
          notes:
            "Included in a CE Training cohort invoice checkout. Payment remains unsettled until Stripe confirms the parent invoice payment.",
        },
      );
    }
  } catch (error) {
    console.error("Persisted Stripe checkout but failed to update all cohort invoice records:", error);
    throw fail(409, "Checkout was created, but the invoice records need reconciliation before the checkout link can be shown. Retry later or contact support.");
  }

  return {
    ok: true,
    paid: false,
    checkout_created: true,
    reused_existing_checkout: false,
    cohort_invoice_id: invoice.id,
    invoice_status: "ready_for_checkout",
    checkout_session_id: session.id,
    checkout_url: session.url,
    amount_cents: Number(invoice.amount_cents),
    currency: text(invoice.currency).toUpperCase(),
    student_count: Number(invoice.student_count),
    message:
      "CE Training cohort invoice checkout is ready. No CE student access or enrollment is granted until Stripe confirms the full invoice payment.",
  };
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      throw fail(405, "Use POST to create or resume a CE Training cohort invoice checkout.");
    }

    if (!stripe) {
      throw fail(
        500,
        "Stripe is not configured for CE Training cohort invoice checkout.",
      );
    }

    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me();

    if (!caller) {
      return Response.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const cohortId = text(body?.cohort_id);
    const requestedCohortInvoiceId = text(
      body?.cohort_invoice_id
    );

    if (
      requestedCohortInvoiceId &&
      Array.isArray(body?.billing_event_ids) &&
      body.billing_event_ids.length > 0
    ) {
      throw fail(
        400,
        "Provide either cohort_invoice_id to resume one saved invoice or billing_event_ids to create a new invoice, not both."
      );
    }

    const requestedEventIds = requestedCohortInvoiceId
      ? []
      : selectedIds(body?.billing_event_ids);

    if (!cohortId) {
      throw fail(400, "cohort_id is required.");
    }
    const callerRecord = await getCallerRecord(base44, caller);
    const callerRole = text(callerRecord?.role).toLowerCase();
    const callerEmail = email(callerRecord?.email);
    const organizationId = text(callerRecord?.org_id);
    await getOrganization(base44, organizationId);

    await assertAuthorization(
      base44,
      callerRecord,
      callerRole,
      organizationId,
      cohortId,
    );

    const [cohortRows, inviteRows, eventRows, invoiceRows, lineRows, enrollmentRows] =
      await Promise.all([
        base44.asServiceRole.entities.CETrainingCohort.filter({
          id: cohortId,
        }),
        base44.asServiceRole.entities.PendingRoleAssignment.filter({
          org_id: organizationId,
          role: "ce_student",
          cohort_id: cohortId,
        }),
        base44.asServiceRole.entities.OrganizationBillingEvent.filter({
          organization_id: organizationId,
          cohort_id: cohortId,
        }),
        base44.asServiceRole.entities.CETrainingCohortInvoice.filter({
          organization_id: organizationId,
          cohort_id: cohortId,
        }),
        base44.asServiceRole.entities.CETrainingCohortInvoiceLine.filter({
          organization_id: organizationId,
          cohort_id: cohortId,
        }),
        base44.asServiceRole.entities.CETrainingStudentEnrollment.filter({
          org_id: organizationId,
          cohort_id: cohortId,
        }),
      ]);

    const cohort = Array.isArray(cohortRows) ? cohortRows[0] : null;

    if (!cohort) {
      throw fail(
        404,
        "The requested CE Training cohort was not found.",
      );
    }

    if (text(cohort.org_id) !== organizationId) {
      throw fail(
        403,
        "The requested CE Training cohort belongs to a different organization.",
      );
    }

    if (text(cohort.cohort_type) !== "training") {
      throw fail(
        409,
        "Only Training cohorts may create CE registration invoices.",
      );
    }

    if (!active(cohort)) {
      throw fail(
        409,
        "This Training cohort is inactive or archived and cannot create a new registration invoice.",
      );
    }

    const invites = Array.isArray(inviteRows) ? inviteRows : [];
    const events = Array.isArray(eventRows) ? eventRows : [];
    const invoices = Array.isArray(invoiceRows) ? invoiceRows : [];
    const lines = Array.isArray(lineRows) ? lineRows : [];
    const enrollments = Array.isArray(enrollmentRows) ? enrollmentRows : [];

    const inviteById = new Map(
      invites.map((invite) => [text(invite.id), invite]),
    );

    const eventById = new Map(
      events.map((event) => [text(event.id), event]),
    );

    const enrollmentByEventId = new Map<string, any[]>();
    for (const enrollment of enrollments) {
      const eventId = text(enrollment.organization_billing_event_id);
      if (!eventId) continue;
      if (!enrollmentByEventId.has(eventId)) enrollmentByEventId.set(eventId, []);
      enrollmentByEventId.get(eventId)?.push(enrollment);
    }

      const invoiceById = new Map(
      invoices.map((invoice) => [text(invoice.id), invoice]),
    );

    if (requestedCohortInvoiceId) {
      const requestedInvoice = invoiceById.get(
        requestedCohortInvoiceId
      );

      if (!requestedInvoice) {
        throw fail(
          404,
          "The requested CE Training cohort invoice was not found for this organization and cohort."
        );
      }

      const requestedInvoiceLines = linesForInvoice(
        lines,
        requestedCohortInvoiceId
      );

      if (!requestedInvoiceLines.length) {
        throw fail(
          409,
          "The requested CE Training cohort invoice has no saved student lines and cannot be resumed."
        );
      }

      return Response.json(
        await ensureCheckout({
          base44,
          invoice: requestedInvoice,
          lines: requestedInvoiceLines,
          organizationId,
          cohort,
          callerEmail,
          inviteById,
          eventById,
            enrollmentByEventId,
        })
      );
    }

    const attachedRequestedLines = lines.filter(
      (line) =>
        requestedEventIds.includes(
          text(line.organization_billing_event_id),
        ) &&
        ["included", "paid"].includes(text(line.line_status)),
    );

    if (attachedRequestedLines.length) {
      const attachedEventIds = new Set(
        attachedRequestedLines.map((line) =>
          text(line.organization_billing_event_id),
        ),
      );

      const attachedInvoiceIds = new Set(
        attachedRequestedLines.map((line) =>
          text(line.cohort_invoice_id),
        ),
      );

      if (
        attachedEventIds.size !== requestedEventIds.length ||
        attachedInvoiceIds.size !== 1
      ) {
        throw fail(
          409,
          "One or more selected CE registrations are already attached to a different cohort invoice. Select one complete existing invoice or choose only registrations that are not yet invoiced.",
        );
      }

      const existingInvoiceId = Array.from(attachedInvoiceIds)[0];
      const existingInvoice = invoiceById.get(existingInvoiceId);

      const existingLines = linesForInvoice(
        lines,
        existingInvoiceId,
      );

      if (!existingInvoice) {
        throw fail(
          409,
          "A selected CE registration is attached to a cohort invoice that could not be found.",
        );
      }

      assertExactInvoiceSelection(
        existingLines,
        requestedEventIds,
      );

      return Response.json(
        await ensureCheckout({
          base44,
          invoice: existingInvoice,
          lines: existingLines,
          organizationId,
          cohort,
          callerEmail,
          inviteById,
          eventById,
          enrollmentByEventId,
        }),
      );
    }

    const registrationEvents = events.filter(
      (event) =>
        REGISTRATION_FEE_KINDS.has(text(event.fee_kind).toLowerCase()) &&
        text(event.billing_subject_type).toLowerCase() === "student",
    );

    const eventsByKey = new Map<string, any[]>();

    for (const event of registrationEvents) {
      const key = text(event.billing_event_key);

      if (!key) {
        continue;
      }

      if (!eventsByKey.has(key)) {
        eventsByKey.set(key, []);
      }

      eventsByKey.get(key)?.push(event);
    }

    const eligibleById = new Map<string, any>();

    for (const invite of invites) {
      if (
        !OPEN_ASSIGNMENT_STATUSES.has(text(invite.status)) ||
        text(invite.payment_responsibility) !== "instructor_paid" ||
        text(invite.instructor_payment_mode) !==
          "invoice_with_cohort"
      ) {
        continue;
      }

      const studentEmail = email(invite.email);

      const matches =
        eventsByKey.get(
          registrationEventKey(organizationId, studentEmail),
        ) || [];

      if (!studentEmail || matches.length !== 1) {
        continue;
      }

      const event = matches[0];
      const amountCents = Number(event.amount_cents);
      const currency = text(event.currency).toLowerCase();

      const linkedEnrollments = enrollmentByEventId.get(text(event.id)) || [];
      const enrollment = linkedEnrollments[0];
      const validEnrollment = linkedEnrollments.length === 1 &&
        active(enrollment) &&
        PRE_SETTLEMENT_ENROLLMENT_STATUSES.has(text(enrollment.enrollment_status).toLowerCase()) &&
        text(enrollment.org_id) === organizationId &&
        text(enrollment.cohort_id) === cohortId &&
        email(enrollment.student_email) === studentEmail &&
        text(enrollment.pending_role_assignment_id) === text(invite.id) &&
        text(enrollment.organization_billing_event_id) === text(event.id) &&
        text(enrollment.payment_responsibility).toLowerCase() === "instructor_paid" &&
        text(enrollment.instructor_payment_mode).toLowerCase() === "invoice_with_cohort";

      const valid =
        validEnrollment &&
        text(event.organization_id) === organizationId &&
        text(event.cohort_id) === cohortId &&
        REGISTRATION_FEE_KINDS.has(text(event.fee_kind)) &&
        event.billing_subject_type === "student" &&
        email(event.subject_verified_email) === studentEmail &&
        text(event.event_status).toLowerCase() === "pending" &&
        Number.isInteger(amountCents) &&
        amountCents > 0 &&
        !!currency;

      if (valid) {
        eligibleById.set(text(event.id), {
          invite,
          event,
          studentEmail,
          amountCents,
          currency,
        });
      }
    }

    const selected = requestedEventIds.map((id) =>
      eligibleById.get(id),
    );

    if (selected.some((candidate) => !candidate)) {
      throw fail(
        409,
        "One or more selected CE registrations are not currently eligible for a new cohort invoice. Refresh the invoice preview and try again.",
      );
    }

    const currencies = new Set(
      selected.map((candidate) => candidate.currency),
    );

    if (currencies.size !== 1) {
      throw fail(
        409,
        "A cohort invoice may contain only one currency. Split the selected registrations by currency before checkout.",
      );
    }

    const totalCents = selected.reduce(
      (total, candidate) => total + candidate.amountCents,
      0,
    );

    if (!Number.isInteger(totalCents) || totalCents <= 0) {
      throw fail(
        409,
        "The selected CE registrations do not produce a valid positive cohort invoice total.",
      );
    }

    const stableInvoiceKey = await invoiceKey(
      organizationId,
      cohortId,
      requestedEventIds,
    );

    const matchingInvoices = invoices.filter(
      (invoice) => text(invoice.invoice_key) === stableInvoiceKey,
    );

    if (matchingInvoices.length > 1) {
      throw fail(
        409,
        "Multiple cohort invoices share the same selected registration batch. Resolve the duplicate invoice records before attempting checkout.",
      );
    }

    let invoice = matchingInvoices[0] || null;

    if (invoice) {
      const savedLines = linesForInvoice(lines, text(invoice.id));

      if (savedLines.length) {
        assertExactInvoiceSelection(
          savedLines,
          requestedEventIds,
        );

        return Response.json(
          await ensureCheckout({
            base44,
            invoice,
            lines: savedLines,
            organizationId,
            cohort,
            callerEmail,
            inviteById,
            eventById,
            enrollmentByEventId,
          }),
        );
      }

      if (text(invoice.invoice_status) !== "draft") {
        throw fail(
          409,
          "The saved cohort invoice is incomplete and cannot safely create another checkout session.",
        );
      }
    } else {
      invoice =
        await base44.asServiceRole.entities.CETrainingCohortInvoice.create(
          {
            organization_id: organizationId,
            cohort_id: cohortId,
            invoice_key: stableInvoiceKey,
            invoice_status: "draft",
            currency: Array.from(currencies)[0].toUpperCase(),
            student_count: selected.length,
            amount_cents: totalCents,
            created_by_user_id: callerRecord.id,
            notes:
              "Draft CE Training cohort invoice created from selected locked student registration events.",
          },
        );
    }

    const invoiceId = text(invoice?.id);

    if (!invoiceId) {
      throw fail(
        500,
        "The CE Training cohort invoice could not be created safely.",
      );
    }

    const createdLines = [];

    for (const candidate of selected) {
      const line =
        await base44.asServiceRole.entities.CETrainingCohortInvoiceLine.create(
          {
            organization_id: organizationId,
            cohort_id: cohortId,
            cohort_invoice_id: invoiceId,
            invoice_line_key: `ce_training_cohort_invoice_line:${invoiceId}:${candidate.event.id}`,
            organization_billing_event_id: candidate.event.id,
            pending_role_assignment_id: candidate.invite.id,
            subject_verified_email: candidate.studentEmail,
            amount_cents: candidate.amountCents,
            currency: candidate.currency.toUpperCase(),
            line_status: "included",
            notes:
              "Locked CE student registration included in a cohort invoice before payment settlement.",
          },
        );

      createdLines.push(line);
    }

    assertExactInvoiceSelection(createdLines, requestedEventIds);

    return Response.json(
      await ensureCheckout({
        base44,
        invoice,
        lines: createdLines,
        organizationId,
        cohort,
        callerEmail,
        inviteById,
        eventById,
        enrollmentByEventId,
      }),
    );
  } catch (error) {
    console.error(
      "createCETrainingCohortInvoiceCheckout error:",
      error?.message || error,
    );

    return Response.json(
      {
        ok: false,
        error: publicError(error),
      },
      {
        status:
          Number(
            (error as Error & { status?: number })?.status,
          ) || 500,
      },
    );
  }
});
