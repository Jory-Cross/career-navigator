import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * assembleVRReportData
 *
 * Transform source records into report-ready data for Utah VR PDFs.
 * Reusable by: generatePDFReport, generateVRBatchReports, report previews.
 *
 * ⚠️ READONLY: Never modifies TimeEntry or ReportFieldAnswer records.
 * ⚠️ NO PDF GENERATION: Returns structured data only.
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { client_id, entry_type_code, date_from, date_to, pdf_template_id, report_mode } = body;

    // Validate required inputs
    if (!client_id)   return Response.json({ error: 'client_id required' }, { status: 400 });
    if (!date_from)   return Response.json({ error: 'date_from required' }, { status: 400 });
    if (!date_to)     return Response.json({ error: 'date_to required' }, { status: 400 });

    // Resolve report mode from template or explicit mode
    const resolvedMode = report_mode || (pdf_template_id ? await inferReportMode(base44, pdf_template_id) : 'usor96_monthly');

    // Core assembly
    const result = await assembleVRReportData(base44, {
      client_id,
      entry_type_code,
      date_from,
      date_to,
      report_mode: resolvedMode
    });

    if (result.error) {
      return Response.json({ error: result.error }, { status: result.status || 400 });
    }

    return Response.json({ success: true, data: result });

  } catch (error) {
    console.error('assembleVRReportData error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// ─── Core Assembly Logic ──────────────────────────────────────────────────────

/**
 * Assemble structured report data from source entities
 */
async function assembleVRReportData(base44, options) {
  const { client_id, entry_type_code, date_from, date_to, report_mode } = options;

  try {
    // Fetch client
    const clients = await base44.entities.Client.filter({ id: client_id });
    const client = clients[0] || null;
    if (!client) {
      return { error: 'Client not found', status: 404 };
    }

    // Fetch time entries with filtered query (no voided entries)
    const entryFilters = {
      client_id,
      status: { $ne: 'void' }
    };
    if (entry_type_code) {
      entryFilters.entry_type_code = entry_type_code;
    }

    const timeEntries = await base44.entities.TimeEntry.filter(entryFilters);

    // Filter by date range
    const entries = timeEntries.filter(e => e.date >= date_from && e.date <= date_to);

    if (entries.length === 0) {
      return { error: 'No entries found in period', status: 400 };
    }

    // Fetch ReportFieldAnswer records
    // Filter by entry_type_code to avoid loading irrelevant answers
    const answerFilters = {};
    if (entry_type_code) {
      answerFilters.entry_type_code = entry_type_code;
    }
    const allAnswers = await base44.entities.ReportFieldAnswer.filter(answerFilters);

    // Build answers map keyed by time_entry_id
    const answersMap = {};
    allAnswers.forEach(a => {
      answersMap[a.time_entry_id] = a;
    });

    // Fetch service authorizations for header/summary
    const authorizations = await base44.entities.ServiceAuthorization.filter({ client_id });
    const authMap = {};
    authorizations.forEach(a => {
      authMap[a.id] = a;
    });

    // Assemble based on report mode
    const header = buildVRHeader(client, entries, authMap, date_from, date_to);
    const { rows, groups } = buildVRRows(report_mode, entries, answersMap);
    const summary = buildVRSummary(entries, answersMap, authMap);
    const totals = buildVRTotals(entries);

    // Audit trail
    const included_time_entry_ids = entries.map(e => e.id);
    const included_answer_ids = entries.map(e => answersMap[e.id]?.id).filter(Boolean);

    return {
      header,
      rows,
      summary,
      totals,
      groups,
      included_time_entry_ids,
      included_answer_ids,
      metadata: {
        client_id,
        entry_type_code: entry_type_code || 'all',
        report_mode,
        reporting_period_start: date_from,
        reporting_period_end: date_to,
        total_entries: entries.length,
        total_answers_captured: included_answer_ids.length,
        assembled_at: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('assembleVRReportData core error:', error.message);
    return { error: error.message, status: 500 };
  }
}

// ─── Helper: Infer Report Mode from Template ───────────────────────────────────

async function inferReportMode(base44, pdf_template_id) {
  try {
    const templates = await base44.entities.PDFTemplate.filter({ id: pdf_template_id });
    const template = templates[0];
    if (template?.report_mode) return template.report_mode;
  } catch (err) {
    console.warn('Could not infer report mode from template:', err.message);
  }
  return 'usor96_monthly'; // default
}

// ─── Header Builder ───────────────────────────────────────────────────────────

function buildVRHeader(client, entries, authMap, date_from, date_to) {
  // Find primary authorization
  const authIds = [...new Set(entries.map(e => e.service_authorization_id).filter(Boolean))];
  const primaryAuth = authIds.length ? authMap[authIds[0]] : null;

  return {
    client_id: client.id,
    client_first_name: client.first_name || '',
    client_last_name: client.last_name || '',
    client_full_name: `${client.first_name || ''} ${client.last_name || ''}`.trim(),
    client_email: client.email || '',
    client_phone: client.phone || '',
    client_address: client.address || '',
    reporting_period_start: date_from,
    reporting_period_end: date_to,
    authorization_number: primaryAuth?.authorization_number || '',
    vr_counselor_name: primaryAuth?.vr_counselor_name || '',
    vr_counselor_email: primaryAuth?.vr_counselor_email || '',
    job_goal: primaryAuth?.job_goal || client.target_role || '',
    employer_name: primaryAuth?.employer_name || client.workplace_name || '',
    total_authorized_hours: primaryAuth?.total_authorized_hours || 0,
    hours_used: primaryAuth?.used_hours || 0,
    hours_remaining: primaryAuth?.remaining_hours || 0,
    report_generated_date: new Date().toISOString().split('T')[0]
  };
}

// ─── Row Builder (Report Mode Dispatch) ────────────────────────────────────────

function buildVRRows(report_mode, entries, answersMap) {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));

  if (report_mode === 'usor148_service_period') {
    return buildServicePeriodRows(sorted, answersMap);
  } else if (report_mode === 'usor95_monthly') {
    return buildEmployerMonthlyRows(sorted, answersMap);
  } else {
    // usor96_monthly (default)
    return buildMonthlyRows(sorted, answersMap);
  }
}

/**
 * USOR96 Monthly: Flat row structure
 */
function buildMonthlyRows(entries, answersMap) {
  const rows = entries.map((entry, idx) => {
    const answers = answersMap[entry.id]?.answers || {};
    return {
      row_number: idx + 1,
      time_entry_id: entry.id,
      date: entry.date,
      start_time: entry.start_time || '',
      end_time: entry.end_time || '',
      duration_minutes: entry.duration_minutes || 0,
      duration_hours: roundHours(entry.duration_minutes),
      entry_type_code: entry.entry_type_code || '',
      description: entry.description || '',
      service_authorization_id: entry.service_authorization_id || '',
      report_ready: entry.report_ready || false,
      ...answers
    };
  });

  return { rows, groups: null };
}

/**
 * USOR95 Monthly: Group by employer + month
 */
function buildEmployerMonthlyRows(entries, answersMap) {
  const groups = {};

  entries.forEach(entry => {
    const answers = answersMap[entry.id]?.answers || {};
    const employer = answers.employer_name || entry.employer_name || 'Unknown Employer';
    const month = entry.date.substring(0, 7);
    const groupKey = `${employer}|${month}`;

    if (!groups[groupKey]) {
      groups[groupKey] = { employer, month, entries: [] };
    }

    groups[groupKey].entries.push({
      time_entry_id: entry.id,
      date: entry.date,
      start_time: entry.start_time || '',
      end_time: entry.end_time || '',
      duration_minutes: entry.duration_minutes || 0,
      duration_hours: roundHours(entry.duration_minutes),
      entry_type_code: entry.entry_type_code || '',
      description: entry.description || '',
      service_authorization_id: entry.service_authorization_id || '',
      ...answers
    });
  });

  // Flatten to row structure
  let rowNumber = 1;
  const rows = [];
  const groupsArray = Object.values(groups).map(group => {
    const groupRows = group.entries.map(row => ({
      ...row,
      row_number: rowNumber++,
      employer: group.employer,
      month: group.month
    }));
    rows.push(...groupRows);
    return {
      employer: group.employer,
      month: group.month,
      subtotal_minutes: group.entries.reduce((s, e) => s + (e.duration_minutes || 0), 0),
      subtotal_hours: roundHours(group.entries.reduce((s, e) => s + (e.duration_minutes || 0), 0)),
      entry_count: group.entries.length
    };
  });

  return { rows, groups: groupsArray };
}

/**
 * USOR148 Service Period: Group by entry_type_code
 */
function buildServicePeriodRows(entries, answersMap) {
  const groups = {};

  entries.forEach(entry => {
    const code = entry.entry_type_code || 'other';
    if (!groups[code]) {
      groups[code] = { entry_type_code: code, entries: [] };
    }
    groups[code].entries.push(entry);
  });

  // Flatten to row structure
  let rowNumber = 1;
  const rows = [];
  const groupsArray = Object.values(groups).map(group => {
    const groupRows = group.entries.map(entry => {
      const answers = answersMap[entry.id]?.answers || {};
      return {
        row_number: rowNumber++,
        time_entry_id: entry.id,
        date: entry.date,
        duration_minutes: entry.duration_minutes || 0,
        duration_hours: roundHours(entry.duration_minutes),
        entry_type_code: group.entry_type_code,
        description: entry.description || '',
        service_authorization_id: entry.service_authorization_id || '',
        ...answers
      };
    });
    rows.push(...groupRows);
    return {
      entry_type_code: group.entry_type_code,
      subtotal_minutes: group.entries.reduce((s, e) => s + (e.duration_minutes || 0), 0),
      subtotal_hours: roundHours(group.entries.reduce((s, e) => s + (e.duration_minutes || 0), 0)),
      entry_count: group.entries.length
    };
  });

  return { rows, groups: groupsArray };
}

// ─── Summary Builder ──────────────────────────────────────────────────────────

function buildVRSummary(entries, answersMap, authMap) {
  const byType = {};
  const byEmployer = {};

  entries.forEach(entry => {
    const code = entry.entry_type_code || 'other';
    if (!byType[code]) byType[code] = { count: 0, total_minutes: 0, entry_ids: [] };
    byType[code].count++;
    byType[code].total_minutes += entry.duration_minutes || 0;
    byType[code].entry_ids.push(entry.id);

    const answers = answersMap[entry.id]?.answers || {};
    const employer = answers.employer_name || entry.employer_name || 'Unknown';
    if (!byEmployer[employer]) byEmployer[employer] = { count: 0, total_minutes: 0 };
    byEmployer[employer].count++;
    byEmployer[employer].total_minutes += entry.duration_minutes || 0;
  });

  return {
    by_entry_type: Object.fromEntries(
      Object.entries(byType).map(([k, v]) => [k, {
        count: v.count,
        total_minutes: v.total_minutes,
        total_hours: roundHours(v.total_minutes),
        entry_ids: v.entry_ids
      }])
    ),
    by_employer: Object.fromEntries(
      Object.entries(byEmployer).map(([k, v]) => [k, {
        count: v.count,
        total_minutes: v.total_minutes,
        total_hours: roundHours(v.total_minutes)
      }])
    )
  };
}

// ─── Totals Builder ───────────────────────────────────────────────────────────

function buildVRTotals(entries) {
  const totalMinutes = entries.reduce((s, e) => s + (e.duration_minutes || 0), 0);
  return {
    entry_count: entries.length,
    total_minutes: totalMinutes,
    total_hours: roundHours(totalMinutes)
  };
}

// ─── Utilities ─────────────────────────────────────────────────────────────────

function roundHours(minutes) {
  return Math.round(((minutes || 0) / 60) * 100) / 100;
}