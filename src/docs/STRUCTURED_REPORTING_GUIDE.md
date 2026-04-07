# Structured Time Entry & VR Reporting System

## Overview

Time entries now enforce **structured data collection** aligned with VR PDF report requirements:

- **Define entry types** with specific fields (not free text)
- **Store answers** with field identifiers for precise mapping
- **Aggregate data** by client, month, and service type
- **Generate batch reports** with accurate field population
- **Save to Documents** for audit trail and client records

---

## Architecture

### 1. Entry Type Definitions (EntryType Entity)

Each service category has a defined entry type:

```json
{
  "name": "Job Coaching",
  "code": "job_coaching",
  "description": "Services related to job coaching and employment support",
  "is_active": true,
  "color": "#3b82f6"
}
```

### 2. Report Field Templates (ReportFieldTemplate Entity)

Each field is defined with metadata for form rendering and PDF mapping:

```json
{
  "entry_type_id": "entry_type_123",
  "entry_type_code": "job_coaching",
  "field_key": "employer_name",
  "label": "Employer Name",
  "field_type": "text",
  "is_required": true,
  "order": 1,
  "section": "Employer Info",
  "placeholder": "e.g., Acme Corp",
  "help_text": "Name of the employer where coaching occurred"
}
```

### 3. Time Entries (TimeEntry Entity)

Core entry with duration and entry type reference:

```json
{
  "client_id": "client_123",
  "date": "2026-04-07",
  "duration_minutes": 60,
  "entry_type_id": "entry_type_123",
  "description": "Job coaching session"
}
```

### 4. Report Field Answers (ReportFieldAnswer Entity)

**Structured answers** keyed by field_key:

```json
{
  "time_entry_id": "entry_123",
  "entry_type_id": "entry_type_123",
  "entry_type_code": "job_coaching",
  "answers": {
    "employer_name": "Acme Corp",
    "job_title": "Retail Associate",
    "goal_addressed": "Employment",
    "units": 1,
    "notes": "Interview preparation"
  },
  "is_complete": true,
  "submitted_at": "2026-04-07T14:30:00Z"
}
```

### 5. PDF Templates & Field Mapping (PDFTemplate + PDFFieldMap)

Template maps system fields to PDF form fields:

```json
{
  "pdf_template_id": "template_123",
  "source_field": "employer_name",
  "source_type": "report_answer",
  "pdf_field_name": "EmployerName",
  "transform": "none"
}
```

**Source Types:**
- `time_entry` - TimeEntry fields (date, duration_minutes)
- `report_answer` - Fields from ReportFieldAnswer.answers
- `client` - Client profile fields
- `report_field` - Calculated fields (month_year, total_hours, entry_count)

**Transforms:**
- `none` - Use value as-is
- `date_format` - Format date (MM/DD/YYYY)
- `hours_from_minutes` - Convert minutes to decimal hours
- `uppercase` - Convert to uppercase
- `sum` - Sum all values for this field
- `count` - Count occurrences
- `last` - Use last value only

---

## Data Flow

### Creating a Time Entry

1. **Staff member** selects entry type (Job Coaching, Resume Work, etc.)
2. **Form loads** with defined fields for that entry type (from ReportFieldTemplate)
3. **Staff enters** values for each field
4. **System saves**:
   - TimeEntry (date, duration, entry_type_id)
   - ReportFieldAnswer (all field_key → value mappings)
5. **Data is structured** and ready for reporting

### Generating a Report

1. **Admin selects** template, entry type, date range, clients
2. **System queries**:
   - TimeEntry records matching filters
   - ReportFieldAnswer records for those entries
3. **System aggregates** field data (sum, count, last value, concat)
4. **System fills PDF**:
   - Maps source fields → PDF fields using PDFFieldMap
   - Applies transformations
   - Uses aggregated values
5. **PDF saved** to client Documents
6. **ReportBatch created** for audit trail

---

## Querying Structured Data

### Aggregation by Client

Get all time entries for a client across a date range:

```javascript
const result = await base44.functions.invoke('getReportAggregation', {
  action: 'aggregate',
  client_id: 'client_123',
  date_from: '2026-01-01',
  date_to: '2026-12-31'
});

// Returns:
// {
//   total_entries: 45,
//   total_hours: 36.5,
//   by_month: { '2026-01': {...}, '2026-02': {...} },
//   by_entry_type: { 'job_coaching': {...}, 'resume_work': {...} },
//   field_summary: { 'employer_name': {...}, 'job_title': {...} }
// }
```

