# VR Reporting Architecture (3-Step)

Clean separation between source records, report assembly, and PDF generation. Never writes back to TimeEntry.

## Overview

```
┌─────────────────────────────────────────────────────────────┐
│ Step 1: SOURCE RECORDS (Read-Only)                          │
│ ─────────────────────────────────────────────────────────── │
│ • TimeEntry              (date, duration, entry_type_code)  │
│ • ReportFieldAnswer      (dynamic field answers per entry)   │
│ • Client                 (name, email, phone, address)       │
│ • ServiceAuthorization   (counselor, goal, auth hours)       │
│ (No writes, no modifications)                                │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 2: REPORT ASSEMBLY (Structured Object)                 │
│ ─────────────────────────────────────────────────────────── │
│ Input: Source records from Step 1                            │
│ Process:                                                     │
│   • Group entries by client, type, employer                  │
│   • Calculate aggregations (totals, summaries)               │
│   • Flatten and structure into report object                 │
│   • Never write back to TimeEntry                            │
│ Output: Structured report { header, rows, summary }          │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 3: PDF GENERATION (Template Fill)                       │
│ ─────────────────────────────────────────────────────────── │
│ Input: Assembled report object (Step 2)                      │
│ Process:                                                     │
│   • Load PDF template                                        │
│   • Map report fields to PDF form fields                     │
│   • Fill fields using assembled data                         │
│   • Apply transforms (date_format, uppercase, etc.)          │
│ Output: PDF file (uploaded to storage)                       │
└─────────────────────────────────────────────────────────────┘
```

## Step 1: Source Records

Read raw data from entities. **No modifications.**

### TimeEntry
```javascript
{
  id: "entry_001",
  client_id: "client_456",
  service_authorization_id: "auth_001",  // Link to authorization
  date: "2024-04-10",
  duration_minutes: 120,
  entry_type_code: "job_coaching",        // Source of truth for type
  entry_type_id: "type_001",
  description: "Interview prep",
  general_notes: "Internal notes",
  start_time: "09:00",
  end_time: "11:00"
}
```

### ReportFieldAnswer
```javascript
{
  id: "rfa_001",
  time_entry_id: "entry_001",
  entry_type_code: "job_coaching",
  answers: {
    employer_name: "Target",
    goal_addressed: "Employment",
    units: 2
  }
}
```

### ServiceAuthorization
```javascript
{
  id: "auth_001",
  client_id: "client_456",
  authorization_number: "AUTH-2024-001234",
  vr_counselor_name: "Jane Smith",
  job_goal: "Retail Manager",
  total_authorized_hours: 40,
  used_hours: 12.5,
  remaining_hours: 27.5,
  status: "active"
}
```

### Client
```javascript
{
  id: "client_456",
  first_name: "John",
  last_name: "Doe",
  email: "john@example.com",
  phone: "801-555-1234",
  address: "123 Main St"
}
```

## Step 2: Report Assembly

Transform source records into structured report object.

### assembleClientReport()

```javascript
const report = await assembleClientReport(base44, clientId, dateFrom, dateTo, options);

// Returns:
{
  metadata: {
    client_id: "client_456",
    generated_at: "2024-04-15T10:30:00Z",
    reporting_period_start: "2024-04-01",
    reporting_period_end: "2024-04-30",
    total_entries: 15
  },

  header: {
    // Client info
    client_full_name: "John Doe",
    client_email: "john@example.com",
    client_phone: "801-555-1234",
    
    // Period
    reporting_period_start: "2024-04-01",
    reporting_period_end: "2024-04-30",
    
    // Totals
    total_entries: 15,
    total_minutes: 1800,
    total_hours: "30.00",
    
    // Authorization
    authorization_number: "AUTH-2024-001234",
    vr_counselor_name: "Jane Smith",
    job_goal: "Retail Manager",
    total_authorized_hours: 40,
    hours_used: 12.5,
    hours_remaining: 27.5,
    
    // Metadata
    report_generated_date: "2024-04-15"
  },

  rows: [
    {
      row_number: 1,
      entry_id: "entry_001",
      date: "2024-04-10",
      duration_minutes: 120,
      duration_hours: "2.00",
      entry_type_code: "job_coaching",
      description: "Interview prep",
      general_notes: "Internal notes",
      
      // Dynamic answers from ReportFieldAnswer
      employer_name: "Target",
      goal_addressed: "Employment",
      units: 2,
      
      // Links
      service_authorization_id: "auth_001",
      _authorization_valid: true
    },
    // ... more rows
  ],

  summary: {
    total_entries: 15,
    total_minutes: 1800,
    total_hours: "30.00",
    average_hours_per_entry: "2.00",
    
    by_entry_type: {
      job_coaching: {
        count: 10,
        total_minutes: 1200,
        total_hours: "20.00",
        entry_ids: ["entry_001", ...]
      },
      cbh: {
        count: 5,
        total_minutes: 600,
        total_hours: "10.00",
        entry_ids: ["entry_002", ...]
      }
    },
    
    by_employer: {
      Target: {
        count: 8,
        total_minutes: 960,
        total_hours: "16.00",
        entry_ids: [...]
      }
    },
    
    field_totals: {
      units: { sum: 16, count: 8, avg: 2 }
    },
    
    authorization_hours_used: 12.5,
    authorization_hours_remaining: 27.5
  }
}
```

