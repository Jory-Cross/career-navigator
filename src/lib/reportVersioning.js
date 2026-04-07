/**
 * Report Versioning Utilities
 * Manages report versions, locking, and history
 */

/**
 * Get all versions for a reporting period
 */
export async function getReportVersions(base44, clientId, reportType, periodStart, periodEnd) {
  try {
    const versions = await base44.entities.ReportVersion.filter({
      client_id: clientId,
      report_type: reportType,
      reporting_period_start: periodStart,
      reporting_period_end: periodEnd
    });

    return versions.sort((a, b) => a.version_number - b.version_number);
  } catch (error) {
    console.error('Error fetching report versions:', error);
    return [];
  }
}

/**
 * Get latest version for a reporting period
 */
export async function getLatestReportVersion(base44, clientId, reportType, periodStart, periodEnd) {
  try {
    const versions = await getReportVersions(base44, clientId, reportType, periodStart, periodEnd);
    return versions.length > 0 ? versions[versions.length - 1] : null;
  } catch (error) {
    console.error('Error fetching latest report version:', error);
    return null;
  }
}

/**
 * Get next version number for reporting period
 */
export async function getNextVersionNumber(base44, clientId, reportType, periodStart, periodEnd) {
  try {
    const versions = await getReportVersions(base44, clientId, reportType, periodStart, periodEnd);
    return versions.length > 0 ? Math.max(...versions.map(v => v.version_number)) + 1 : 1;
  } catch (error) {
    console.error('Error calculating next version number:', error);
    return 1;
  }
}

/**
 * Create a new report version
 * Automatically increments version number
 */
