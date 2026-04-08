/**
 * Report Versioning & Period Locking
 * 
 * Manages:
 * - Creating new report versions (with auto-incremented version_number)
 * - Preserving superseded versions
 * - Locking reporting periods to prevent entry modifications
 * - Checking if entries are in locked periods
 * - Regenerating reports with version tracking
 */

/**
 * Create a new report version
 * @param {Object} base44 - Base44 client
 * @param {Object} params - {
 *   client_id,
 *   entry_type_code,
 *   template_id,
 *   template_version,
 *   report_start_date,
 *   report_end_date,
 *   included_time_entry_ids,
 *   included_answer_record_ids,
 *   generated_file_url,
 *   generated_file_name,
 *   total_hours,
 *   generated_by,
 *   supersedes_report_id,
 *   notes
 * }
 * @returns {Promise<Object>} Created ReportVersion record
 */
export async function createReportVersion(base44, params) {
  const {
    client_id,
    entry_type_code,
    template_id,
    template_version = 'current',
    report_start_date,
    report_end_date,
    included_time_entry_ids = [],
    included_answer_record_ids = [],
    generated_file_url,
    generated_file_name,
    total_hours = 0,
    generated_by,
    supersedes_report_id,
    notes
  } = params;

  // Find previous version to determine version_number
  const previousVersions = await base44.entities.ReportVersion.filter({
    client_id,
    entry_type_code,
    report_start_date,
    report_end_date
  });

  const nextVersionNumber = Math.max(
    0,
    ...previousVersions.map(v => v.version_number || 0)
  ) + 1;

  // Create new version
  const reportVersion = await base44.entities.ReportVersion.create({
    client_id,
    entry_type_code,
    template_id,
    template_version,
    report_start_date,
    report_end_date,
    included_time_entry_ids,
    included_answer_record_ids,
    time_entry_count: included_time_entry_ids.length,
    total_hours,
    generated_file_url,
    generated_file_name,
    version_number: nextVersionNumber,
    supersedes_report_id: supersedes_report_id || null,
    generated_at: new Date().toISOString(),
    generated_by,
    locked: false,
    is_final: false,
    notes: notes || (supersedes_report_id ? `Regenerated version ${nextVersionNumber}` : null)
  });

  return reportVersion;
}

/**
 * Get active (current) report version for a reporting period
 * @param {Object} base44 - Base44 client
 * @param {string} clientId - Client ID
 * @param {string} entryTypeCode - Entry type code
 * @param {string} startDate - Report start date (YYYY-MM-DD)
 * @param {string} endDate - Report end date (YYYY-MM-DD)
 * @returns {Promise<Object|null>} Latest ReportVersion or null
 */
export async function getActiveReportVersion(base44, clientId, entryTypeCode, startDate, endDate) {
  const versions = await base44.entities.ReportVersion.filter({
    client_id: clientId,
    entry_type_code: entryTypeCode,
    report_start_date: startDate,
    report_end_date: endDate
  });

  if (versions.length === 0) return null;

  // Return latest version (highest version_number)
  return versions.sort((a, b) => (b.version_number || 0) - (a.version_number || 0))[0];
}

/**
 * Get all versions for a reporting period (including superseded)
 * @param {Object} base44 - Base44 client
 * @param {string} clientId - Client ID
 * @param {string} entryTypeCode - Entry type code
 * @param {string} startDate - Report start date
 * @param {string} endDate - Report end date
 * @returns {Promise<Array>} All ReportVersion records, sorted by version_number DESC
 */
export async function getReportVersionHistory(base44, clientId, entryTypeCode, startDate, endDate) {
  const versions = await base44.entities.ReportVersion.filter({
    client_id: clientId,
    entry_type_code: entryTypeCode,
    report_start_date: startDate,
    report_end_date: endDate
  });

  return versions.sort((a, b) => (b.version_number || 0) - (a.version_number || 0));
}

/**
 * Lock a reporting period to prevent entry modifications
 * @param {Object} base44 - Base44 client
 * @param {string} reportVersionId - ReportVersion ID
 * @param {string} lockedBy - Email of user locking
 * @param {string} lockReason - Why period is locked
 * @returns {Promise<Object>} Updated ReportVersion with locked=true
 */
