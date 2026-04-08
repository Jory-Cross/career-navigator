# Report Versioning & Period Locking

Manages multi-version reports with period locking to prevent entry modifications after finalization.

## Overview

```
TimeEntry (editable)
    ↓
ReportFieldAnswer (with snapshot) 
    ↓
ReportVersion (immutable, versioned)
    ↓
Locked Period (prevents future TimeEntry changes)
```

**Key Features:**
- Auto-incrementing version numbers
- Previous versions preserved (for audit trail)
- Reporting periods can be locked to prevent entry modifications
- Supervisor override for locked periods
- Final/submitted flag for officially submitted reports

## ReportVersion Entity

### Core Fields

**Identification:**
- `id` - Unique record ID
- `client_id` - Client being reported on
- `entry_type_code` - Entry type (job_coaching, job_development, etc.)

**Period:**
- `report_start_date` (YYYY-MM-DD) - First day of reporting period
- `report_end_date` (YYYY-MM-DD) - Last day of reporting period

**Template & Data:**
- `template_id` - Reference to PDFTemplate
- `template_version` - Version of template (e.g., "2024-Q1") for rollback/comparison
- `included_time_entry_ids` - IDs of TimeEntry records in report
- `included_answer_record_ids` - IDs of ReportFieldAnswer records (audit trail)

**Report File:**
- `generated_file_url` - URL to generated PDF
- `generated_file_name` - Original file name
- `total_hours` - Sum of hours (cached)
- `time_entry_count` - Entry count (cached)

### Versioning

**Auto-Increment:**
- `version_number` - Sequential version (1, 2, 3...)
- Automatically calculated based on previous versions for same period

**Regeneration:**
- `supersedes_report_id` - ID of previous version (null if first)
- Allows tracking which version replaced which
- Old versions preserved for audit trail

### Locking

**Lock Status:**
- `locked` (boolean) - Is period locked?
- `locked_at` (datetime) - When locked
- `locked_by` (email) - Who locked it
- `lock_reason` (string) - Why (e.g., "Submitted to VR", "Finalized")

**Finalization:**
- `is_final` (boolean) - Is this the official submitted version?
- `submitted_at` (datetime) - When submitted
- `submitted_by` (email) - Who submitted

### Audit Trail

- `generated_at` - When report was created
- `generated_by` - Who generated it
- `notes` - Internal notes about version/regeneration reason

## Usage

### Generate Initial Report

```javascript
const response = await base44.functions.invoke('generateVersionedReport', {
  client_id: 'client_001',
  entry_type_code: 'job_coaching',
  pdf_template_id: 'template_001',
  template_version: '2024-Q1',
  report_start_date: '2024-04-01',
  report_end_date: '2024-04-30'
});

// Returns:
{
  success: true,
  report_version_id: 'rv_001',
  version_number: 1,
  pdf_url: '...',
  entries_included: 15,
  message: 'Report generated (version 1)'
}
```

### Regenerate Report (Create New Version)

```javascript
const response = await base44.functions.invoke('generateVersionedReport', {
  client_id: 'client_001',
  entry_type_code: 'job_coaching',
  pdf_template_id: 'template_001',
  template_version: '2024-Q1',
  report_start_date: '2024-04-01',
  report_end_date: '2024-04-30',
  supersedes_report_id: 'rv_001'  // Regenerating from previous version
});

// Returns version 2, supersedes_report_id = 'rv_001'
```

### Lock Reporting Period

```javascript
import { lockReportingPeriod } from '@/lib/reportVersioning.js';

const locked = await lockReportingPeriod(
  base44,
  'rv_001',
  'supervisor@example.com',
  'Submitted to VR agency'
);

// After locking:
// - locked = true
// - locked_at = "2024-04-15T10:30:00Z"
// - locked_by = "supervisor@example.com"
// - lock_reason = "Submitted to VR agency"
```

### Check if Entry Can Be Modified

