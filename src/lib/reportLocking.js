/**
 * Report Period Locking & Versioning
 * Prevents editing of entries included in generated reports
 */

/**
 * Check if a time entry is locked in a report
 * Returns { locked: boolean, locked_in_report_id: string, message: string }
 */
export function checkEntryLocked(entry) {
  if (!entry) {
    return { locked: false, locked_in_report_id: null, message: null };
  }

  if (entry.locked_in_report_id) {
    return {
      locked: true,
      locked_in_report_id: entry.locked_in_report_id,
      message: `Entry is locked in generated report ${entry.locked_in_report_id}. Contact supervisor to unlock or regenerate report.`
    };
  }

  return { locked: false, locked_in_report_id: null, message: null };
}

/**
 * Check if a period has locked entries
 * Returns true if ANY billable/reportable entries in period are locked
 */
export function isPeriodLocked(entries, dateTo, dateFrom) {
  if (!entries || entries.length === 0) return false;

  const entriesInPeriod = entries.filter(
    e => e.date >= dateFrom && e.date <= dateTo && (e.is_billable || e.is_reportable)
  );

  return entriesInPeriod.some(e => e.locked_in_report_id);
}

/**
 * Get lock info for a period
 * Returns { locked: boolean, lockedEntryCount: number, reportIds: string[] }
 */
export function getPeriodLockInfo(entries, dateFrom, dateTo) {
  if (!entries || entries.length === 0) {
    return { locked: false, lockedEntryCount: 0, reportIds: [] };
  }

  const entriesInPeriod = entries.filter(
    e => e.date >= dateFrom && e.date <= dateTo && (e.is_billable || e.is_reportable)
  );

  const lockedEntries = entriesInPeriod.filter(e => e.locked_in_report_id);
  const reportIds = [...new Set(lockedEntries.map(e => e.locked_in_report_id))];

  return {
    locked: lockedEntries.length > 0,
    lockedEntryCount: lockedEntries.length,
    totalEntryCount: entriesInPeriod.length,
    reportIds
  };
}

/**
 * Validate edit permission for an entry
 * Returns { allowed: boolean, reason: string }
 */
export function canEditEntry(entry, userRole, supervisorOverrideEnabled = false) {
  if (!entry) {
    return { allowed: false, reason: 'Entry not found' };
  }

  const lockStatus = checkEntryLocked(entry);
  if (!lockStatus.locked) {
    return { allowed: true, reason: null };
  }

  // Entry is locked
  if (supervisorOverrideEnabled && (userRole === 'admin' || userRole === 'management')) {
    return {
      allowed: true,
      reason: `Entry is locked but you have supervisor override (${userRole})`,
      requiresAudit: true
    };
  }

  return {
    allowed: false,
    reason: lockStatus.message
  };
}

/**
 * Unlock entries in a period (supervisor/admin only)
 * Used when regenerating reports or correcting entries
 */
export function createUnlockAuditLog(entryId, reason, unlockedBy) {
  return {
    entry_id: entryId,
    unlocked_at: new Date().toISOString(),
    unlocked_by: unlockedBy,
    reason: reason || 'Report regenerated',
    audit_type: 'period_unlock'
  };
}

/**
 * Check if a GeneratedReport is final (submitted to VR)
 * Final reports cannot be regenerated
 */
export function isReportFinal(report) {
  return report && report.is_final === true;
}

/**
 * Get version history for a client + period + entry_type
 * Returns array of GeneratedReport records ordered by version_number DESC
 */
export function getReportVersionHistory(reports, clientId, entryTypeCode, dateFrom, dateTo) {
  if (!reports || reports.length === 0) return [];

  return reports
    .filter(r =>
      r.client_id === clientId &&
      r.entry_type_code === entryTypeCode &&
      r.report_start_date === dateFrom &&
      r.report_end_date === dateTo
    )
    .sort((a, b) => (b.version_number || 0) - (a.version_number || 0));
}

/**
 * Build supersedes chain (linked list of report versions)
 */
export function buildVersionChain(report, allReports) {
  const chain = [report];
  let current = report;

  while (current?.supersedes_report_id) {
    const prev = allReports.find(r => r.id === current.supersedes_report_id);
    if (!prev) break;
    chain.push(prev);
    current = prev;
  }

  return chain;
}