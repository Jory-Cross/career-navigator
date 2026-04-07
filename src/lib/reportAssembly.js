/**
 * VR Report Assembly
 * Step 2: Transform source records into structured report objects
 * 
 * Inputs: TimeEntry, ReportFieldAnswer, Client, ServiceAuthorization
 * Output: Structured report object with header, rows, summary (never writes back)
 */

/**
 * Assemble a single client report
 * Groups entries by entry_type, client, and period
 * Returns structured object ready for PDF filling
 */
export async function assembleClientReport(base44, clientId, dateFrom, dateTo, options = {}) {
  const {
    entryTypeId = null,
    entryTypeCode = null,
    groupByEmployer = false,
    includeAuthorization = true,
    clientData = null,
    authorizationData = null
  } = options;

  try {
    // Fetch source records
    const [client, timeEntries, fieldAnswers, authorizations] = await Promise.all([
      clientData || fetchClient(base44, clientId),
      fetchTimeEntries(base44, clientId, dateFrom, dateTo, entryTypeId, entryTypeCode),
      fetchReportFieldAnswers(base44),
      includeAuthorization ? fetchServiceAuthorizations(base44, clientId) : Promise.resolve([])
    ]);

    if (!client) {
      throw new Error(`Client ${clientId} not found`);
    }

    if (timeEntries.length === 0) {
      return null; // No data to report
    }

    // Build answers map for fast lookup
    const answersMap = {};
    fieldAnswers.forEach(fa => {
      answersMap[fa.time_entry_id] = fa;
    });

    // Find matching authorization (first active one matching entry type)
    let authorization = authorizationData;
    if (!authorization && includeAuthorization && timeEntries.length > 0) {
      const entryType = timeEntries[0].entry_type_code;
      authorization = authorizations.find(a =>
        a.status === 'active' &&
        a.service_type_code === entryType &&
        a.authorization_start_date <= dateFrom &&
        a.authorization_end_date >= dateTo
      );
    }

    // Group entries by employer if requested
    let groupedEntries;
    if (groupByEmployer) {
      groupedEntries = groupEntriesByEmployer(timeEntries, answersMap);
    } else {
      groupedEntries = { 'all': timeEntries };
    }

    // Build structured report object
    const report = {
      metadata: {
        client_id: clientId,
        generated_at: new Date().toISOString(),
        reporting_period_start: dateFrom,
        reporting_period_end: dateTo,
        total_entries: timeEntries.length,
        group_by_employer: groupByEmployer
      },
      header: buildReportHeader(client, timeEntries, authorization, dateFrom, dateTo),
      rows: buildReportRows(timeEntries, answersMap, authorization),
      summary: buildReportSummary(timeEntries, answersMap, authorization),
      groups: Object.entries(groupedEntries).map(([employer, entries]) => ({
        employer,
        rows: buildReportRows(entries, answersMap, authorization),
        summary: buildReportSummary(entries, answersMap, authorization)
      }))
    };

    return report;
  } catch (error) {
    console.error(`assembleClientReport error for ${clientId}:`, error);
    throw error;
  }
}

/**
 * Assemble batch reports for multiple clients
 * Returns array of assembled report objects
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
 * Build report header with client and authorization metadata
 */
function buildReportHeader(client, timeEntries, authorization, dateFrom, dateTo) {
  const dateRange = getDateRange(timeEntries);

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
    authorization_number: authorization?.authorization_number || '',
    vr_counselor_name: authorization?.vr_counselor_name || '',
    job_goal: authorization?.job_goal || '',
    employer_name: authorization?.employer_name || '',
    total_authorized_hours: authorization?.total_authorized_hours || 0,
    hours_used: authorization?.used_hours || 0,
    hours_remaining: authorization?.remaining_hours || 0,

    // Metadata
    report_generated_date: new Date().toISOString().split('T')[0]
  };
}

/**
 * Build repeating row data (one row per time entry)
 */
function buildReportRows(timeEntries, answersMap, authorization) {
  return timeEntries.map((entry, index) => {
    const fieldAnswer = answersMap[entry.id];
    const answers = fieldAnswer?.answers || {};

    return {
      // Row identifier
      row_number: index + 1,
      entry_id: entry.id,

      // Core time entry data
      date: entry.date,
      duration_minutes: entry.duration_minutes || 0,
      duration_hours: ((entry.duration_minutes || 0) / 60).toFixed(2),
      start_time: entry.start_time || '',
      end_time: entry.end_time || '',

      // Entry classification
      entry_type_id: entry.entry_type_id || '',
      entry_type_code: entry.entry_type_code || '',
      description: entry.description || '',

      // Notes
      general_notes: entry.general_notes || '',

      // Dynamic report answers (e.g., employer_name, goal_addressed, units)
      ...answers,

      // Authorization reference
      service_authorization_id: entry.service_authorization_id || '',
      _authorization_valid: isAuthorizationValidForEntry(entry, authorization)
    };
  });
}