### Aggregation by Month

Get stats for a specific month:

```javascript
const result = await base44.functions.invoke('getReportAggregation', {
  action: 'monthly_stats',
  year: 2026,
  month: 4
});
```

### Aggregation by Service Type

Get stats for a specific entry type:

```javascript
const result = await base44.functions.invoke('getReportAggregation', {
  action: 'aggregate',
  entry_type_id: 'job_coaching',
  date_from: '2026-01-01',
  date_to: '2026-12-31'
});
```

### Field-Specific Queries

Get only certain fields:

```javascript
const result = await base44.functions.invoke('getReportAggregation', {
  action: 'aggregate',
  client_id: 'client_123',
  field_keys: ['employer_name', 'job_title', 'goal_addressed'],
  date_from: '2026-01-01',
  date_to: '2026-12-31'
});
```

---

## Batch Report Generation

Generate reports for multiple clients:

```javascript
const batch = await base44.functions.invoke('generateVRBatchReports', {
  pdf_template_id: 'template_123',
  entry_type: 'job_coaching',
  client_ids: ['client_1', 'client_2', 'client_3'],
  date_from: '2026-01-01',
  date_to: '2026-03-31'
});

// Returns:
// {
//   batch_id: 'batch_xyz',
//   total_clients: 3,
//   successful: 3,
//   failed: 0,
//   documents: [
//     { client_id: 'client_1', document_id: 'doc_123', pdf_url: '...' },
//     ...
//   ]
// }
```

### What Happens in Batch Processing

For each client:
1. Fetch TimeEntry records (filtered by entry_type, date range)
2. Fetch ReportFieldAnswer records (structured field data)
3. Aggregate answers by field_key
4. Load PDF template
5. Apply field mappings + transformations
6. Fill PDF fields
7. Save filled PDF to Documents
8. Record in ReportBatch

---

## PDF Field Mapping Examples

### Example 1: Simple Field Copy

Job Title from structured answer → PDF field:

```json
{
  "source_field": "job_title",
  "source_type": "report_answer",
  "pdf_field_name": "JobTitle",
  "transform": "none"
}
```

### Example 2: Aggregated Sum

Total hours from all time entries → PDF field:

```json
{
  "source_field": "duration_minutes",
  "source_type": "time_entry",
  "pdf_field_name": "TotalHours",
  "transform": "hours_from_minutes"
}
```

### Example 3: Last Value

Most recent employer from multiple entries → PDF field:

```json
{
  "source_field": "employer_name",
  "source_type": "report_answer",
  "pdf_field_name": "CurrentEmployer",
  "transform": "last"
}
```

### Example 4: Count

Number of entries in period → PDF field:

```json
{
  "source_field": "entry_count",
  "source_type": "time_entry",
  "pdf_field_name": "EntryCount",
  "transform": "count"
}
```

---

## Data Aggregation Examples

### By Client Summary

```javascript
const agg = result.by_client['client_123'];
// {
//   count: 12,                    // 12 entries
//   total_minutes: 720,           // 12 hours
// }
```

### By Month + Entry Type

```javascript
const agg = result.by_month['2026-04'].by_entry_type['job_coaching'];
// {
//   count: 5,
//   total_minutes: 300
// }
```

### Field Summary

```javascript
const fieldData = result.field_summary['employer_name'];
// {
//   count: 8,                    // Appears in 8 entries
//   values: ['Acme Corp', 'Acme Corp', 'TechCorp', ...],
//   unique_count: 3              // 3 unique employers
// }
```

---

## Setting Up a New Entry Type

### Step 1: Create EntryType

```javascript
const entryType = await base44.entities.EntryType.create({
  name: 'Pre-ETS Services',
  code: 'pre_ets',
  description: 'Pre-Employment Transition Services for students',
  is_active: true,
  color: '#10b981'
});
```

### Step 2: Define Report Fields

```javascript
const fields = [
  {
    entry_type_id: entryType.id,
    field_key: 'student_skill_area',
    label: 'Skill Area Addressed',
    field_type: 'select',
    options: ['Job Readiness', 'Life Skills', 'Academic', 'Social'],
    is_required: true,
    section: 'Service Details',
    order: 1
  },
  {
    entry_type_id: entryType.id,
    field_key: 'student_level',
    label: 'Student Grade Level',
    field_type: 'select',
    options: ['9th', '10th', '11th', '12th'],
    is_required: true,
    section: 'Student Info',
    order: 2
  }
];

for (const field of fields) {
  await base44.entities.ReportFieldTemplate.create(field);
}
```