export async function lockReportingPeriod(base44, reportVersionId, lockedBy, lockReason = '') {
  const reportVersion = await base44.entities.ReportVersion.update(reportVersionId, {
    locked: true,
    locked_at: new Date().toISOString(),
    locked_by: lockedBy,
    lock_reason: lockReason || 'Period locked'
  });

  return reportVersion;
}

/**
 * Unlock a reporting period to allow entry modifications
 * @param {Object} base44 - Base44 client
 * @param {string} reportVersionId - ReportVersion ID
 * @returns {Promise<Object>} Updated ReportVersion with locked=false
 */
export async function unlockReportingPeriod(base44, reportVersionId) {
  const reportVersion = await base44.entities.ReportVersion.update(reportVersionId, {
    locked: false,
    locked_at: null,
    locked_by: null,
    lock_reason: null
  });

  return reportVersion;
}

/**
 * Check if a time entry date falls within a locked reporting period
 * @param {Object} base44 - Base44 client
 * @param {string} clientId - Client ID
 * @param {string} entryDate - Entry date (YYYY-MM-DD)
 * @param {string} entryTypeCode - Entry type code
 * @returns {Promise<Object|null>} Locked ReportVersion if applicable, else null
 */
export async function getLockedPeriodForEntry(base44, clientId, entryDate, entryTypeCode) {
  const versions = await base44.entities.ReportVersion.filter({
    client_id: clientId,
    entry_type_code: entryTypeCode,
    locked: true
  });

  for (const version of versions) {
    if (entryDate >= version.report_start_date && entryDate <= version.report_end_date) {
      return version;
    }
  }

  return null;
}

/**
 * Check if entry can be modified (not in locked period)
 * @param {Object} base44 - Base44 client
 * @param {Object} timeEntry - TimeEntry record
 * @returns {Promise<Object>} { canModify: boolean, lockedPeriod?: ReportVersion }
 */
export async function canModifyTimeEntry(base44, timeEntry) {
  const lockedPeriod = await getLockedPeriodForEntry(
    base44,
    timeEntry.client_id,
    timeEntry.date,
    timeEntry.entry_type_code
  );

  return {
    canModify: !lockedPeriod,
    lockedPeriod
  };
}

/**
 * Mark a report as final (submitted)
 * @param {Object} base44 - Base44 client
 * @param {string} reportVersionId - ReportVersion ID
 * @param {string} submittedBy - Email of user submitting
 * @returns {Promise<Object>} Updated ReportVersion
 */
export async function finalizeReport(base44, reportVersionId, submittedBy) {
  const reportVersion = await base44.entities.ReportVersion.update(reportVersionId, {
    is_final: true,
    submitted_at: new Date().toISOString(),
    submitted_by: submittedBy,
    locked: true,
    locked_at: new Date().toISOString(),
    locked_by: submittedBy,
    lock_reason: 'Report finalized'
  });

  return reportVersion;
}

/**
 * Generate summary of all report versions for a client
 * @param {Object} base44 - Base44 client
 * @param {string} clientId - Client ID
 * @returns {Promise<Object>} Summary with active versions by entry type and date range
 */
export async function getClientReportSummary(base44, clientId) {
  const allVersions = await base44.entities.ReportVersion.filter({
    client_id: clientId
  });

  // Group by period
  const periods = {};
  allVersions.forEach(version => {
    const key = `${version.entry_type_code}_${version.report_start_date}_${version.report_end_date}`;
    if (!periods[key]) {
      periods[key] = {
        entry_type_code: version.entry_type_code,
        start_date: version.report_start_date,
        end_date: version.report_end_date,
        versions: []
      };
    }
    periods[key].versions.push(version);
  });

  // Extract active version for each period
  const activeReports = Object.values(periods).map(period => {
    const activeVersion = period.versions.sort((a, b) => (b.version_number || 0) - (a.version_number || 0))[0];
    return {
      entry_type_code: period.entry_type_code,
      start_date: period.start_date,
      end_date: period.end_date,
      version_number: activeVersion.version_number,
      generated_at: activeVersion.generated_at,
      is_locked: activeVersion.locked,
      is_final: activeVersion.is_final,
      total_versions: period.versions.length,
      file_url: activeVersion.generated_file_url
    };
  });

  return {
    client_id: clientId,
    total_reports: allVersions.length,
    active_reports: activeReports,
    locked_periods: allVersions.filter(v => v.locked).length
  };
}

