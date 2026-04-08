/**
 * VR Report Assembly Layer
 * Transforms source records into immutable structured report output
 * 
 * Inputs: TimeEntry, ReportFieldAnswer, Client, EntryType, ServiceAuthorization
 * Output: Structured AssembledReport with header, rows, summary, totals, metadata, audit trail
 * 
 * ⚠️ READONLY: Never writes back to TimeEntry or ReportFieldAnswer
 */

/**
 * Assemble a single client report with full audit trail
 * 
 * Grouping rules:
 *   - usor96_monthly: by client + month/year (all entry types)
 *   - usor95_monthly: by client + employer + month/year (job_coaching type)
 *   - usor148_service_period: by client + entry_type + date range
 */
export async function assembleClientReport(base44, clientId, dateFrom, dateTo, options = {}) {
  const {
    reportMode = 'usor95_monthly',  // usor95_monthly | usor96_monthly | usor148_service_period
    entryTypeCode = null,
    includeAuthorization = true,
    clientData = null,
    entryTypeData = null
  } = options;

  try {
    // Fetch source records (read-only)
    const [client, timeEntries, fieldAnswers, entryTypes, authorizations] = await Promise.all([
      clientData || fetchClient(base44, clientId),
      fetchTimeEntries(base44, clientId, dateFrom, dateTo, entryTypeCode),
      fetchReportFieldAnswers(base44, entryTypeCode),
      entryTypeData || fetchEntryTypes(base44),
      includeAuthorization ? fetchServiceAuthorizations(base44, clientId) : Promise.resolve([])
    ]);

    if (!client) {
      throw new Error(`Client ${clientId} not found`);
    }

    if (timeEntries.length === 0) {
      return null; // No data to report
    }

    // Build maps for fast lookup
    const answersMap = {};
    fieldAnswers.forEach(fa => {
      answersMap[fa.time_entry_id] = fa;
    });

    const entryTypeMap = {};
    entryTypes.forEach(et => {
      entryTypeMap[et.code] = et;
    });

    // Match entries to authorizations by entry_type_code and date range
    const authMap = {};
    authorizations.forEach(a => {
      authMap[a.id] = a;
    });

    // Assemble report using grouping rules for each report mode
    const assembled = assembleByMode(
      reportMode,
      client,
      timeEntries,
      answersMap,
      entryTypeMap,
      authMap,
      dateFrom,
      dateTo
    );

    return assembled;
  } catch (error) {
    console.error(`assembleClientReport error for ${clientId}:`, error);
    throw error;
  }
}

/**
 * Assemble batch reports for multiple clients
 * Returns array of immutable assembled report objects
 */
export async function assembleClientReports(base44, clientIds, dateFrom, dateTo, options = {}) {
  const reports = [];

  for (const clientId of clientIds) {
    try {
      const report = await assembleClientReport(base44, clientId, dateFrom, dateTo, options);
      if (report) {
        reports.push(report);
      }
    } catch (error) {
      console.error(`Failed to assemble report for client ${clientId}:`, error);
      // Continue with next client
    }
  }

  return reports;
}

/**
 * Assemble report by mode with appropriate grouping rules
 */
function assembleByMode(reportMode, client, timeEntries, answersMap, entryTypeMap, authMap, dateFrom, dateTo) {
  const clientId = client.id;
  const generatedAt = new Date().toISOString();

  // Determine grouping based on report mode
  let groups = [];
  
  if (reportMode === 'usor95_monthly') {
    // Group by client + employer + month/year
    groups = groupByEmployerAndMonth(timeEntries, answersMap);
  } else if (reportMode === 'usor96_monthly') {
    // Group by client + month/year (all types)
    groups = groupByMonth(timeEntries, answersMap);
  } else if (reportMode === 'usor148_service_period') {
    // Group by client + entry_type + date range
    groups = groupByEntryType(timeEntries, answersMap);
  }

  // Build header (shared across all groups)
  const header = buildReportHeader(client, timeEntries, entryTypeMap, authMap, dateFrom, dateTo);

  // Build rows and summaries for each group
  const rows = buildReportRows(timeEntries, answersMap, entryTypeMap, authMap);
  const summary = buildReportSummary(timeEntries, answersMap, entryTypeMap, authMap);
  const totals = buildReportTotals(timeEntries);

  // Audit trail: which source records are included
  const included_time_entry_ids = timeEntries.map(e => e.id);
  const included_answer_ids = timeEntries.map(e => answersMap[e.id]?.id).filter(Boolean);

  return {
    // Immutable structured output
    metadata: {
      client_id: clientId,
      report_mode: reportMode,
      generated_at: generatedAt,
      reporting_period_start: dateFrom,
      reporting_period_end: dateTo,
      total_entries: timeEntries.length,
      total_answers_captured: included_answer_ids.length,
      groups_count: groups.length
    },
    header,
    rows,
    summary,
    totals,
    groups,
    // Audit trail for GeneratedReport.included_* fields
    included_time_entry_ids,
    included_answer_ids
  };
}