/**
 * Build summary aggregations
 */
function buildReportSummary(timeEntries, answersMap, authorization) {
  const byEntryType = {};
  const byEmployer = {};
  const fieldTotals = {};
  let totalMinutes = 0;

  timeEntries.forEach(entry => {
    const fieldAnswer = answersMap[entry.id];
    const answers = fieldAnswer?.answers || {};

    // Aggregate by entry type
    const typeKey = entry.entry_type_code || 'unknown';
    if (!byEntryType[typeKey]) {
      byEntryType[typeKey] = { count: 0, total_minutes: 0, entries: [] };
    }
    byEntryType[typeKey].count++;
    byEntryType[typeKey].total_minutes += entry.duration_minutes || 0;
    byEntryType[typeKey].entries.push(entry.id);

    // Aggregate by employer (from answers)
    const employer = answers.employer_name || 'Unknown';
    if (!byEmployer[employer]) {
      byEmployer[employer] = { count: 0, total_minutes: 0, entries: [] };
    }
    byEmployer[employer].count++;
    byEmployer[employer].total_minutes += entry.duration_minutes || 0;
    byEmployer[employer].entries.push(entry.id);

    // Aggregate numeric answers
    Object.entries(answers).forEach(([key, value]) => {
      const numValue = parseFloat(value);
      if (!isNaN(numValue)) {
        if (!fieldTotals[key]) {
          fieldTotals[key] = { sum: 0, count: 0, avg: 0 };
        }
        fieldTotals[key].sum += numValue;
        fieldTotals[key].count++;
        fieldTotals[key].avg = parseFloat((fieldTotals[key].sum / fieldTotals[key].count).toFixed(2));
      }
    });

    totalMinutes += entry.duration_minutes || 0;
  });

  // Format aggregates
  const formatAggregates = (agg) => {
    const formatted = {};
    Object.entries(agg).forEach(([key, data]) => {
      if (key === 'entries') return; // Skip array
      formatted[key] = key === 'count' ? data : typeof data === 'number' ? (data / 60).toFixed(2) : data;
    });
    return formatted;
  };

  return {
    total_entries: timeEntries.length,
    total_minutes: totalMinutes,
    total_hours: (totalMinutes / 60).toFixed(2),
    average_hours_per_entry: ((totalMinutes / 60) / Math.max(timeEntries.length, 1)).toFixed(2),
    by_entry_type: Object.entries(byEntryType).reduce((acc, [k, v]) => {
      acc[k] = {
        count: v.count,
        total_minutes: v.total_minutes,
        total_hours: (v.total_minutes / 60).toFixed(2),
        entry_ids: v.entries
      };
      return acc;
    }, {}),
    by_employer: Object.entries(byEmployer).reduce((acc, [k, v]) => {
      acc[k] = {
        count: v.count,
        total_minutes: v.total_minutes,
        total_hours: (v.total_minutes / 60).toFixed(2),
        entry_ids: v.entries
      };
      return acc;
    }, {}),
    field_totals: fieldTotals,
    authorization_hours_used: authorization?.used_hours || 0,
    authorization_hours_remaining: authorization?.remaining_hours || 0
  };
}

/**
 * Group entries by employer (from report field answers)
 */
function groupEntriesByEmployer(timeEntries, answersMap) {
  const grouped = {};

  timeEntries.forEach(entry => {
    const fieldAnswer = answersMap[entry.id];
    const answers = fieldAnswer?.answers || {};
    const employer = answers.employer_name || 'Unknown';

    if (!grouped[employer]) {
      grouped[employer] = [];
    }
    grouped[employer].push(entry);
  });

  return grouped;
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
  return (getTotalMinutes(timeEntries) / 60).toFixed(2);
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
 * Helper: Check if authorization is valid for entry
 */
function isAuthorizationValidForEntry(entry, authorization) {
  if (!authorization) return false;
  return (
    authorization.status === 'active' &&
    entry.date >= authorization.authorization_start_date &&
    entry.date <= authorization.authorization_end_date &&
    authorization.remaining_hours > 0
  );
}

/**
 * Fetch helpers (never write back)
 */
async function fetchClient(base44, clientId) {
  const clients = await base44.entities.Client.filter({ id: clientId });
  return clients[0] || null;
}

async function fetchTimeEntries(base44, clientId, dateFrom, dateTo, entryTypeId, entryTypeCode) {
  const query = {
    client_id: clientId,
    date: { $gte: dateFrom, $lte: dateTo }
  };

  if (entryTypeId) query.entry_type_id = entryTypeId;
  if (entryTypeCode) query.entry_type_code = entryTypeCode;

  return await base44.entities.TimeEntry.filter(query);
}

async function fetchReportFieldAnswers(base44) {
  return await base44.entities.ReportFieldAnswer.list();
}

async function fetchServiceAuthorizations(base44, clientId) {
  return await base44.entities.ServiceAuthorization.filter({ client_id: clientId });
}