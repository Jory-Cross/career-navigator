import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Report Aggregation Service
 * Step 1: Fetches raw records only (no PDF generation)
 * Returns analytics and statistics for dashboards
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      action,
      client_id,
      entry_type_code,      // Use code instead of id
      date_from,
      date_to,
      year,
      month,
      field_keys
    } = await req.json();

    if (!action) {
      return Response.json({ error: 'Missing action' }, { status: 400 });
    }

    // Step 1: Fetch source records (never writes back)
    const [allEntries, allAnswers, allAuthorizations] = await Promise.all([
      base44.entities.TimeEntry.list(),
      base44.entities.ReportFieldAnswer.list(),
      base44.entities.ServiceAuthorization.list()
    ]);

    const answersMap = {};
    allAnswers.forEach(a => {
      answersMap[a.time_entry_id] = a;
    });

    const authMap = {};
    allAuthorizations.forEach(a => {
      authMap[a.id] = a;
    });

    // Filter entries
    const timeEntries = allEntries.filter(entry => {
      if (client_id && entry.client_id !== client_id) return false;
      if (entry_type_code && entry.entry_type_code !== entry_type_code) return false;
      if (date_from && entry.date < date_from) return false;
      if (date_to && entry.date > date_to) return false;
      return true;
    });

    // Perform requested action
    if (action === 'aggregate') {
      const result = performAggregation(timeEntries, answersMap, authMap, { field_keys });
      return Response.json({ success: true, data: result });
    }

    if (action === 'monthly_stats') {
      if (!year || !month) {
        return Response.json({ error: 'Missing year or month' }, { status: 400 });
      }
      const monthStr = `${year}-${String(month).padStart(2, "0")}`;
      const dateLastDay = new Date(year, month, 0).getDate();
      const monthEntries = timeEntries.filter(e =>
        e.date >= `${monthStr}-01` && e.date <= `${monthStr}-${dateLastDay}`
      );
      const result = performAggregation(monthEntries, answersMap, authMap, { field_keys });
      return Response.json({ success: true, month: monthStr, data: result });
    }

    if (action === 'export_csv') {
      const result = performAggregation(timeEntries, answersMap, authMap, { field_keys });
      const csv = generateCSV(result);
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename=report-aggregation.csv'
        }
      });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });

  } catch (error) {
    console.error('getReportAggregation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Perform aggregation on filtered entries
 * Never writes back to records
 */
function performAggregation(timeEntries, answersMap, authMap = {}, options = {}) {
  const byClient = {};
  const byMonth = {};
  const byEntryType = {};
  const byAuthorization = {};
  const fieldSummary = {};
  let totalMinutes = 0;

  timeEntries.forEach((entry) => {
    const fieldAnswer = answersMap[entry.id];
    const answers = fieldAnswer?.answers || {};
    const monthKey = entry.date.substring(0, 7);
    const entryTypeCode = entry.entry_type_code || 'unknown';
    const authId = entry.service_authorization_id;

    // By client
    if (!byClient[entry.client_id]) {
      byClient[entry.client_id] = { count: 0, total_minutes: 0 };
    }
    byClient[entry.client_id].count++;
    byClient[entry.client_id].total_minutes += entry.duration_minutes || 0;

    // By month
    if (!byMonth[monthKey]) {
      byMonth[monthKey] = { count: 0, total_minutes: 0, by_entry_type: {} };
    }
    byMonth[monthKey].count++;
    byMonth[monthKey].total_minutes += entry.duration_minutes || 0;
    if (!byMonth[monthKey].by_entry_type[entryTypeCode]) {
      byMonth[monthKey].by_entry_type[entryTypeCode] = { count: 0, total_minutes: 0 };
    }
    byMonth[monthKey].by_entry_type[entryTypeCode].count++;
    byMonth[monthKey].by_entry_type[entryTypeCode].total_minutes += entry.duration_minutes || 0;

    // By entry type
    if (!byEntryType[entryTypeCode]) {
      byEntryType[entryTypeCode] = { count: 0, total_minutes: 0, entries: [] };
    }
    byEntryType[entryTypeCode].count++;
    byEntryType[entryTypeCode].total_minutes += entry.duration_minutes || 0;
    byEntryType[entryTypeCode].entries.push(entry.id);

    // By authorization (if present)
    if (authId) {
      if (!byAuthorization[authId]) {
        const auth = authMap[authId] || {};
        byAuthorization[authId] = {
          authorization_number: auth.authorization_number || 'unknown',
          count: 0,
          total_minutes: 0,
          entries: [],
          authorization_status: auth.status || 'unknown'
        };
      }
      byAuthorization[authId].count++;
      byAuthorization[authId].total_minutes += entry.duration_minutes || 0;
      byAuthorization[authId].entries.push(entry.id);
    }

    // Field summary (for report answers)
    Object.entries(answers).forEach(([fieldKey, value]) => {
      if (options.field_keys && !options.field_keys.includes(fieldKey)) return;

      if (!fieldSummary[fieldKey]) {
        fieldSummary[fieldKey] = { count: 0, values: [], unique_values: new Set() };
      }
      fieldSummary[fieldKey].count++;
      fieldSummary[fieldKey].values.push(value);
      fieldSummary[fieldKey].unique_values.add(String(value));
    });

    totalMinutes += entry.duration_minutes || 0;
  });

  // Clean up Sets
  Object.entries(fieldSummary).forEach(([key, data]) => {
    fieldSummary[key].unique_count = data.unique_values.size;
    delete fieldSummary[key].unique_values;
  });

  // Format aggregates
  const formatAgg = (agg) => {
    return Object.entries(agg).reduce((acc, [k, data]) => {
      acc[k] = {
        count: data.count,
        total_minutes: data.total_minutes,
        total_hours: (data.total_minutes / 60).toFixed(2),
        ...(data.entries && { entry_count: data.entries.length })
      };
      return acc;
    }, {});
  };

  return {
    total_entries: timeEntries.length,
    total_hours: (totalMinutes / 60).toFixed(2),
    total_minutes: totalMinutes,
    average_hours_per_entry: ((totalMinutes / 60) / Math.max(timeEntries.length, 1)).toFixed(2),
    by_client: formatAgg(byClient),
    by_month: byMonth,  // Keep month breakdown with nested entry types
    by_entry_type: formatAgg(byEntryType),
    by_authorization: byAuthorization,
    field_summary: fieldSummary
  };
}

function generateCSV(aggregation) {
  const rows = [['Metric', 'Value']];

  rows.push(['Total Entries', aggregation.total_entries]);
  rows.push(['Total Hours', aggregation.total_hours]);
  rows.push(['']);

  rows.push(['By Month', '']);
  Object.entries(aggregation.by_month).forEach(([month, data]) => {
    rows.push([`  ${month}`, `${data.count} entries, ${(data.total_minutes / 60).toFixed(2)} hours`]);
    Object.entries(data.by_entry_type).forEach(([type, typeData]) => {
      rows.push([`    - ${type}`, `${typeData.count} entries, ${(typeData.total_minutes / 60).toFixed(2)} hours`]);
    });
  });

  rows.push(['']);
  rows.push(['By Client', '']);
  Object.entries(aggregation.by_client).forEach(([clientId, data]) => {
    rows.push([clientId, `${data.count} entries, ${(data.total_minutes / 60).toFixed(2)} hours`]);
  });

  rows.push(['']);
  rows.push(['By Entry Type', '']);
  Object.entries(aggregation.by_entry_type).forEach(([typeId, data]) => {
    rows.push([typeId, `${data.count} entries, ${(data.total_minutes / 60).toFixed(2)} hours`]);
  });

  return rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
}