/**
 * Build report header with client and authorization metadata
 */
function buildReportHeader(client, timeEntries, entryTypeMap, authMap, dateFrom, dateTo) {
  const dateRange = getDateRange(timeEntries);
  
  // Find primary authorization (first active matching entry type)
  let primaryAuth = null;
  if (timeEntries.length > 0) {
    const firstEntry = timeEntries[0];
    primaryAuth = Object.values(authMap).find(a =>
      a.status === 'active' &&
      a.entry_type_code === firstEntry.entry_type_code &&
      a.service_start_date <= dateFrom &&
      a.service_end_date >= dateTo
    );
  }

  return {
    // Client info
    client_id: client.id,
    client_first_name: client.first_name || '',
    client_last_name: client.last_name || '',
    client_full_name: `${client.first_name || ''} ${client.last_name || ''}`.trim(),
    client_email: client.email || '',
    client_phone: client.phone || '',
    client_address: client.address || '',
    client_type: client.client_type || '',

    // Period
    reporting_period_start: dateFrom,
    reporting_period_end: dateTo,
    actual_period_start: dateRange.start,
    actual_period_end: dateRange.end,
    reporting_month: getReportingMonth(dateRange.start),

    // Entry totals
    total_entries: timeEntries.length,
    total_minutes: getTotalMinutes(timeEntries),
    total_hours: getTotalHours(timeEntries),

    // Authorization data
    authorization_number: primaryAuth?.authorization_number || '',
    vr_counselor_name: primaryAuth?.vr_counselor_name || '',
    vr_counselor_email: primaryAuth?.vr_counselor_email || '',
    job_goal: primaryAuth?.job_goal || client.target_role || '',
    employer_name: primaryAuth?.employer_name || client.workplace_name || '',
    total_authorized_hours: primaryAuth?.total_authorized_hours || 0,
    hours_used: primaryAuth?.used_hours || 0,
    hours_remaining: primaryAuth?.remaining_hours || 0,

    // Metadata
    report_generated_date: new Date().toISOString().split('T')[0]
  };
}

/**
 * Build repeating row data (one row per time entry, sorted by date)
 */
function buildReportRows(timeEntries, answersMap, entryTypeMap, authMap) {
  return [...timeEntries]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((entry, index) => {
      const fieldAnswer = answersMap[entry.id];
      const answers = fieldAnswer?.answers || {};
      const entryType = entryTypeMap[entry.entry_type_code];

      return {
        // Row identifier
        row_number: index + 1,
        time_entry_id: entry.id,

        // Core time entry data
        date: entry.date,
        duration_minutes: entry.duration_minutes || 0,
        duration_hours: roundHours(entry.duration_minutes),
        start_time: entry.start_time || '',
        end_time: entry.end_time || '',

        // Entry classification
        entry_type_id: entry.entry_type_id || '',
        entry_type_code: entry.entry_type_code || '',
        entry_type_name: entryType?.name || '',
        description: entry.description || '',

        // Notes (internal only)
        general_notes: entry.general_notes || '',

        // Dynamic report field answers from ReportFieldAnswer.answers
        ...answers,

        // Authorization reference
        service_authorization_id: entry.service_authorization_id || '',
        authorization_valid: entry.service_authorization_id ? !!authMap[entry.service_authorization_id] : null,

        // Report ready flag (indicates if all required fields are complete)
        report_ready: entry.report_ready || false
      };
    });
}

/**
 * Build summary aggregations
 */
function buildReportSummary(timeEntries, answersMap, entryTypeMap, authMap) {
  const byEntryType = {};
  const byEmployer = {};
  const fieldTotals = {};
  let totalMinutes = 0;

  timeEntries.forEach(entry => {
    const fieldAnswer = answersMap[entry.id];
    const answers = fieldAnswer?.answers || {};

    // Aggregate by entry type code
    const typeKey = entry.entry_type_code || 'unknown';
    if (!byEntryType[typeKey]) {
      byEntryType[typeKey] = { count: 0, total_minutes: 0, entry_ids: [] };
    }
    byEntryType[typeKey].count++;
    byEntryType[typeKey].total_minutes += entry.duration_minutes || 0;
    byEntryType[typeKey].entry_ids.push(entry.id);

    // Aggregate by employer (from field answers)
    const employer = answers.employer_name || 'Unknown';
    if (!byEmployer[employer]) {
      byEmployer[employer] = { count: 0, total_minutes: 0, entry_ids: [] };
    }
    byEmployer[employer].count++;
    byEmployer[employer].total_minutes += entry.duration_minutes || 0;
    byEmployer[employer].entry_ids.push(entry.id);

    // Aggregate numeric field answers
    Object.entries(answers).forEach(([key, value]) => {
      const numValue = parseFloat(value);
      if (!isNaN(numValue)) {
        if (!fieldTotals[key]) {
          fieldTotals[key] = { sum: 0, count: 0 };
        }
        fieldTotals[key].sum += numValue;
        fieldTotals[key].count++;
      }
    });

    totalMinutes += entry.duration_minutes || 0;
  });

  return {
    total_entries: timeEntries.length,
    total_minutes: totalMinutes,
    total_hours: roundHours(totalMinutes),
    average_hours_per_entry: roundHours(totalMinutes / Math.max(timeEntries.length, 1)),
    by_entry_type: Object.fromEntries(
      Object.entries(byEntryType).map(([k, v]) => [k, {
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
        total_hours: roundHours(v.total_minutes),
        entry_ids: v.entry_ids
      }])
    ),
    field_totals: Object.fromEntries(
      Object.entries(fieldTotals).map(([k, v]) => [k, {
        sum: v.sum,
        count: v.count,
        average: roundHours(v.sum / v.count)
      }])
    )
  };
}