/**
 * Get all entries included in a report version
 * @param {Object} base44 - Base44 client
 * @param {Object} reportVersion - ReportVersion record
 * @returns {Promise<Object>} { timeEntries: Array, fieldAnswers: Array }
 */
export async function getReportIncludedData(base44, reportVersion) {
  const [timeEntries, fieldAnswers] = await Promise.all([
    Promise.all(
      reportVersion.included_time_entry_ids.map(id =>
        base44.entities.TimeEntry.filter({ id }).then(r => r[0])
      )
    ),
    Promise.all(
      reportVersion.included_answer_record_ids.map(id =>
        base44.entities.ReportFieldAnswer.filter({ id }).then(r => r[0])
      )
    )
  ]);

  return {
    timeEntries: timeEntries.filter(Boolean),
    fieldAnswers: fieldAnswers.filter(Boolean)
  };
}

/**
 * Create a new version by regenerating from existing time entries
 * @param {Object} base44 - Base44 client
 * @param {string} reportVersionId - ReportVersion ID to regenerate from
 * @param {string} newFileUrl - URL of newly generated PDF
 * @param {string} newFileName - File name of newly generated PDF
 * @param {string} regeneratedBy - Email of user regenerating
 * @returns {Promise<Object>} New ReportVersion record
 */
export async function regenerateReportVersion(base44, reportVersionId, newFileUrl, newFileName, regeneratedBy) {
  // Get original report
  const originalReport = await base44.entities.ReportVersion.filter({ id: reportVersionId })[0];
  if (!originalReport) throw new Error('Report not found');

  // Create new version with same entries but new file
  return createReportVersion(base44, {
    client_id: originalReport.client_id,
    entry_type_code: originalReport.entry_type_code,
    template_id: originalReport.template_id,
    template_version: originalReport.template_version,
    report_start_date: originalReport.report_start_date,
    report_end_date: originalReport.report_end_date,
    included_time_entry_ids: originalReport.included_time_entry_ids,
    included_answer_record_ids: originalReport.included_answer_record_ids,
    generated_file_url: newFileUrl,
    generated_file_name: newFileName,
    total_hours: originalReport.total_hours,
    generated_by: regeneratedBy,
    supersedes_report_id: reportVersionId,
    notes: `Regenerated from version ${originalReport.version_number}`
  });
}

/**
 * Check if a period is locked (convenience helper)
 * @param {Object} reportVersion - ReportVersion record
 * @returns {boolean} Is period locked
 */
export function isPeriodLocked(reportVersion) {
  return reportVersion.locked === true;
}

/**
 * Get lock details for a reporting period
 * @param {Object} reportVersion - ReportVersion record
 * @returns {Object} Lock info with reason, locked_by, locked_at
 */
export function getLockDetails(reportVersion) {
  if (!reportVersion.locked) {
    return { locked: false };
  }

  return {
    locked: true,
    locked_at: reportVersion.locked_at,
    locked_by: reportVersion.locked_by,
    reason: reportVersion.lock_reason,
    is_final: reportVersion.is_final
  };
}

/**
 * Compare two report versions to show what changed
 * @param {Object} base44 - Base44 client
 * @param {Object} version1 - ReportVersion (older)
 * @param {Object} version2 - ReportVersion (newer)
 * @returns {Promise<Object>} Differences { added: [], removed: [], modified: [] }
 */
export async function compareReportVersions(base44, version1, version2) {
  const changes = {
    entries_added: [],
    entries_removed: [],
    entry_count_change: version2.time_entry_count - version1.time_entry_count,
    hours_change: version2.total_hours - version1.total_hours,
    template_version_changed: version1.template_version !== version2.template_version
  };

  // Find added/removed entries
  const set1 = new Set(version1.included_time_entry_ids);
  const set2 = new Set(version2.included_time_entry_ids);

  version2.included_time_entry_ids.forEach(id => {
    if (!set1.has(id)) {
      changes.entries_added.push(id);
    }
  });

  version1.included_time_entry_ids.forEach(id => {
    if (!set2.has(id)) {
      changes.entries_removed.push(id);
    }
  });

  return changes;
}