### Step 3: Create PDF Template

```javascript
const template = await base44.entities.PDFTemplate.create({
  entry_type_id: entryType.id,
  entry_type_code: 'pre_ets',
  name: 'Pre-ETS Monthly Report',
  pdf_file_url: 'https://...pre-ets-form.pdf',
  version: '2026-Q1'
});
```

### Step 4: Map Fields to PDF

```javascript
const mappings = [
  {
    pdf_template_id: template.id,
    source_field: 'student_skill_area',
    source_type: 'report_answer',
    pdf_field_name: 'SkillArea'
  },
  {
    pdf_template_id: template.id,
    source_field: 'student_level',
    source_type: 'report_answer',
    pdf_field_name: 'StudentGrade'
  },
  {
    pdf_template_id: template.id,
    source_field: 'total_hours',
    source_type: 'time_entry',
    pdf_field_name: 'TotalServiceHours',
    transform: 'hours_from_minutes'
  }
];

for (const mapping of mappings) {
  await base44.entities.PDFFieldMap.create(mapping);
}
```

---

## Validation & Data Quality

### TimeEntry Validation

- `duration_minutes` required
- `client_id` required
- `date` must be valid date
- `entry_type_id` must reference valid EntryType

### ReportFieldAnswer Validation

- `time_entry_id` must reference valid TimeEntry
- `entry_type_id` must match TimeEntry.entry_type_id
- `answers` must include all required fields from ReportFieldTemplate
- Fields matching the entry_type_code's defined fields

### PDF Field Mapping Validation

- `source_field` must exist in source data
- `pdf_field_name` must exist in PDF template
- Transform must be valid (none, date_format, hours_from_minutes, etc.)

---

## Exporting Data

### CSV Export

```javascript
const csv = await base44.functions.invoke('getReportAggregation', {
  action: 'export_csv',
  date_from: '2026-01-01',
  date_to: '2026-12-31'
});

// Returns CSV with:
// - Total entries / hours
// - By month breakdown
// - By client breakdown
// - By entry type breakdown
```

---

## Common Patterns

### Pattern 1: Monthly Reporting

```javascript
for (let month = 1; month <= 12; month++) {
  const stats = await base44.functions.invoke('getReportAggregation', {
    action: 'monthly_stats',
    year: 2026,
    month: month
  });
  
  // Save to file, email, or display
}
```

### Pattern 2: Client-Specific Report

```javascript
// Get all entries for a client
const entries = await base44.functions.invoke('getReportAggregation', {
  action: 'aggregate',
  client_id: clientId,
  date_from: 'start_date',
  date_to: 'end_date'
});

// Generate PDF using batch function
const batch = await base44.functions.invoke('generateVRBatchReports', {
  pdf_template_id: templateId,
  entry_type: 'job_coaching',
  client_ids: [clientId],
  date_from: 'start_date',
  date_to: 'end_date'
});
```

### Pattern 3: Compliance Audit

```javascript
// Check data quality
const stats = await base44.functions.invoke('getReportAggregation', {
  action: 'aggregate'
});

// Verify all time entries have field answers
const timeEntries = await base44.entities.TimeEntry.list();
const answers = await base44.entities.ReportFieldAnswer.list();
const entriesWithoutAnswers = timeEntries.filter(te =>
  !answers.find(a => a.time_entry_id === te.id)
);

// Alert if gaps found
if (entriesWithoutAnswers.length > 0) {
  console.warn(`${entriesWithoutAnswers.length} entries missing field answers`);
}
```

---

## Migration from Old System

If upgrading from free-text time entries:

1. **Create EntryType** for each existing service category
2. **Define ReportFieldTemplate** for each entry type
3. **Backfill ReportFieldAnswer** records from old entries
   - Parse old free-text fields into structured data
   - Map to field_keys
   - Save to ReportFieldAnswer
4. **Test PDF generation** with old and new data
5. **Update forms** to use new StructuredVRTimeEntryForm

---

## Testing Checklist

- [ ] EntryType created and visible in form
- [ ] ReportFieldTemplate fields display correctly
- [ ] Form validation works (required fields)
- [ ] TimeEntry + ReportFieldAnswer both created
- [ ] Aggregation returns correct counts
- [ ] PDF field mapping applies correctly
- [ ] Batch generation succeeds for multiple clients
- [ ] PDF saved to client Documents
- [ ] CSV export contains all data
- [ ] Data persists across page reloads