/**
 * Build totals aggregation
 */
function buildReportTotals(timeEntries) {
  const totalMinutes = getTotalMinutes(timeEntries);
  return {
    entry_count: timeEntries.length,
    total_minutes: totalMinutes,
    total_hours: roundHours(totalMinutes)
  };
}

/**
 * Group entries by employer + month/year (USOR95)
 */
function groupByEmployerAndMonth(timeEntries, answersMap) {
  const groups = {};

  timeEntries.forEach(entry => {
    const fieldAnswer = answersMap[entry.id];
    const answers = fieldAnswer?.answers || {};
    const employer = answers.employer_name || 'Unknown';
    const monthKey = entry.date.substring(0, 7); // YYYY-MM

    const groupKey = `${employer}|${monthKey}`;
    if (!groups[groupKey]) {
      groups[groupKey] = {
        employer,
        month: monthKey,
        entries: []
      };
    }
    groups[groupKey].entries.push(entry);
  });

  return Object.values(groups);
}

/**
 * Group entries by month/year (USOR96 - all types)
 */
function groupByMonth(timeEntries, answersMap) {
  const groups = {};

  timeEntries.forEach(entry => {
    const monthKey = entry.date.substring(0, 7); // YYYY-MM

    if (!groups[monthKey]) {
      groups[monthKey] = {
        month: monthKey,
        entries: []
      };
    }
    groups[monthKey].entries.push(entry);
  });

  return Object.values(groups);
}

/**
 * Group entries by entry_type (USOR148 service period)
 */
function groupByEntryType(timeEntries, answersMap) {
  const groups = {};

  timeEntries.forEach(entry => {
    const typeCode = entry.entry_type_code || 'unknown';

    if (!groups[typeCode]) {
      groups[typeCode] = {
        entry_type_code: typeCode,
        entries: []
      };
    }
    groups[typeCode].entries.push(entry);
  });

  return Object.values(groups);
}

/**
 * Helper: Get date range from entries
 */
function getDateRange(timeEntries) {
  if (timeEntries.length === 0) {
    return { start: '', end: '' };
  }

  const sorted = [...timeEntries].sort((a, b) => a.date.localeCompare(b.date));
  return {
    start: sorted[0].date,
    end: sorted[sorted.length - 1].date
  };
}

/**
 * Helper: Get total minutes
 */
function getTotalMinutes(timeEntries) {
  return timeEntries.reduce((sum, e) => sum + (e.duration_minutes || 0), 0);
}

/**
 * Helper: Get total hours
 */
function getTotalHours(timeEntries) {
  return roundHours(getTotalMinutes(timeEntries));
}

/**
 * Helper: Get reporting month
 */
function getReportingMonth(dateStr) {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  } catch {
    return '';
  }
}

/**
 * Fetch helpers (read-only, never write back)
 */
async function fetchClient(base44, clientId) {
  const clients = await base44.entities.Client.filter({ id: clientId });
  return clients[0] || null;
}

async function fetchTimeEntries(base44, clientId, dateFrom, dateTo, entryTypeCode) {
  const query = {
    client_id: clientId,
    status: { $ne: 'void' }
  };

  if (entryTypeCode) {
    query.entry_type_code = entryTypeCode;
  }

  const entries = await base44.entities.TimeEntry.filter(query);
  
  // Filter by date range
  return entries.filter(e => e.date >= dateFrom && e.date <= dateTo);
}

async function fetchReportFieldAnswers(base44, entryTypeCode) {
  const query = entryTypeCode ? { entry_type_code: entryTypeCode } : {};
  return await base44.entities.ReportFieldAnswer.filter(query);
}

async function fetchEntryTypes(base44) {
  return await base44.entities.EntryType.filter({ is_active: true });
}

async function fetchServiceAuthorizations(base44, clientId) {
  return await base44.entities.ServiceAuthorization.filter({ 
    client_id: clientId,
    status: 'active'
  });
}

/**
 * Helper: Round minutes to hours with 2 decimal precision
 */
function roundHours(minutes) {
  return Math.round(((minutes || 0) / 60) * 100) / 100;
}