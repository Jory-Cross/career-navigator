# Report Versioning and Locking

Tracks report versions with full audit trail, prevents data loss, and allows optional period locking to prevent retroactive changes.

## Overview

**Problem:** Reports are generated multiple times as data changes. Staff need to:
- See what changed between versions
- Regenerate without losing previous versions
- Lock periods to prevent accidental changes after submission

**Solution:** ReportVersion entity auto-increments versions, stores TimeEntry IDs and PDFs, and allows optional period locking.

## Entity Structure

### ReportVersion

```json
{
  "id": "rv_001",
  "client_id": "client_123",
  "report_type": "job_coaching",
  "pdf_template_id": "tmpl_001",
  "entry_type_id": "type_001",
  "reporting_period_start": "2024-04-01",
  "reporting_period_end": "2024-04-30",
  "version_number": 1,
  "pdf_url": "https://storage.com/report_v1.pdf",
  "pdf_file_name": "JobCoaching_202404_v1.pdf",
  "time_entry_ids": ["entry_001", "entry_002", "entry_003"],
  "time_entry_count": 3,
  "total_hours": 10.5,
  "generated_at": "2024-05-01T10:30:00Z",
  "generated_by": "staff@org.com",
  "is_locked": true,
  "locked_at": "2024-05-01T14:00:00Z",
  "locked_by": "supervisor@org.com",
  "lock_reason": "Submitted to VR agency",
  "is_final": true,
  "submitted_at": "2024-05-01T14:05:00Z",
  "submitted_by": "supervisor@org.com"
}
```

## Workflow

### 1. Generate Initial Report

```javascript
const result = await base44.functions.invoke('generateVersionedReport', {
  action: 'generate',
  params: {
    client_id: 'client_123',
    report_type: 'job_coaching',
    entry_type_id: 'type_001',
    pdf_template_id: 'tmpl_001',
    reporting_period_start: '2024-04-01',
    reporting_period_end: '2024-04-30',
    time_entry_ids: ['entry_001', 'entry_002', 'entry_003'],
    pdf_file_url: 'https://storage.com/report.pdf',
    pdf_file_name: 'JobCoaching_202404_v1.pdf'
  }
});
```

**Response:**
```json
{
  "success": true,
  "version": { ...ReportVersion },
  "versionNumber": 1,
  "totalHours": "10.5",
  "message": "Report version 1 generated successfully"
}
```

### 2. Add More Time Entries and Regenerate

Add new time entries, then regenerate. Version increments automatically:

```javascript
// Create new TimeEntry records...

// Regenerate report - version 2 created automatically
const result = await base44.functions.invoke('generateVersionedReport', {
  action: 'generate',
  params: {
    client_id: 'client_123',
    report_type: 'job_coaching',
    entry_type_id: 'type_001',
    pdf_template_id: 'tmpl_001',
    reporting_period_start: '2024-04-01',
    reporting_period_end: '2024-04-30',
    time_entry_ids: [
      'entry_001', 'entry_002', 'entry_003',
      'entry_004', 'entry_005'  // New entries
    ],
    pdf_file_url: 'https://storage.com/report.pdf',
    pdf_file_name: 'JobCoaching_202404_v2.pdf'
  }
});

// Returns versionNumber: 2
// Version 1 still exists unchanged
```

### 3. Get All Versions for Period

```javascript
const result = await base44.functions.invoke('generateVersionedReport', {
  action: 'get_versions',
  params: {
    client_id: 'client_123',
    report_type: 'job_coaching',
    reporting_period_start: '2024-04-01',
    reporting_period_end: '2024-04-30'
  }
});
```

**Response:**
```json
{
  "success": true,
  "versions": [
    {
      "versionNumber": 1,
      "generatedAt": "2024-05-01T10:30:00Z",
      "generatedBy": "staff@org.com",
      "timeEntryCount": 3,
      "totalHours": "10.5",
      "isLatest": false,
      "isLocked": false,
      "isFinal": false,
      "pdfUrl": "https://storage.com/report_v1.pdf"
    },
    {
      "versionNumber": 2,
      "generatedAt": "2024-05-02T14:00:00Z",
      "generatedBy": "staff@org.com",
      "timeEntryCount": 5,
      "totalHours": "18.75",
      "isLatest": true,
      "isLocked": false,
      "isFinal": false,
      "pdfUrl": "https://storage.com/report_v2.pdf"
    }
  ],
  "count": 2,
  "latestVersion": 2,
  "isPeriodLocked": false
}
```

### 4. Lock Reporting Period

After submitting to VR agency:

```javascript
const result = await base44.functions.invoke('generateVersionedReport', {
  action: 'lock_period',
  params: {
    client_id: 'client_123',
    report_type: 'job_coaching',
    reporting_period_start: '2024-04-01',
    reporting_period_end: '2024-04-30',
    reason: 'Submitted to VR agency for approval'
  }
});
```

**Response:**
```json
{
  "success": true,
  "versionId": "rv_002",
  "versionNumber": 2,
  "message": "Reporting period locked (2024-04-01 to 2024-04-30)",
  "lockedAt": "2024-05-02T15:00:00Z",
  "lockedBy": "supervisor@org.com"
}
```

