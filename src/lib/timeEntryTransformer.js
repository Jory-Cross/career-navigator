/**
 * Time Entry Transformer
 * Groups and transforms TimeEntry + ReportFieldAnswer records into structured PDF data
 * 
 * Does NOT modify original records — produces new transformation for PDF generation
 */

export class TimeEntryTransformer {
  constructor(timeEntries = [], fieldAnswers = [], client = {}, options = {}) {
    this.timeEntries = timeEntries;
    this.fieldAnswers = fieldAnswers;
    this.client = client;
    this.options = options;

    // Build answer map
    this.answersMap = {};
    this.fieldAnswers.forEach(fa => {
      this.answersMap[fa.time_entry_id] = fa.answers || {};
    });
  }

  /**
   * Group entries by client
   */
  groupByClient() {
    const grouped = {};

    this.timeEntries.forEach(entry => {
      if (!grouped[entry.client_id]) {
        grouped[entry.client_id] = [];
      }
      grouped[entry.client_id].push(entry);
    });

    return grouped;
  }

  /**
   * Group entries by entry type
   * Uses entry_type_code as grouping key (not legacy category)
   */
  groupByEntryType() {
    const grouped = {};

    this.timeEntries.forEach(entry => {
      const key = entry.entry_type_code || 'unknown';
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(entry);
    });

    return grouped;
  }

  /**
   * Group entries by employer (from structured answers)
   */
  groupByEmployer(employerFieldKey = 'employer_name') {
    const grouped = {};

    this.timeEntries.forEach(entry => {
      const answers = this.answersMap[entry.id] || {};
      const employer = answers[employerFieldKey] || 'Unknown';

      if (!grouped[employer]) {
        grouped[employer] = [];
      }
      grouped[employer].push(entry);
    });

    return grouped;
  }

  /**
   * Group entries by reporting period (month/year)
   */
  groupByMonth() {
    const grouped = {};

    this.timeEntries.forEach(entry => {
      const monthKey = entry.date.substring(0, 7); // YYYY-MM
      if (!grouped[monthKey]) {
        grouped[monthKey] = [];
      }
      grouped[monthKey].push(entry);
    });

    return grouped;
  }

  /**
   * Group entries by date range
   */
  groupByDateRange(rangeStart, rangeEnd) {
    return this.timeEntries.filter(e => e.date >= rangeStart && e.date <= rangeEnd);
  }

  /**
   * Transform entries into PDF-ready structure
   * Returns: { header, rows, summary }
   */
  transform() {
    return {
      header: this.buildHeader(),
      rows: this.buildRows(),
      summary: this.buildSummary()
    };
  }

  /**
   * Build header fields (client info, period, authorization details, etc.)
   */
  buildHeader() {
    const dateRange = this.getDateRange();
    const authData = this.extractAuthorizationData();

    return {
      client_name: `${this.client.first_name || ''} ${this.client.last_name || ''}`.trim(),
      client_email: this.client.email || '',
      client_phone: this.client.phone || '',
      client_address: this.client.address || '',
      reporting_period_start: dateRange.start,
      reporting_period_end: dateRange.end,
      reporting_month: this.getReportingMonth(),
      report_generated_date: new Date().toISOString().split('T')[0],
      total_entries: this.timeEntries.length,
      total_hours: this.getTotalHours().toFixed(2),
      total_minutes: this.getTotalMinutes(),
      // Authorization fields (from first entry's linked authorization)
      authorization_number: authData.authorization_number || '',
      vr_counselor_name: authData.vr_counselor_name || '',
      job_goal: authData.job_goal || '',
      employer_name: authData.employer_name || '',
      total_authorized_hours: authData.total_authorized_hours || 0,
      hours_used: authData.hours_used || 0,
      hours_remaining: authData.hours_remaining || 0
    };
  }

  /**
   * Build repeating row data (one row per time entry)
   */
  buildRows() {
    return this.timeEntries.map((entry, index) => {
      const answers = this.answersMap[entry.id] || {};

      return {
        row_number: index + 1,
        date: entry.date,
        duration_minutes: entry.duration_minutes || 0,
        duration_hours: ((entry.duration_minutes || 0) / 60).toFixed(2),
        entry_type_id: entry.entry_type_id || '',
        entry_type_code: entry.entry_type_code || '',
        description: entry.description || '',
        general_notes: entry.general_notes || '',
        // Spread all structured field answers
        ...answers,
        // Add helper flags
        _has_answers: Object.keys(answers).length > 0,
        _answer_count: Object.keys(answers).length
      };
    });
  }

  /**
   * Build summary fields (aggregations)
   */
  buildSummary() {
    const byEntryType = {};
    const byEmployer = {};
    const fieldTotals = {};

    this.timeEntries.forEach(entry => {
      const answers = this.answersMap[entry.id] || {};

      // Aggregate by entry type (use code as key)
      const typeKey = entry.entry_type_code || 'unknown';
      if (!byEntryType[typeKey]) {
        byEntryType[typeKey] = {
          count: 0,
          total_minutes: 0,
          entries: []
        };
      }
      byEntryType[typeKey].count++;
      byEntryType[typeKey].total_minutes += entry.duration_minutes || 0;
      byEntryType[typeKey].entries.push(entry.id);

      // Aggregate by employer
      const employer = answers.employer_name || 'Unknown';
      if (!byEmployer[employer]) {
        byEmployer[employer] = {
          count: 0,
          total_minutes: 0,
          entries: []
        };
      }
      byEmployer[employer].count++;
      byEmployer[employer].total_minutes += entry.duration_minutes || 0;
      byEmployer[employer].entries.push(entry.id);

      // Aggregate numeric fields
      Object.entries(answers).forEach(([key, value]) => {
        const numValue = parseFloat(value);
        if (!isNaN(numValue)) {
          if (!fieldTotals[key]) {
            fieldTotals[key] = { sum: 0, count: 0, values: [] };
          }
          fieldTotals[key].sum += numValue;
          fieldTotals[key].count++;
          fieldTotals[key].values.push(value);
        }
      });
    });

    return {
      total_entries: this.timeEntries.length,
      total_hours: this.getTotalHours().toFixed(2),
      total_minutes: this.getTotalMinutes(),
      average_hours_per_entry: (this.getTotalHours() / Math.max(this.timeEntries.length, 1)).toFixed(2),
      by_entry_type: this.formatAggregates(byEntryType),
      by_employer: this.formatAggregates(byEmployer),
      field_totals: fieldTotals,
      date_range: this.getDateRange()
    };
  }