```javascript
import { canModifyTimeEntry, getLockedPeriodForEntry } from '@/lib/reportVersioning.js';

const timeEntry = await base44.entities.TimeEntry.filter({ id: 'entry_001' })[0];

const { canModify, lockedPeriod } = await canModifyTimeEntry(base44, timeEntry);

if (!canModify) {
  console.log(`Cannot modify: locked by report period ${lockedPeriod.id}`);
  console.log(`Reason: ${lockedPeriod.lock_reason}`);
  console.log(`Locked by: ${lockedPeriod.locked_by} on ${lockedPeriod.locked_at}`);
}
```

### Get Report History

```javascript
import { getReportVersionHistory } from '@/lib/reportVersioning.js';

const versions = await getReportVersionHistory(
  base44,
  'client_001',
  'job_coaching',
  '2024-04-01',
  '2024-04-30'
);

// Returns all versions, sorted by version_number DESC
versions.forEach(v => {
  console.log(`Version ${v.version_number}: ${v.generated_at} by ${v.generated_by}`);
  if (v.supersedes_report_id) {
    console.log(`  Supersedes: ${v.supersedes_report_id}`);
  }
});
```

### Get Active (Current) Report

```javascript
import { getActiveReportVersion } from '@/lib/reportVersioning.js';

const activeReport = await getActiveReportVersion(
  base44,
  'client_001',
  'job_coaching',
  '2024-04-01',
  '2024-04-30'
);

console.log(`Current version: ${activeReport.version_number}`);
console.log(`PDF URL: ${activeReport.generated_file_url}`);
console.log(`Is locked: ${activeReport.locked}`);
```

### Finalize Report (Mark as Submitted)

```javascript
import { finalizeReport } from '@/lib/reportVersioning.js';

const final = await finalizeReport(base44, 'rv_001', 'supervisor@example.com');

// After finalization:
// - is_final = true
// - submitted_at = current timestamp
// - submitted_by = "supervisor@example.com"
// - locked = true (automatically)
// - lock_reason = "Report finalized"
```

### Compare Report Versions

```javascript
import { compareReportVersions } from '@/lib/reportVersioning.js';

const changes = await compareReportVersions(base44, version1, version2);

console.log(`Entries added: ${changes.entries_added.length}`);
console.log(`Entries removed: ${changes.entries_removed.length}`);
console.log(`Hours change: ${changes.hours_change}`);
console.log(`Template changed: ${changes.template_version_changed}`);
```

### Get Report Summary

```javascript
import { getClientReportSummary } from '@/lib/reportVersioning.js';

const summary = await getClientReportSummary(base44, 'client_001');

console.log(`Total report versions: ${summary.total_reports}`);
console.log(`Locked periods: ${summary.locked_periods}`);

summary.active_reports.forEach(report => {
  console.log(`${report.entry_type_code} (${report.start_date} to ${report.end_date})`);
  console.log(`  Version: ${report.version_number}/${report.total_versions}`);
  console.log(`  Locked: ${report.is_locked}, Final: ${report.is_final}`);
});
```

## Workflow: Month-End Reporting

### Step 1: Generate Initial Report
```
Employee submits time entries for April 1-30
→ generateVersionedReport creates version 1
→ PDF generated, version_number = 1
```

### Step 2: Review & Revise
```
Supervisor reviews report
→ Employee adds/fixes some entries for April
→ generateVersionedReport creates version 2 (supersedes version 1)
→ version_number = 2, supersedes_report_id = rv_001
```

### Step 3: Lock Period (Optional)
```
Supervisor locks period to prevent further entry changes
→ lockReportingPeriod('rv_002', supervisor_email, 'Internal review')
→ locked = true
→ Any attempt to create/edit April entries → blocked
```

### Step 4: Finalize & Submit
```
Supervisor submits report to VR agency
→ finalizeReport('rv_002', supervisor_email)
→ is_final = true, submitted_at = now
→ locked = true, lock_reason = "Report finalized"
→ Prevents any modifications unless unlocked by admin
```