### Key Principles

1. **Read-only**: Never modifies TimeEntry or source records
2. **Flat structure**: All data in header/rows/summary for easy mapping
3. **Include context**: Authorization data, field answers, metadata
4. **Group by**: Entry type, employer, period (flexible)
5. **Calculate**: Totals, averages, remainders
6. **Reference**: Keep IDs for audit trail (entry_id, authorization_id)

## Step 3: PDF Generation

Fill PDF template from assembled report.

### fillAndUploadPDF()

```javascript
const pdfUrl = await fillAndUploadPDF(base44, template, fieldMaps, report);
```

**Input:**
- `template`: PDFTemplate (pdf_file_url)
- `fieldMaps`: PDFFieldMap[] (field definitions)
- `report`: Assembled report object (Step 2)

**Process:**
1. Load PDF template from URL
2. Get form fields from PDF
3. For each mapping:
   - Resolve value from report object (header/rows/summary)
   - Apply transform (date_format, uppercase, etc.)
   - Fill PDF field
4. Flatten and save
5. Upload to storage

**Field Mapping Example:**
```json
{
  "source_type": "header",
  "source_field": "vr_counselor_name",
  "pdf_field_name": "VRCounselorField",
  "transform": "uppercase"
}
```

## Functions

### getReportAggregation (Step 1)

Fetches source records and performs analytics. For dashboards, not PDF.

```javascript
const response = await base44.functions.invoke('getReportAggregation', {
  action: 'aggregate',
  client_id: 'client_456',
  entry_type_code: 'job_coaching',
  date_from: '2024-04-01',
  date_to: '2024-04-30'
});

// Returns: { by_client, by_month, by_entry_type, field_summary }
```

**Actions:**
- `aggregate` - Group and count
- `monthly_stats` - Break down by month
- `export_csv` - Export as CSV

### generatePDFReport (Step 3)

Fills PDF from pre-assembled report or quick assembly.

```javascript
const response = await base44.functions.invoke('generatePDFReport', {
  templateId: 'template_123',
  
  // Option A: Pre-assembled report (recommended)
  reportObject: { header: {...}, rows: [...], summary: {...} },
  
  // Option B: Assemble on-the-fly (backward compat)
  clientId: 'client_456',
  dateFrom: '2024-04-01',
  dateTo: '2024-04-30'
});

// Returns: { pdf_url }
```

### generateVRBatchReports (Step 1→2→3)

Orchestrates full pipeline for multiple clients.

```javascript
const response = await base44.functions.invoke('generateVRBatchReports', {
  pdf_template_id: 'template_123',
  entry_type: 'job_coaching',
  client_ids: ['client_456', 'client_789'],
  date_from: '2024-04-01',
  date_to: '2024-04-30'
});

// Returns: {
//   batch_id: "batch_001",
//   total_clients: 2,
//   successful: 2,
//   documents: [...]
// }
```

## Data Flow Example

**Scenario**: Generate job_coaching report for client John Doe (April 2024)

### Step 1: Fetch Source Records

```javascript
// getReportAggregation → fetch
const timeEntries = [
  { id: "e1", date: "2024-04-10", duration: 120, entry_type_code: "job_coaching" },
  { id: "e2", date: "2024-04-15", duration: 90, entry_type_code: "job_coaching" },
  { id: "e3", date: "2024-04-20", duration: 150, entry_type_code: "job_coaching" }
];

const answers = [
  { time_entry_id: "e1", answers: { employer_name: "Target", goal_addressed: "Employment" } },
  { time_entry_id: "e2", answers: { employer_name: "Walmart", goal_addressed: "Employment" } },
  { time_entry_id: "e3", answers: { employer_name: "Target", goal_addressed: "Skill Building" } }
];

const client = { first_name: "John", last_name: "Doe", email: "john@example.com" };

const auth = {
  authorization_number: "AUTH-2024-001234",
  vr_counselor_name: "Jane Smith",
  job_goal: "Retail Manager",
  total_authorized_hours: 40,
  used_hours: 12,
  remaining_hours: 28
};
```

### Step 2: Assemble Report