  /**
   * Format aggregates for display (convert minutes to hours)
   */
  formatAggregates(aggregates) {
    const formatted = {};

    Object.entries(aggregates).forEach(([key, data]) => {
      formatted[key] = {
        count: data.count,
        total_minutes: data.total_minutes,
        total_hours: (data.total_minutes / 60).toFixed(2),
        average_hours: (data.total_minutes / 60 / data.count).toFixed(2)
      };
    });

    return formatted;
  }

  /**
   * Get total hours across all entries
   */
  getTotalHours() {
    const minutes = this.getTotalMinutes();
    return minutes / 60;
  }

  /**
   * Get total minutes across all entries
   */
  getTotalMinutes() {
    return this.timeEntries.reduce((sum, entry) => sum + (entry.duration_minutes || 0), 0);
  }

  /**
   * Get date range of entries
   */
  getDateRange() {
    if (this.timeEntries.length === 0) {
      return { start: '', end: '' };
    }

    const sorted = [...this.timeEntries].sort((a, b) => a.date.localeCompare(b.date));
    return {
      start: sorted[0].date,
      end: sorted[sorted.length - 1].date
    };
  }

  /**
   * Get reporting month (e.g., "April 2026")
   */
  getReportingMonth() {
    if (this.timeEntries.length === 0) return '';

    const date = new Date(this.timeEntries[0].date);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  /**
   * Filter rows by condition (for complex PDF layouts)
   */
  filterRows(predicate) {
    const filtered = this.timeEntries.filter(predicate);
    return new TimeEntryTransformer(filtered, this.fieldAnswers, this.client, this.options);
  }

  /**
   * Limit rows (for PDF page breaks)
   */
  limitRows(count) {
    const limited = this.timeEntries.slice(0, count);
    return new TimeEntryTransformer(limited, this.fieldAnswers.filter(
      fa => limited.some(e => e.id === fa.time_entry_id)
    ), this.client, this.options);
  }

  /**
   * Get raw entry for a specific row (by index)
   */
  getEntry(index) {
    return this.timeEntries[index];
  }

  /**
   * Get answers for a specific entry
   */
  getAnswers(entryId) {
    return this.answersMap[entryId] || {};
  }

  /**
   * Extract authorization data from first entry
   * Returns metadata from linked ServiceAuthorization
   */
  extractAuthorizationData() {
    if (this.timeEntries.length === 0) {
      return {
        authorization_number: null,
        vr_counselor_name: null,
        job_goal: null,
        employer_name: null,
        total_authorized_hours: null,
        hours_used: null,
        hours_remaining: null
      };
    }

    // Get first entry's authorization (should be same for all entries in a report)
    const firstEntry = this.timeEntries[0];
    const auth = this.options.authorization || {};

    return {
      authorization_number: auth.authorization_number || null,
      vr_counselor_name: auth.vr_counselor_name || null,
      job_goal: auth.job_goal || null,
      employer_name: auth.employer_name || null,
      total_authorized_hours: auth.total_authorized_hours || null,
      hours_used: auth.used_hours || null,
      hours_remaining: auth.remaining_hours || null
    };
  }

  /**
   * Export as JSON for debugging
   */
  toJSON() {
    return {
      entries: this.timeEntries,
      answers: this.fieldAnswers,
      client: this.client,
      transform: this.transform()
    };
  }
}

/**
 * Factory: Create transformer from client + date range
 */
export async function createTransformerForClient(base44, clientId, dateFrom, dateTo) {
  try {
    // Fetch client
    const allClients = await base44.entities.Client.list();
    const client = allClients.find(c => c.id === clientId);

    if (!client) {
      throw new Error(`Client ${clientId} not found`);
    }

    // Fetch time entries
    const allEntries = await base44.entities.TimeEntry.list();
    const timeEntries = allEntries.filter(e =>
      e.client_id === clientId &&
      e.date >= dateFrom &&
      e.date <= dateTo
    );

    // Fetch field answers
    const allAnswers = await base44.entities.ReportFieldAnswer.list();
    const fieldAnswers = allAnswers.filter(fa =>
      timeEntries.some(e => e.id === fa.time_entry_id)
    );

    return new TimeEntryTransformer(timeEntries, fieldAnswers, client);
  } catch (error) {
    console.error('createTransformerForClient error:', error);
    throw error;
  }
}

/**
 * Factory: Create transformer for multiple clients (grouped)
 */
export async function createTransformersForClients(base44, clientIds, dateFrom, dateTo) {
  const transformers = {};

  for (const clientId of clientIds) {
    try {
      transformers[clientId] = await createTransformerForClient(base44, clientId, dateFrom, dateTo);
    } catch (error) {
      console.error(`Error creating transformer for client ${clientId}:`, error);
      transformers[clientId] = null;
    }
  }

  return transformers;
}