## Preventing Entry Modifications in Locked Periods

In TimeEntry create/update operations:

```javascript
import { getLockedPeriodForEntry } from '@/lib/reportVersioning.js';

// Before creating/updating TimeEntry
const lockedPeriod = await getLockedPeriodForEntry(
  base44,
  clientId,
  entryDate,
  entryTypeCode
);

if (lockedPeriod) {
  // Block modification
  throw new Error(
    `Cannot modify entries in locked period (${lockedPeriod.report_start_date} to ${lockedPeriod.report_end_date}). ` +
    `Locked by: ${lockedPeriod.locked_by}. Reason: ${lockedPeriod.lock_reason}`
  );
}

// Safe to create/update entry
```

## Versioning Rules

1. **Version Incrementing:**
   - Each new report for a period increments version_number
   - Example: Same period generated 3 times → versions 1, 2, 3

2. **Superseding:**
   - New version's `supersedes_report_id` points to previous version
   - Old versions never deleted (preserved for audit trail)

3. **Locking Independence:**
   - Locking is per-version
   - Each version can have separate lock status
   - Typically, only active version is locked

4. **Template Version Tracking:**
   - `template_version` field records which template version was used
   - Allows rollback if template definition changes

5. **Final Submission:**
   - `is_final=true` marks official version
   - Only admin can unlock finalized reports
   - Prevents accidental modifications after submission

## Audit Trail

Every report version preserves:
- Which entries were included (ids)
- Which field answers were used (ids)
- Template version used
- When generated and by whom
- Modification history (via supersedes_report_id chain)

Example audit query:
```javascript
// Get full history for a period
const versions = await getReportVersionHistory(
  base44, client_id, entry_type_code, start, end
);

// Trace back through supersedes chain
let current = versions[0];  // Latest
while (current.supersedes_report_id) {
  current = versions.find(v => v.id === current.supersedes_report_id);
  console.log(`← Version ${current.version_number}: ${current.generated_at}`);
}
```

## Best Practices

1. **Always use generateVersionedReport** for PDF creation
   - Ensures version tracking

2. **Lock before finalization**
   - Lock period → Generate final PDF → Finalize report

3. **Check locked status before entry modifications**
   - Use `canModifyTimeEntry()` in frontend/backend

4. **Preserve version history**
   - Never delete old ReportVersion records
   - Audit trail depends on preserving chain

5. **Template versioning**
   - Track which template version each report used
   - Helps if template definitions change

6. **Document lock reasons**
   - Use lock_reason field to explain why period was locked

## API Functions

**lib/reportVersioning.js:**
- `createReportVersion(base44, params)` - Create new version
- `getActiveReportVersion(base44, clientId, typeCode, start, end)` - Get current version
- `getReportVersionHistory(base44, clientId, typeCode, start, end)` - All versions
- `lockReportingPeriod(base44, reportId, lockedBy, reason)` - Lock period
- `unlockReportingPeriod(base44, reportId)` - Unlock period
- `canModifyTimeEntry(base44, timeEntry)` - Check if entry can be edited
- `getLockedPeriodForEntry(base44, clientId, date, typeCode)` - Get lock info
- `finalizeReport(base44, reportId, submittedBy)` - Mark as final/submitted
- `regenerateReportVersion(base44, reportId, newUrl, newName, user)` - Regenerate from existing
- `getClientReportSummary(base44, clientId)` - Overview
- `compareReportVersions(base44, v1, v2)` - Diff two versions

**functions/generateVersionedReport.js:**
- HTTP endpoint for generating versioned reports

## See Also

- `entities/ReportVersion.json` - Entity schema
- `docs/VR_REPORTING_ARCHITECTURE.md` - Overall reporting system
- `docs/SCHEMA_SNAPSHOT_SYSTEM.md` - Field answer snapshots