```javascript
// assembleClientReport()
report = {
  header: {
    client_full_name: "John Doe",
    total_entries: 3,
    total_hours: "8.00",
    authorization_number: "AUTH-2024-001234",
    vr_counselor_name: "Jane Smith"
  },
  rows: [
    { row_number: 1, date: "2024-04-10", duration_hours: "2.00", employer_name: "Target", ... },
    { row_number: 2, date: "2024-04-15", duration_hours: "1.50", employer_name: "Walmart", ... },
    { row_number: 3, date: "2024-04-20", duration_hours: "2.50", employer_name: "Target", ... }
  ],
  summary: {
    total_hours: "8.00",
    by_employer: {
      Target: { count: 2, total_hours: "4.50" },
      Walmart: { count: 1, total_hours: "1.50" }
    }
  }
};
```

### Step 3: Fill PDF

```javascript
// fillAndUploadPDF()
const fieldMaps = [
  { source_type: "header", source_field: "client_full_name", pdf_field_name: "ClientName" },
  { source_type: "header", source_field: "vr_counselor_name", pdf_field_name: "VRCounselor", transform: "uppercase" },
  { source_type: "summary", source_field: "total_hours", pdf_field_name: "TotalHours" },
  { is_repeating_field: true, source_field: "date", pdf_field_name: "Date_{rowNum}" },
  { is_repeating_field: true, source_field: "employer_name", pdf_field_name: "Employer_{rowNum}" }
];

// PDF gets filled:
// ClientName = "John Doe"
// VRCounselor = "JANE SMITH"
// TotalHours = "8.00"
// Date_1 = "2024-04-10", Employer_1 = "Target"
// Date_2 = "2024-04-15", Employer_2 = "Walmart"
// Date_3 = "2024-04-20", Employer_3 = "Target"

pdfUrl = "https://storage.example.com/report_john_doe_job_coaching.pdf";
```

## Benefits of 3-Step Architecture

| Aspect | Benefit |
|--------|---------|
| **Separation of Concerns** | Each step has clear responsibility |
| **No Write-backs** | TimeEntry never modified after creation |
| **Reusable Assembly** | Report object used for PDF, dashboards, exports |
| **Debuggable** | Print report object to see exactly what gets filled |
| **Flexible** | Swap PDF templates without changing assembly |
| **Auditable** | All source data preserved in report snapshot |
| **Efficient** | Fetch data once, use multiple times |

## Common Patterns

### Pattern 1: Generate Single PDF

```javascript
// Assemble first
const report = await assembleClientReport(base44, clientId, dateFrom, dateTo);

// Then fill PDF
const pdfUrl = await base44.functions.invoke('generatePDFReport', {
  templateId: 'template_123',
  reportObject: report
});
```

### Pattern 2: Batch Reports

```javascript
const response = await base44.functions.invoke('generateVRBatchReports', {
  pdf_template_id: 'template_123',
  entry_type: 'job_coaching',
  client_ids: ['c1', 'c2', 'c3'],
  date_from: '2024-04-01',
  date_to: '2024-04-30'
});
```

### Pattern 3: Dashboard Analytics

```javascript
const stats = await base44.functions.invoke('getReportAggregation', {
  action: 'aggregate',
  date_from: '2024-04-01',
  date_to: '2024-04-30'
});

// Display: total hours, by entry type, by client
```

### Pattern 4: Group by Employer

```javascript
const report = await assembleClientReport(base44, clientId, dateFrom, dateTo, {
  groupByEmployer: true  // Auto-group rows by employer
});

// report.groups = [ { employer: "Target", rows: [...], summary: {...} } ]
```

## Troubleshooting

### PDF field not filled

**Check:**
1. PDF field name matches exactly in mapping
2. Value exists in report object at expected path
3. Transform applied correctly (check actual value)

```javascript
// Debug: Print report structure
console.log(JSON.stringify(report, null, 2));
console.log('Looking for:', mapping.source_field, 'in', mapping.source_type);
```

### Missing data in report

**Check:**
1. TimeEntry records exist for date range
2. Client exists and is linked
3. ServiceAuthorization is active and covers date range
4. ReportFieldAnswer records created (if using dynamic fields)

### Authorization hours not showing

**Check:**
1. TimeEntry.service_authorization_id is set
2. ServiceAuthorization.id matches
3. Authorization date range covers time entries
4. Status is 'active'

## Migration Checklist

If updating from old system:

- [ ] Ensure all functions use assembleClientReport() (Step 2)
- [ ] Never modify TimeEntry during report generation
- [ ] Pass assembled report to fillAndUploadPDF() (Step 3)
- [ ] Update PDF mappings to use new field names (entry_type_code not category)
- [ ] Test batch reports with multiple clients
- [ ] Verify authorization data appears in headers
- [ ] Check repeating row fields match new row structure

## See Also

- `lib/reportAssembly.js` - Step 2 implementation
- `functions/generatePDFReport.js` - Step 3 implementation
- `functions/generateVRBatchReports.js` - Full pipeline
- `functions/getReportAggregation.js` - Analytics (Step 1)
- `entities/PDFFieldMap.json` - Field mapping schema
- `entities/PDFTemplate.json` - Template schema