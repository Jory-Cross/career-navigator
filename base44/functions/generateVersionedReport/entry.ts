import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Generates versioned reports
 * - Auto-increments version number
 * - Saves TimeEntry IDs and PDF
 * - Prevents overwriting previous versions
 * - Supports period locking
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, params } = body;

    if (action === 'generate') {
      return await generateReport(base44, user, params);
    } else if (action === 'get_versions') {
      return await getVersions(base44, params);
    } else if (action === 'lock_period') {
      return await lockPeriod(base44, user, params);
    } else if (action === 'unlock_period') {
      return await unlockPeriod(base44, params);
    } else if (action === 'submit_version') {
      return await submitVersion(base44, user, params);
    } else if (action === 'get_history') {
      return await getVersionHistory(base44, params);
    } else {
      return Response.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('generateVersionedReport error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// ===== GENERATE REPORT =====

async function generateReport(base44, user, params) {
  try {
    const {
      client_id,
      report_type,
      entry_type_id,
      pdf_template_id,
      reporting_period_start,
      reporting_period_end,
      time_entry_ids,
      pdf_file_url,
      pdf_file_name,
      lock_after_generation = false,
      lock_reason = ''
    } = params;

    if (!client_id || !report_type || !reporting_period_start || !reporting_period_end) {
      return Response.json({
        success: false,
        error: 'Missing required parameters'
      }, { status: 400 });
    }

    // Get existing versions for this period
    const existingVersions = await base44.entities.ReportVersion.filter({
      client_id,
      report_type,
      reporting_period_start,
      reporting_period_end
    });

    const nextVersion = existingVersions.length > 0
      ? Math.max(...existingVersions.map(v => v.version_number)) + 1
      : 1;

    // Calculate total hours from time entries
    let totalHours = 0;
    if (time_entry_ids && time_entry_ids.length > 0) {
      const entries = await base44.entities.TimeEntry.list();
      const selectedEntries = entries.filter(e => time_entry_ids.includes(e.id));
      totalHours = selectedEntries.reduce((sum, e) => sum + (e.duration_minutes / 60), 0);
    }

    // Create report version
    const reportVersion = await base44.asServiceRole.entities.ReportVersion.create({
      org_id: user.org_id,
      client_id,
      report_type,
      entry_type_id,
      pdf_template_id,
      reporting_period_start,
      reporting_period_end,
      version_number: nextVersion,
      pdf_url: pdf_file_url,
      pdf_file_name,
      time_entry_ids: time_entry_ids || [],
      time_entry_count: time_entry_ids?.length || 0,
      total_hours: totalHours,
      generated_at: new Date().toISOString(),
      generated_by: user.email,
      is_locked: false
    });

    // Lock period if requested
    let lockResult = null;
    if (lock_after_generation) {
      const lockRes = await base44.asServiceRole.entities.ReportVersion.update(reportVersion.id, {
        is_locked: true,
        locked_at: new Date().toISOString(),
        locked_by: user.email,
        lock_reason: lock_reason || `Locked after generating version ${nextVersion}`
      });
      lockResult = {
        locked: true,
        lockedAt: lockRes.locked_at,
        lockedReason: lockRes.lock_reason
      };
    }

    return Response.json({
      success: true,
      version: reportVersion,
      versionNumber: nextVersion,
      totalHours: totalHours.toFixed(1),
      message: `Report version ${nextVersion} generated successfully`,
      lockResult
    });
  } catch (error) {
    console.error('Error generating report:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

// ===== GET VERSIONS =====

async function getVersions(base44, params) {
  try {
    const {
      client_id,
      report_type,
      reporting_period_start,
      reporting_period_end
    } = params;

    const versions = await base44.entities.ReportVersion.filter({
      client_id,
      report_type,
      reporting_period_start,
      reporting_period_end
    });

    const sorted = versions.sort((a, b) => a.version_number - b.version_number);

    const formatted = sorted.map((v, idx) => ({
      id: v.id,
      versionNumber: v.version_number,
      generatedAt: v.generated_at,
      generatedBy: v.generated_by,
      timeEntryCount: v.time_entry_count,
      totalHours: v.total_hours?.toFixed(1),
      isLatest: idx === sorted.length - 1,
      isLocked: v.is_locked,
      lockedAt: v.locked_at,
      lockedBy: v.locked_by,
      isFinal: v.is_final,
      submittedAt: v.submitted_at,
      pdfUrl: v.pdf_url,
      notes: v.notes
    }));

    return Response.json({
      success: true,
      versions: formatted,
      count: formatted.length,
      latestVersion: formatted.length > 0 ? formatted[formatted.length - 1].versionNumber : null,
      isPeriodLocked: formatted.some(v => v.isLocked)
    });
  } catch (error) {
    console.error('Error getting versions:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

// ===== LOCK PERIOD =====

async function lockPeriod(base44, user, params) {
  try {
    const {
      client_id,
      report_type,
      reporting_period_start,
      reporting_period_end,
      reason = ''
    } = params;

    const versions = await base44.entities.ReportVersion.filter({
      client_id,
      report_type,
      reporting_period_start,
      reporting_period_end
    });

    if (versions.length === 0) {
      return Response.json({
        success: false,
        error: 'No report versions found for this period'
      }, { status: 422 });
    }

    const latestVersion = versions.sort((a, b) => b.version_number - a.version_number)[0];

    const updated = await base44.asServiceRole.entities.ReportVersion.update(latestVersion.id, {
      is_locked: true,
      locked_at: new Date().toISOString(),
      locked_by: user.email,
      lock_reason: reason
    });

    return Response.json({
      success: true,
      versionId: latestVersion.id,
      versionNumber: latestVersion.version_number,
      message: `Reporting period locked (${reporting_period_start} to ${reporting_period_end})`,
      lockedAt: updated.locked_at,
      lockedBy: user.email
    });
  } catch (error) {
    console.error('Error locking period:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

// ===== UNLOCK PERIOD =====

async function unlockPeriod(base44, params) {
  try {
    const {
      client_id,
      report_type,
      reporting_period_start,
      reporting_period_end
    } = params;

    const versions = await base44.entities.ReportVersion.filter({
      client_id,
      report_type,
      reporting_period_start,
      reporting_period_end,
      is_locked: true
    });

    if (versions.length === 0) {
      return Response.json({
        success: false,
        error: 'No locked reporting period found'
      }, { status: 422 });
    }

    const lockedVersion = versions[0];
    await base44.asServiceRole.entities.ReportVersion.update(lockedVersion.id, {
      is_locked: false,
      locked_at: null,
      locked_by: null,
      lock_reason: null
    });

    return Response.json({
      success: true,
      message: 'Reporting period unlocked',
      versionId: lockedVersion.id
    });
  } catch (error) {
    console.error('Error unlocking period:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

// ===== SUBMIT VERSION =====

async function submitVersion(base44, user, params) {
  try {
    const { version_id } = params;

    if (!version_id) {
      return Response.json({
        success: false,
        error: 'version_id required'
      }, { status: 400 });
    }

    const updated = await base44.asServiceRole.entities.ReportVersion.update(version_id, {
      is_final: true,
      submitted_at: new Date().toISOString(),
      submitted_by: user.email
    });

    return Response.json({
      success: true,
      version: updated,
      message: 'Report submitted and finalized',
      submittedAt: updated.submitted_at,
      submittedBy: user.email
    });
  } catch (error) {
    console.error('Error submitting version:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

// ===== GET HISTORY =====

async function getVersionHistory(base44, params) {
  try {
    const {
      client_id,
      report_type,
      reporting_period_start,
      reporting_period_end
    } = params;

    const versions = await base44.entities.ReportVersion.filter({
      client_id,
      report_type,
      reporting_period_start,
      reporting_period_end
    });

    const sorted = versions.sort((a, b) => a.version_number - b.version_number);

    const history = sorted.map((v, idx) => {
      const prevVersion = idx > 0 ? sorted[idx - 1] : null;
      return {
        versionNumber: v.version_number,
        generatedAt: v.generated_at,
        generatedBy: v.generated_by,
        timeEntryCount: v.time_entry_count,
        totalHours: v.total_hours?.toFixed(1),
        entriesAdded: prevVersion
          ? v.time_entry_count - (prevVersion.time_entry_count || 0)
          : v.time_entry_count,
        entriesRemoved: prevVersion
          ? (prevVersion.time_entry_count || 0) - v.time_entry_count
          : 0,
        hoursChanged: prevVersion
          ? (v.total_hours - prevVersion.total_hours).toFixed(1)
          : v.total_hours?.toFixed(1),
        events: [
          {
            action: 'generated',
            timestamp: v.generated_at,
            by: v.generated_by
          },
          ...(v.is_locked ? [{
            action: 'locked',
            timestamp: v.locked_at,
            by: v.locked_by,
            reason: v.lock_reason
          }] : []),
          ...(v.is_final ? [{
            action: 'submitted',
            timestamp: v.submitted_at,
            by: v.submitted_by
          }] : [])
        ]
      };
    });

    return Response.json({
      success: true,
      history,
      totalVersions: history.length
    });
  } catch (error) {
    console.error('Error getting history:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}