**Effects of Locking:**
- ❌ Cannot create new TimeEntry in locked period
- ❌ Cannot modify TimeEntry in locked period
- ❌ Cannot delete TimeEntry in locked period
- ✓ Can still view/download reports
- ✓ Can regenerate report (creates new version)
- ✓ Can unlock if needed (supervisor only)

### 5. Submit/Finalize Version

Mark report as officially submitted:

```javascript
const result = await base44.functions.invoke('generateVersionedReport', {
  action: 'submit_version',
  params: {
    version_id: 'rv_002'
  }
});
```

**Response:**
```json
{
  "success": true,
  "version": { ...ReportVersion with is_final: true },
  "message": "Report submitted and finalized",
  "submittedAt": "2024-05-02T15:05:00Z",
  "submittedBy": "supervisor@org.com"
}
```

## Version History

Get detailed history with changes between versions:

```javascript
const result = await base44.functions.invoke('generateVersionedReport', {
  action: 'get_history',
  params: {
    client_id: 'client_123',
    report_type: 'job_coaching',
    reporting_period_start: '2024-04-01',
    reporting_period_end: '2024-04-30'
  }
});
```

**Response:**
```json
{
  "success": true,
  "history": [
    {
      "versionNumber": 1,
      "generatedAt": "2024-05-01T10:30:00Z",
      "generatedBy": "staff@org.com",
      "timeEntryCount": 3,
      "totalHours": "10.5",
      "entriesAdded": 3,
      "entriesRemoved": 0,
      "hoursChanged": "10.5",
      "events": [
        {
          "action": "generated",
          "timestamp": "2024-05-01T10:30:00Z",
          "by": "staff@org.com"
        }
      ]
    },
    {
      "versionNumber": 2,
      "generatedAt": "2024-05-02T14:00:00Z",
      "generatedBy": "staff@org.com",
      "timeEntryCount": 5,
      "totalHours": "18.75",
      "entriesAdded": 2,
      "entriesRemoved": 0,
      "hoursChanged": "8.25",
      "events": [
        {
          "action": "generated",
          "timestamp": "2024-05-02T14:00:00Z",
          "by": "staff@org.com"
        },
        {
          "action": "locked",
          "timestamp": "2024-05-02T15:00:00Z",
          "by": "supervisor@org.com",
          "reason": "Submitted to VR agency"
        },
        {
          "action": "submitted",
          "timestamp": "2024-05-02T15:05:00Z",
          "by": "supervisor@org.com"
        }
      ]
    }
  ],
  "totalVersions": 2
}
```

## Time Entry Validation Against Locked Periods

When staff tries to create/modify TimeEntry in locked period:

```javascript
// Backend: validateTimeEntryModification() from authorizationValidation.js
const validation = await validateTimeEntryModification(base44, timeEntry, 'create');

if (!validation.allowed) {
  // Show error to user
  toast.error(validation.message);
  // "Cannot create time entry. Reporting period is locked."
}
```

## Frontend Component

Display versions and manage locking with ReportVersionHistory:

```jsx
import ReportVersionHistory from '@/components/reports/ReportVersionHistory';

<ReportVersionHistory
  clientId="client_123"
  reportType="job_coaching"
  periodStart="2024-04-01"
  periodEnd="2024-04-30"
  onVersionSelect={(version) => {
    // Handle version selection
  }}
/>
```

Features:
- Shows all versions with auto-increment numbers
- Displays changes between versions (entries added/removed, hours changed)
- Shows audit trail (generated by, locked by, submitted by)
- Lock/unlock button for period
- Submit button to finalize
- Download PDF for each version

## Audit Trail

Complete history of each version:

```javascript
const { history } = await base44.functions.invoke('generateVersionedReport', {
  action: 'get_history',
  params: {...}
});

history.forEach(v => {
  console.log(`Version ${v.versionNumber}`);
  v.events.forEach(e => {
    console.log(`  - ${e.action}: ${new Date(e.timestamp).toLocaleString()} by ${e.by}`);
  });
});

// Output:
// Version 1
//   - generated: 5/1/2024, 10:30 AM by staff@org.com
// Version 2
//   - generated: 5/2/2024, 2:00 PM by staff@org.com
//   - locked: 5/2/2024, 3:00 PM by supervisor@org.com
//   - submitted: 5/2/2024, 3:05 PM by supervisor@org.com
```

## Best Practices

### 1. Auto-Increment Versions

Version numbers increment automatically. Never manually set version_number:

```javascript
// ✓ Good - let system auto-increment
const result = await base44.functions.invoke('generateVersionedReport', {
  action: 'generate',
  params: {
    client_id: 'client_123',
    // version_number NOT specified
  }
});

// ❌ Bad - don't set manually
version_number: 3
```

### 2. Store All TimeEntry IDs

Always include complete list of TimeEntry IDs used in report:

```javascript
// ✓ Good - complete list
time_entry_ids: ['entry_001', 'entry_002', 'entry_003']

// ❌ Bad - incomplete
time_entry_ids: ['entry_001', 'entry_003']  // Missing entry_002
```

