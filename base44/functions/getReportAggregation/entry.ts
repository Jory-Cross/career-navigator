import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

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
      entry_type_id,
      date_from,
      date_to,
      year,
      month,
      field_keys
    } = await req.json();

    if (!action) {
      return Response.json({ error: 'Missing action' }, { status: 400 });
    }

    // Fetch all time entries
    const allEntries = await base44.entities.TimeEntry.list();

    // Fetch all report field answers
    const allAnswers = await base44.entities.ReportFieldAnswer.list();
    const answersMap = {};
    allAnswers.forEach(a => {
      answersMap[a.time_entry_id] = a.answers || {};
    });

    // Apply filters
    const timeEntries = allEntries.filter(entry => {
      if (client_id && entry.client_id !== client_id) return false;
      if (entry_type_id && entry.entry_type_id !== entry_type_id) return false;
      if (date_from && entry.date < date_from) return false;
      if (date_to && entry.date > date_to) return false;
      return true;
    });

    if (action === 'aggregate') {
      const result = performAggregation(timeEntries, answersMap, { field_keys });
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
      const result = performAggregation(monthEntries, answersMap, { field_keys });
      return Response.json({ success: true, month: monthStr, data: result });
    }

    if (action === 'export_csv') {
      const result = performAggregation(timeEntries, answersMap, { field_keys });
      const csv = generateCSV(result);
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename=report-aggregation.csv'
        }
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    console.error('getReportAggregation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function performAggregation(timeEntries, answersMap, options = {}) {
  const byClient = {};
  const byMonth = {};
  const byEntryType = {};
  const fieldSummary = {};

  let totalMinutes = 0;

  timeEntries.forEach((entry) => {
    const answers = answersMap[entry.id] || {};
    const monthKey = entry.date.substring(0, 7);

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

    if (!byMonth[monthKey].by_entry_type[entry.entry_type_id]) {
      byMonth[monthKey].by_entry_type[entry.entry_type_id] = { count: 0, total_minutes: 0 };
    }
    byMonth[monthKey].by_entry_type[entry.entry_type_id].count++;
    byMonth[monthKey].by_entry_type[entry.entry_type_id].total_minutes += entry.duration_minutes || 0;

    // By entry type
    if (!byEntryType[entry.entry_type_id]) {
      byEntryType[entry.entry_type_id] = { count: 0, total_minutes: 0 };
    }
    byEntryType[entry.entry_type_id].count++;
    byEntryType[entry.entry_type_id].total_minutes += entry.duration_minutes || 0;

    // Field summary
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

  return {
    total_entries: timeEntries.length,
    total_hours: (totalMinutes / 60).toFixed(2),
    total_minutes: totalMinutes,
    by_client: byClient,
    by_month: byMonth,
    by_entry_type: byEntryType,
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