export async function createReportVersion(base44, versionData) {
  try {
    const nextVersion = await getNextVersionNumber(
      base44,
      versionData.client_id,
      versionData.report_type,
      versionData.reporting_period_start,
      versionData.reporting_period_end
    );

    const reportVersion = await base44.asServiceRole.entities.ReportVersion.create({
      ...versionData,
      version_number: nextVersion,
      time_entry_count: versionData.time_entry_ids?.length || 0,
      generated_at: new Date().toISOString(),
      org_id: versionData.org_id
    });

    return {
      success: true,
      version: reportVersion,
      message: `Report version ${nextVersion} created successfully`
    };
  } catch (error) {
    console.error('Error creating report version:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Check if reporting period is locked
 */
export async function isReportingPeriodLocked(base44, clientId, reportType, periodStart, periodEnd) {
  try {
    const versions = await getReportVersions(base44, clientId, reportType, periodStart, periodEnd);
    const lockedVersion = versions.find(v => v.is_locked);
    return lockedVersion || null;
  } catch (error) {
    console.error('Error checking lock status:', error);
    return null;
  }
}

/**
 * Lock a reporting period
 * Prevents changes to TimeEntry records within period
 */
export async function lockReportingPeriod(base44, clientId, reportType, periodStart, periodEnd, reason = '') {
  try {
    const versions = await getReportVersions(base44, clientId, reportType, periodStart, periodEnd);

    if (versions.length === 0) {
      return {
        success: false,
        error: 'No report version found for this period'
      };
    }

    const user = await base44.auth.me();
    const lockedAt = new Date().toISOString();

    // Lock all versions for this period (mark last one as locked)
    const lastVersion = versions[versions.length - 1];
    const updated = await base44.asServiceRole.entities.ReportVersion.update(lastVersion.id, {
      is_locked: true,
      locked_at: lockedAt,
      locked_by: user.email,
      lock_reason: reason
    });

    return {
      success: true,
      versionId: lastVersion.id,
      message: `Reporting period ${periodStart} to ${periodEnd} locked`,
      lockedAt,
      lockedBy: user.email
    };
  } catch (error) {
    console.error('Error locking reporting period:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Unlock a reporting period
 */
export async function unlockReportingPeriod(base44, clientId, reportType, periodStart, periodEnd) {
  try {
    const lockedVersion = await isReportingPeriodLocked(base44, clientId, reportType, periodStart, periodEnd);

    if (!lockedVersion) {
      return {
        success: false,
        error: 'Reporting period is not locked'
      };
    }

    const updated = await base44.asServiceRole.entities.ReportVersion.update(lockedVersion.id, {
      is_locked: false,
      locked_at: null,
      locked_by: null,
      lock_reason: null
    });

    return {
      success: true,
      message: `Reporting period unlocked`,
      versionId: lockedVersion.id
    };
  } catch (error) {
    console.error('Error unlocking reporting period:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Submit/finalize a report version
 */
export async function submitReportVersion(base44, versionId) {
  try {
    const user = await base44.auth.me();
    const submittedAt = new Date().toISOString();

    const updated = await base44.asServiceRole.entities.ReportVersion.update(versionId, {
      is_final: true,
      submitted_at: submittedAt,
      submitted_by: user.email
    });

    return {
      success: true,
      version: updated,
      message: 'Report submitted successfully',
      submittedAt,
      submittedBy: user.email
    };
  } catch (error) {
    console.error('Error submitting report:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get report version history with changes
 */
export async function getVersionHistory(base44, clientId, reportType, periodStart, periodEnd) {
  try {
    const versions = await getReportVersions(base44, clientId, reportType, periodStart, periodEnd);

    return versions.map((v, index) => ({
      versionNumber: v.version_number,
      generatedAt: v.generated_at,
      generatedBy: v.generated_by,
      timeEntryCount: v.time_entry_count,
      totalHours: v.total_hours,
      isFinal: v.is_final,
      submittedAt: v.submitted_at,
      isLocked: v.is_locked,
      lockedAt: v.locked_at,
      lockedBy: v.locked_by,
      isLatest: index === versions.length - 1,
      pdfUrl: v.pdf_url,
      notes: v.notes,
      entriesAdded: index === 0 ? v.time_entry_count : v.time_entry_count - (versions[index - 1].time_entry_count || 0),
      entriesRemoved: index === 0 ? 0 : (versions[index - 1].time_entry_count || 0) - v.time_entry_count
    }));
  } catch (error) {
    console.error('Error getting version history:', error);
    return [];
  }
}

/**
 * Check if time entry falls within locked period
 */
export async function isTimeEntryInLockedPeriod(base44, timeEntry) {
  try {
    if (!timeEntry.entry_type_code) return false;

    // Map entry type code to report type
    const reportType = mapEntryTypeCodeToReportType(timeEntry.entry_type_code);

    // Check for locked period containing this date
    const versions = await base44.entities.ReportVersion.filter({
      client_id: timeEntry.client_id,
      report_type: reportType,
      is_locked: true
    });

    const lockedPeriod = versions.find(v => {
      const entryDate = new Date(timeEntry.date);
      const periodStart = new Date(v.reporting_period_start);
      const periodEnd = new Date(v.reporting_period_end);
      return entryDate >= periodStart && entryDate <= periodEnd;
    });

    return lockedPeriod || null;
  } catch (error) {
    console.error('Error checking locked period:', error);
    return null;
  }
}

/**
 * Validate time entry modification against locked periods
 */
export async function validateTimeEntryModification(base44, timeEntry, operation = 'create') {
  try {
    const lockedPeriod = await isTimeEntryInLockedPeriod(base44, timeEntry);

    if (lockedPeriod) {
      return {
        allowed: false,
        locked: true,
        message: `Cannot ${operation} time entry. Reporting period is locked.`,
        lockedAt: lockedPeriod.locked_at,
        lockedBy: lockedPeriod.locked_by,
        lockReason: lockedPeriod.lock_reason,
        versionId: lockedPeriod.id
      };
    }

    return {
      allowed: true,
      locked: false,
      message: 'Time entry modification allowed'
    };
  } catch (error) {
    console.error('Error validating modification:', error);
    return {
      allowed: false,
      error: error.message
    };
  }
}

/**
 * Get report signature/audit trail
 */
export function getReportAuditTrail(reportVersion) {
  const trail = [];

  trail.push({
    action: 'generated',
    timestamp: reportVersion.generated_at,
    by: reportVersion.generated_by,
    note: `Version ${reportVersion.version_number} created with ${reportVersion.time_entry_count} entries (${reportVersion.total_hours?.toFixed(1)} hours)`
  });

  if (reportVersion.is_locked) {
    trail.push({
      action: 'locked',
      timestamp: reportVersion.locked_at,
      by: reportVersion.locked_by,
      note: reportVersion.lock_reason || 'Period locked'
    });
  }

  if (reportVersion.is_final) {
    trail.push({
      action: 'submitted',
      timestamp: reportVersion.submitted_at,
      by: reportVersion.submitted_by,
      note: 'Report finalized and submitted'
    });
  }

  return trail;
}

/**
 * Map EntryType code to ReportVersion report_type
 */
function mapEntryTypeCodeToReportType(entryTypeCode) {
  const mapping = {
    'job_development': 'job_development',
    'job_coaching': 'job_coaching',
    'life_skills': 'life_skills',
    'cbh': 'cbh',
    'pre_ets': 'other'
  };
  return mapping[entryTypeCode] || 'other';
}

/**
 * Calculate differences between two versions
 */
export async function compareReportVersions(base44, versionId1, versionId2) {
  try {
    const versions = await base44.entities.ReportVersion.list();
    const v1 = versions.find(v => v.id === versionId1);
    const v2 = versions.find(v => v.id === versionId2);

    if (!v1 || !v2) {
      return {
        success: false,
        error: 'One or both versions not found'
      };
    }

    const entriesAdded = v2.time_entry_ids.filter(id => !v1.time_entry_ids.includes(id));
    const entriesRemoved = v1.time_entry_ids.filter(id => !v2.time_entry_ids.includes(id));
    const hoursChange = (v2.total_hours || 0) - (v1.total_hours || 0);

    return {
      success: true,
      comparison: {
        version1: `v${v1.version_number}`,
        version2: `v${v2.version_number}`,
        entriesAdded: entriesAdded.length,
        entriesRemoved: entriesRemoved.length,
        entriesAddedIds: entriesAdded,
        entriesRemovedIds: entriesRemoved,
        hourChange: hoursChange,
        countChange: v2.time_entry_count - v1.time_entry_count
      }
    };
  } catch (error) {
    console.error('Error comparing versions:', error);
    return {
      success: false,
      error: error.message
    };
  }
}