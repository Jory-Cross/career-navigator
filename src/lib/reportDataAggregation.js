/**
 * Report Data Aggregation
 * Query structured time entry data for reporting by client, month, and service type
 */

export async function aggregateTimeEntries(base44, filters = {}) {
  /**
   * @param {Object} filters
   *   - client_id: string (optional)
   *   - entry_type_id: string (optional)
   *   - date_from: string YYYY-MM-DD (optional)
   *   - date_to: string YYYY-MM-DD (optional)
   *   - field_keys: array of field keys to include (optional, default: all)
   * @returns {Object} Aggregated data with summary and details
   */

  try {
    // Fetch all time entries (apply filters if provided)
    const allEntries = await base44.entities.TimeEntry.list();
    const timeEntries = allEntries.filter(entry => {
      if (filters.client_id && entry.client_id !== filters.client_id) return false;
      if (filters.entry_type_id && entry.entry_type_id !== filters.entry_type_id) return false;
      if (filters.date_from && entry.date < filters.date_from) return false;
      if (filters.date_to && entry.date > filters.date_to) return false;
      return true;
    });

    if (!timeEntries.length) {
      return {
        total_entries: 0,
        total_hours: 0,
        total_minutes: 0,
        by_client: {},
        by_month: {},
        by_entry_type: {},
        field_summary: {},
        entries: []
      };
    }

    // Fetch all report field answers
    const allAnswers = await base44.entities.ReportFieldAnswer.list();
    const answersMap = {};
    allAnswers.forEach(a => {
      answersMap[a.time_entry_id] = a.answers || {};
    });

    // Aggregate by client, month, entry type
    const byClient = {};
    const byMonth = {};
    const byEntryType = {};
    const fieldSummary = {};

    let totalMinutes = 0;

    timeEntries.forEach((entry) => {
      const answers = answersMap[entry.id] || {};
      const monthKey = entry.date.substring(0, 7); // YYYY-MM

      // Aggregate by client
      if (!byClient[entry.client_id]) {
        byClient[entry.client_id] = {
          count: 0,
          total_minutes: 0,
          field_counts: {}
        };
      }
      byClient[entry.client_id].count++;
      byClient[entry.client_id].total_minutes += entry.duration_minutes || 0;

      // Aggregate by month
      if (!byMonth[monthKey]) {
        byMonth[monthKey] = {
          count: 0,
          total_minutes: 0,
          by_entry_type: {}
        };
      }
      byMonth[monthKey].count++;
      byMonth[monthKey].total_minutes += entry.duration_minutes || 0;

      if (!byMonth[monthKey].by_entry_type[entry.entry_type_id]) {
        byMonth[monthKey].by_entry_type[entry.entry_type_id] = {
          count: 0,
          total_minutes: 0
        };
      }
      byMonth[monthKey].by_entry_type[entry.entry_type_id].count++;
      byMonth[monthKey].by_entry_type[entry.entry_type_id].total_minutes += entry.duration_minutes || 0;

      // Aggregate by entry type
      if (!byEntryType[entry.entry_type_id]) {
        byEntryType[entry.entry_type_id] = {
          count: 0,
          total_minutes: 0,
          field_counts: {}
        };
      }
      byEntryType[entry.entry_type_id].count++;
      byEntryType[entry.entry_type_id].total_minutes += entry.duration_minutes || 0;

      // Aggregate field data
      Object.entries(answers).forEach(([fieldKey, value]) => {
        if (filters.field_keys && !filters.field_keys.includes(fieldKey)) {
          return;
        }

        if (!fieldSummary[fieldKey]) {
          fieldSummary[fieldKey] = {
            count: 0,
            values: [],
            unique_values: new Set()
          };
        }
        fieldSummary[fieldKey].count++;
        fieldSummary[fieldKey].values.push(value);
        fieldSummary[fieldKey].unique_values.add(String(value));

        // Track by client for this field
        if (!byClient[entry.client_id].field_counts[fieldKey]) {
          byClient[entry.client_id].field_counts[fieldKey] = {
            count: 0,
            values: []
          };
        }
        byClient[entry.client_id].field_counts[fieldKey].count++;
        byClient[entry.client_id].field_counts[fieldKey].values.push(value);

        // Track by entry type for this field
        if (!byEntryType[entry.entry_type_id].field_counts[fieldKey]) {
          byEntryType[entry.entry_type_id].field_counts[fieldKey] = {
            count: 0,
            values: []
          };
        }
        byEntryType[entry.entry_type_id].field_counts[fieldKey].count++;
        byEntryType[entry.entry_type_id].field_counts[fieldKey].values.push(value);
      });

      totalMinutes += entry.duration_minutes || 0;
    });

    // Convert Sets to counts and clean up
    Object.entries(fieldSummary).forEach(([key, data]) => {
      fieldSummary[key].unique_count = data.unique_values.size;
      delete fieldSummary[key].unique_values;
    });

    return {
      total_entries: timeEntries.length,
      total_hours: (totalMinutes / 60).toFixed(2),
      total_minutes: totalMinutes,
      date_range: {
        from: filters.date_from || timeEntries[0].date,
        to: filters.date_to || timeEntries[timeEntries.length - 1].date
      },
      by_client: byClient,
      by_month: byMonth,
      by_entry_type: byEntryType,
      field_summary: fieldSummary,
      entries: timeEntries.map(e => ({
        ...e,
        answers: answersMap[e.id] || {}
      }))
    };
  } catch (error) {
    console.error('Aggregation error:', error);
    throw error;
  }
}

/**
 * Get report statistics for a specific month
 */
export async function getMonthlyStats(base44, year, month) {
  const monthStr = `${year}-${String(month).padStart(2, "0")}`;
  const dateFrom = `${monthStr}-01`;
  const dateLastDay = new Date(year, month, 0).getDate();
  const dateTo = `${monthStr}-${dateLastDay}`;

  return aggregateTimeEntries(base44, { date_from: dateFrom, date_to: dateTo });
}

/**
 * Get report statistics for a specific client across all months
 */
export async function getClientStats(base44, clientId, dateFrom, dateTo) {
  return aggregateTimeEntries(base44, { client_id: clientId, date_from: dateFrom, date_to: dateTo });
}

/**
 * Get report statistics for a specific service type
 */
export async function getServiceTypeStats(base44, entryTypeId, dateFrom, dateTo) {
  return aggregateTimeEntries(base44, { entry_type_id: entryTypeId, date_from: dateFrom, date_to: dateTo });
}

/**
 * Export aggregated data as CSV for analysis
 */
export function exportAggregationAsCSV(aggregation) {
  const rows = [];

  // Header
  rows.push(['Month', 'Entry Type', 'Entries', 'Total Hours', 'Avg Hours Per Entry']);

  // Data by month
  Object.entries(aggregation.by_month).forEach(([month, monthData]) => {
    Object.entries(monthData.by_entry_type).forEach(([entryType, typeData]) => {
      const avgHours = ((typeData.total_minutes || 0) / 60 / (typeData.count || 1)).toFixed(2);
      rows.push([
        month,
        entryType,
        typeData.count,
        ((typeData.total_minutes || 0) / 60).toFixed(2),
        avgHours
      ]);
    });
  });

  return rows.map(row => row.join(',')).join('\n');
}