### 3. Lock After Submission

Lock period immediately after submitting to agency:

```javascript
// 1. Generate report
const reportResult = await base44.functions.invoke('generateVersionedReport', {
  action: 'generate',
  params: {...}
});

// 2. Submit to agency (external)
await sendToVRAgency(reportResult.data.version.pdf_url);

// 3. Lock period
await base44.functions.invoke('generateVersionedReport', {
  action: 'lock_period',
  params: {
    reason: 'Submitted to VR agency, Authorization AUTH-2024-005678'
  }
});
```

### 4. Show Version History to Users

Always display version history so staff can see:
- What changed between versions
- When period was locked
- Who submitted the report

### 5. Allow Unlocking for Corrections

If VR agency requests changes, unlock period:

```javascript
await base44.functions.invoke('generateVersionedReport', {
  action: 'unlock_period',
  params: {...}
});
```

## Integration with PDF Generation

### Current Flow

```
1. Get TimeEntry records for period
2. Transform to report data
3. Fill PDF fields
4. Upload PDF
5. Create ReportVersion with:
   - PDF URL
   - TimeEntry IDs (snapshot)
   - Timestamp
   - Generated by user
```

### Example: Complete Report Generation

```javascript
// 1. Fetch time entries
const entries = await base44.entities.TimeEntry.filter({
  client_id: clientId,
  date: { $gte: periodStart, $lte: periodEnd }
});

// 2. Transform and fill PDF
const pdfData = await transformEntriesToPDF(entries, template);
const pdfBlob = await fillPDFFields(pdfData);

// 3. Upload PDF
const { file_url } = await base44.integrations.Core.UploadFile({ file: pdfBlob });

// 4. Create versioned report
const reportResult = await base44.functions.invoke('generateVersionedReport', {
  action: 'generate',
  params: {
    client_id: clientId,
    report_type: 'job_coaching',
    time_entry_ids: entries.map(e => e.id),
    pdf_file_url: file_url,
    pdf_file_name: `JobCoaching_${periodStart}_${periodEnd}.pdf`
  }
});

// 5. Optionally lock
if (submitNow) {
  await base44.functions.invoke('generateVersionedReport', {
    action: 'lock_period',
    params: {
      reason: 'Submitted with version ' + reportResult.data.versionNumber
    }
  });
}
```

## Compliance and Reporting

### USOR95/96 Compliance

ReportVersion ensures:
- ✓ Each version is a complete snapshot
- ✓ TimeEntry data used is documented (time_entry_ids)
- ✓ Audit trail shows when/who generated
- ✓ Period locking prevents retroactive changes
- ✓ Submission tracking (is_final, submitted_at, submitted_by)

### Report Generation Frequency

Supports multiple versions per period:
- Generate initial report on 4/30
- Add entries on 5/1-5/3, regenerate (version 2)
- Make corrections on 5/4, regenerate (version 3)
- Submit version 3 and lock period

### Audit and Verification

Query complete audit trail:

```javascript
const versions = await base44.entities.ReportVersion.filter({
  client_id: clientId,
  reporting_period_start: '2024-04-01'
});

versions.forEach(v => {
  console.log(`
    Version ${v.version_number}:
    Generated: ${v.generated_at} by ${v.generated_by}
    Entries: ${v.time_entry_count} (${v.total_hours} hours)
    Status: ${v.is_final ? 'Submitted' : 'Draft'}
    ${v.is_locked ? `Locked: ${v.lock_reason}` : ''}
  `);
});
```

## Troubleshooting

### "Reporting period is locked"

**Cause:** Trying to add/modify TimeEntry in locked period

**Solution:**
1. Check if period is locked: `isPeriodLocked` in get_versions response
2. Unlock period if authorized: `action: 'unlock_period'`
3. Modify TimeEntry
4. Regenerate report (creates new version)
5. Re-lock period

### "Version number unexpected"

**Cause:** Manual version_number specified

**Solution:**
- Never set version_number manually
- Let system auto-increment
- System calculates: max(existing versions) + 1

### "TimeEntry IDs don't match report"

**Cause:** TimeEntry records deleted after report created

**Solution:**
- time_entry_ids are immutable snapshots
- Regenerate report if entries change
- Old versions still show original TimeEntry IDs

## Database Queries

### Get all versions for client

```javascript
const allVersions = await base44.entities.ReportVersion.filter({
  client_id: clientId
});
```

### Get versions in date range

```javascript
const versions = await base44.entities.ReportVersion.filter({
  client_id: clientId,
  reporting_period_start: { $gte: '2024-04-01' },
  reporting_period_end: { $lte: '2024-12-31' }
});
```

### Get locked periods

```javascript
const lockedPeriods = await base44.entities.ReportVersion.filter({
  is_locked: true
});
```

### Get submitted reports

```javascript
const submitted = await base44.entities.ReportVersion.filter({
  is_final: true
});
```

## API Reference

See `functions/generateVersionedReport.js` for complete API documentation.

Actions: `generate`, `get_versions`, `lock_period`, `unlock_period`, `submit_version`, `get_history