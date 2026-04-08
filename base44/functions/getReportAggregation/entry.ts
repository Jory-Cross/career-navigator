import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * getReportAggregation
 *
 * Mode 1: report_assembly
 *   Builds structured report output for PDF generation
 *   Returns: { header, rows, summary, totals, included_time_entry_ids, included_answer_ids, metadata }
 *   Supports: usor96_monthly, usor95_monthly, usor148_service_period
 *
 * Mode 2: stats
 *   Dashboard-style aggregation for analytics
 *   Returns: { total_entries, total_hours, by_month, by_entry_type, authorizations }
 *
 * ⚠️ READONLY: Never modifies TimeEntry or ReportFieldAnswer records
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, client_id, entry_type_code, date_from, date_to, report_mode, year, month } = body;

    if (!action) return Response.json({ error: 'Missing action' }, { status: 400 });

    // ── MODE 1: report_assembly ────────────────────────────────────────────────
    if (action === 'assemble_report') {
      if (!client_id)   return Response.json({ error: 'client_id required' }, { status: 400 });
      if (!date_from)   return Response.json({ error: 'date_from required' }, { status: 400 });
      if (!date_to)     return Response.json({ error: 'date_to required' }, { status: 400 });
      if (!report_mode) return Response.json({ error: 'report_mode required' }, { status: 400 });

      const result = await assembleReportMode(base44, {
        client_id, entry_type_code, date_from, date_to, report_mode
      });

      if (result.error) {
        return Response.json({ error: result.error }, { status: result.status || 400 });
      }

      return Response.json({
        success: true,
        action: 'assemble_report',
        report_mode,
        data: result
      });
    }

    // ── MODE 2: stats (dashboard analytics) ────────────────────────────────────
    if (action === 'stats') {
      const filters = {
        status: { $ne: 'void' }  // Exclude voided entries
      };
      if (client_id) filters.client_id = client_id;
      if (entry_type_code) filters.entry_type_code = entry_type_code;

      const [timeEntries, authorizations] = await Promise.all([
        base44.entities.TimeEntry.filter(filters),
        client_id ? base44.entities.ServiceAuthorization.filter({ client_id }) : Promise.resolve([])
      ]);

      // Apply optional date range filter
      const filtered = timeEntries.filter(e => {
        if (date_from && e.date < date_from) return false;
        if (date_to   && e.date > date_to)   return false;
        if (year && month) {
          const monthStr = `${year}-${String(month).padStart(2, '0')}`;
          if (!e.date.startsWith(monthStr)) return false;
        }
        return true;
      });

      const stats = buildStats(filtered, authorizations);
      return Response.json({ success: true, action: 'stats', data: stats });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });

  } catch (error) {
    console.error('getReportAggregation error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// ─── MODE 1: Report Assembly (PDF Preparation) ───────────────────────────────

/**
 * Assemble structured report with filtered queries
 * Never modifies source records
 */
async function assembleReportMode(base44, options) {
  const { client_id, entry_type_code, date_from, date_to, report_mode } = options;

  try {
    // Fetch client (required)
    const clients = await base44.entities.Client.filter({ id: client_id });
    const client = clients[0] || null;
    if (!client) {
      return { error: 'Client not found', status: 404 };
    }

    // Fetch time entries with filtered query
    // Use entry_type_code to scope which types are included
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

    // Fetch ReportFieldAnswer records scoped to entry type
    const answerFilters = { entry_type_code: entry_type_code || '' };
    const allAnswers = await base44.entities.ReportFieldAnswer.filter(answerFilters);

    // Build answers map keyed by time_entry_id
    const answersMap = {};
    allAnswers.forEach(a => {
      answersMap[a.time_entry_id] = a;
    });

    // Fetch authorizations for header/summary
    const authorizations = await base44.entities.ServiceAuthorization.filter({ client_id });
    const authMap = {};
    authorizations.forEach(a => {
      authMap[a.id] = a;
    });

    // Assemble using report mode
    const header = buildReportHeader(client, entries, authMap, date_from, date_to);
    const { rows, groups } = buildReportRows(report_mode, entries, answersMap);
    const summary = buildReportSummary(entries, answersMap, authMap);
    const totals = buildReportTotals(entries);

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
        report_period_start: date_from,
        report_period_end: date_to,
        total_entries: entries.length,
        total_answers_captured: included_answer_ids.length,
        generated_at: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('assembleReportMode error:', error.message);
    return { error: error.message, status: 500 };
  }
}

/**
 * Build report header with client and authorization metadata
 */
function buildReportHeader(client, entries, authMap, date_from, date_to) {
  // Find primary authorization (first active matching period)
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

/**
 * Build report rows based on report mode
 * Supports: usor96_monthly, usor95_monthly, usor148_service_period
 */
function buildReportRows(report_mode, entries, answersMap) {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));

  if (report_mode === 'usor148_service_period') {
    // Group by entry_type_code for service period reports
    return buildServicePeriodGrouping(sorted, answersMap);
  } else if (report_mode === 'usor95_monthly') {
    // Group by employer + month
    return buildEmployerMonthlyGrouping(sorted, answersMap);
  } else {
    // Default: usor96_monthly — flat rows by month
    return buildMonthlyFlat(sorted, answersMap);
  }
}

/**
 * USOR96 Monthly: Simple flat row structure
 */
function buildMonthlyFlat(entries, answersMap) {
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
      entry_type_name: entry.entry_type_name || '',
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
function buildEmployerMonthlyGrouping(entries, answersMap) {
  const groups = {};

  entries.forEach(entry => {
    const answers = answersMap[entry.id]?.answers || {};
    const employer = answers.employer_name || 'Unknown Employer';
    const month = entry.date.substring(0, 7);
    const groupKey = `${employer}|${month}`;

    if (!groups[groupKey]) {
      groups[groupKey] = {
        employer,
        month,
        entries: []
      };
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

  // Flatten for row structure
  let rowNumber = 1;
  const rows = [];
  Object.values(groups).forEach(group => {
    group.entries.forEach(row => {
      rows.push({ ...row, row_number: rowNumber++, employer: group.employer, month: group.month });
    });
  });

  return { rows, groups: Object.values(groups) };
}

/**
 * USOR148 Service Period: Group by entry_type_code
 */
function buildServicePeriodGrouping(entries, answersMap) {
  const groups = {};

  entries.forEach(entry => {
    const code = entry.entry_type_code || 'other';
    if (!groups[code]) {
      groups[code] = {
        entry_type_code: code,
        entries: []
      };
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
      row_count: group.entries.length
    };
  });

  return { rows, groups: groupsArray };
}

/**
 * Build summary aggregations by entry type and authorization
 */
function buildReportSummary(entries, answersMap, authMap) {
  const byType = {};
  const byEmployer = {};

  entries.forEach(entry => {
    const code = entry.entry_type_code || 'other';
    if (!byType[code]) byType[code] = { count: 0, total_minutes: 0, entry_ids: [] };
    byType[code].count++;
    byType[code].total_minutes += entry.duration_minutes || 0;
    byType[code].entry_ids.push(entry.id);

    const answers = answersMap[entry.id]?.answers || {};
    const employer = answers.employer_name || 'Unknown';
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

/**
 * Build totals for report footer
 */
function buildReportTotals(entries) {
  const totalMinutes = entries.reduce((s, e) => s + (e.duration_minutes || 0), 0);
  return {
    entry_count: entries.length,
    total_minutes: totalMinutes,
    total_hours: roundHours(totalMinutes)
  };
}

// ─── Lightweight Stats ────────────────────────────────────────────────────────

function buildStats(entries, authorizations) {
  const totalMinutes = entries.reduce((s, e) => s + (e.duration_minutes || 0), 0);

  const byMonth = {};
  const byType  = {};
  entries.forEach(e => {
    const m = e.date.substring(0, 7);
    if (!byMonth[m]) byMonth[m] = { count: 0, total_minutes: 0 };
    byMonth[m].count++;
    byMonth[m].total_minutes += e.duration_minutes || 0;

    const t = e.entry_type_code || 'other';
    if (!byType[t]) byType[t] = { count: 0, total_minutes: 0 };
    byType[t].count++;
    byType[t].total_minutes += e.duration_minutes || 0;
  });

  const normalizeHours = obj =>
    Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, { ...v, total_hours: roundHours(v.total_minutes) }])
    );

  const authSummary = authorizations.map(a => ({
    id:                     a.id,
    authorization_number:   a.authorization_number,
    entry_type_code:        a.entry_type_code,
    total_authorized_hours: a.total_authorized_hours,
    used_hours:             a.used_hours       || 0,
    remaining_hours:        a.remaining_hours  || (a.total_authorized_hours - (a.used_hours || 0)),
    status:                 a.status
  }));

  return {
    total_entries:  entries.length,
    total_hours:    roundHours(totalMinutes),
    by_month:       normalizeHours(byMonth),
    by_entry_type:  normalizeHours(byType),
    authorizations: authSummary
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function roundHours(minutes) {
  return Math.round(((minutes || 0) / 60) * 100) / 100;
}