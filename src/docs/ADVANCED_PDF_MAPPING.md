# Advanced PDF Field Mapping

Enhanced PDFFieldMap entity with scopes, row groups, and aggregations for complex form structures like Utah VR reports.

## Overview

**Old Model** (legacy, still supported):
- Single boolean: `is_repeating_field`
- Source types only: header, row, summary
- Limited transform options

**New Model** (recommended):
- Explicit scope: `mapping_scope` (header, row, summary, static)
- Row organization: `row_group` + `row_field_key`
- Advanced transforms: date_format with options, currency, phone_format
- Conditional display: only fill if conditions met
- Aggregation modes: first, last, concat, sum, count, custom

## Mapping Scopes

### Header Scope
Single value pulled from report header. Used for client info, authorization details, period dates.

```json
{
  "mapping_scope": "header",
  "source_field": "client.full_name",
  "pdf_field_name": "ClientName",
  "transform": "uppercase"
}
```

**Available header fields (from assembled report):**
- `client.first_name`, `client.last_name`, `client.full_name`
- `client.email`, `client.phone`, `client.address`
- `authorization.vr_counselor_name`, `authorization.job_goal`
- `authorization.total_authorized_hours`, `authorization.used_hours`, `authorization.remaining_hours`
- `reporting_period_start`, `reporting_period_end`
- `report_generated_date`

### Row Scope
Repeating field for each entry in report.rows. Organized by row_group.

```json
{
  "mapping_scope": "row",
  "source_field": "date",
  "pdf_field_name": "JobDev_Date_{row}",
  "row_group": "job_development_entries",
  "row_field_key": "date",
  "row_sort_order": 0,
  "transform": "date_format",
  "transform_options": { "format": "MM/DD/YYYY" },
  "max_rows": 20
}
```

**Field naming patterns:**
- `Field_Name_{row}` → becomes `Field_Name_1`, `Field_Name_2`, etc.
- `Field_Name_{{row}}` → same substitution
- `Field_Name_{{rowNum}}` → same as `{{row}}`

**max_rows:** Limits how many PDF rows to fill. Prevents overflow on single-page forms.

### Summary Scope
Rolled-up aggregates from report.summary. Totals, counts, breakdowns.

```json
{
  "mapping_scope": "summary",
  "source_field": "by_entry_type.job_coaching.total_hours",
  "pdf_field_name": "TotalCoachingHours"
}
```

**Available summary fields:**
- `total_entries`, `total_hours`, `total_minutes`
- `average_hours_per_entry`
- `by_entry_type.<type>.count`, `.total_hours`
- `by_employer.<name>.count`, `.total_hours`
- `authorization_hours_used`, `authorization_hours_remaining`

### Static Scope
Literal value, not from report. Useful for form version numbers, organization names.

```json
{
  "mapping_scope": "static",
  "pdf_field_name": "FormVersion",
  "default_value": "2024-Q1"
}
```

## Transforms

### date_format
Formats date string to readable format.

```json
{
  "transform": "date_format",
  "transform_options": { "format": "MM/DD/YYYY" }
}
```

**Supported formats:**
- `MM/DD/YYYY` (default) → 04/15/2024
- `YYYY-MM-DD` → 2024-04-15
- `MMM DD, YYYY` → Apr 15, 2024

### time_format
Converts minutes to HH:MM format.

```json
{
  "transform": "time_format"
}
```

Example: 120 → "2:00", 90 → "1:30"

### hours_from_minutes / duration_hours
Converts minutes to decimal hours.

```json
{
  "transform": "hours_from_minutes"
}
```

Example: 120 → "2.00", 90 → "1.50"

### uppercase
Converts text to all caps.

```json
{
  "transform": "uppercase"
}
```

Example: "Jane Smith" → "JANE SMITH"

### currency
Formats number as currency.

```json
{
  "transform": "currency",
  "transform_options": { "currency": "USD" }
}
```

Example: 45.5 → "$45.50"

### phone_format
Formats 10-digit phone number.

```json
{
  "transform": "phone_format"
}
```

Example: 8015551234 → "(801) 555-1234"

### full_name
Extracts full_name property.

```json
{
  "transform": "full_name"
}
```

## Row Groups

Organize repeating rows by logical groups. Enables multiple row sections on same form.

**Utah VR Example:**
- `job_development_entries` → Job Development section (20 rows max)
- `coaching_sessions` → Job Coaching section (30 rows max)
- `crp_billable_hours` → CRP Billable Hours section (25 rows max)

Each group:
1. Pulls from the same source rows (all report.rows)
2. Filters by conditional_display if specified
3. Maps different fields (date, employer, goal, etc.)
4. Applies same max_rows limit

### Example: Job Development Rows

```json
[
  {
    "mapping_scope": "row",
    "source_field": "date",
    "pdf_field_name": "JobDev_Date_{row}",
    "row_group": "job_development_entries",
    "row_field_key": "date",
    "row_sort_order": 0,
    "transform": "date_format",
    "max_rows": 20
  },
  {
    "mapping_scope": "row",
    "source_field": "duration_hours",
    "pdf_field_name": "JobDev_Hours_{row}",
    "row_group": "job_development_entries",
    "row_field_key": "duration_hours",
    "row_sort_order": 1
  },
  {
    "mapping_scope": "row",
    "source_field": "employer_name",
    "pdf_field_name": "JobDev_Employer_{row}",
    "row_group": "job_development_entries",
    "row_field_key": "employer_name",
    "row_sort_order": 2
  },
  {
    "mapping_scope": "row",
    "source_field": "description",
    "pdf_field_name": "JobDev_Activity_{row}",
    "row_group": "job_development_entries",
    "row_field_key": "description",
    "row_sort_order": 3
  }
]
```

When filled:
```
Row 1: JobDev_Date_1="04/10/2024", JobDev_Hours_1="2.00", JobDev_Employer_1="Target", JobDev_Activity_1="Job search..."
Row 2: JobDev_Date_2="04/15/2024", JobDev_Hours_2="1.50", JobDev_Employer_2="Walmart", JobDev_Activity_2="Interview prep..."
...
```

## Conditional Display

Only fill field if condition is met. Useful for filtering rows by entry type or employer.

```json
{
  "mapping_scope": "row",
  "source_field": "units",
  "pdf_field_name": "JobDev_Units_{row}",
  "row_group": "job_development_entries",
  "conditional_display": {
    "field": "entry_type_code",
    "operator": "equals",
    "value": "job_development"
  }
}
```

**Operators:**
- `equals` - exact match
- `not_equals` - not equal
- `contains` - substring match
- `in_list` - value in array
- `exists` - field not null
- `gt`, `gte`, `lt`, `lte` - numeric comparison

## Aggregation Modes

For fields with multiple values (summaries or grouped data).

```json
{
  "mapping_scope": "summary",
  "source_field": "employer_names",
  "pdf_field_name": "EmployersList",
  "aggregation_mode": "concat",
  "aggregation_separator": "; "
}
```

**Modes:**
- `first` - take first value
- `last` - take last value
- `concat` - join with separator (e.g., "Target; Walmart; Home Depot")
- `sum` - add numeric values
- `count` - count occurrences
- `custom` - use custom_aggregation_fn

## Template Versioning

Support multiple mapping sets per template. Useful when PDF form changes.

```json
{
  "pdf_template_id": "template_123",
  "template_version": "2024-Q1",
  "mapping_scope": "header",
  "source_field": "client.full_name",
  "pdf_field_name": "ClientName"
}
```

When generating PDF, specify version:
```javascript
const response = await base44.functions.invoke('generatePDFReport', {
  templateId: 'template_123',
  templateVersion: '2024-Q1',  // Optional, uses latest if omitted
  reportObject: report
});
```

## Creating Mappings

### Option 1: Manual Database Entry
Create PDFFieldMap records directly in dashboard or via API.

### Option 2: Programmatic Creation

```javascript
import { createUtahVRMappings } from '@/lib/pdfFieldMapper.js';

const mappings = createUtahVRMappings(
  pdfTemplateId,
  'job_coaching',  // Entry type code
  '2024-Q1'        // Template version
);

// Bulk insert
await base44.entities.PDFFieldMap.bulkCreate(mappings);
```

### Option 3: UI Builder (future)
Visual form mapper for non-technical users.

## Complete Utah VR Example

**Setup:**
1. Create PDFTemplate (upload PDF)
2. Create PDFFieldMap records (mappings)
3. Assemble report with TimeEntry, ReportFieldAnswer, Client, ServiceAuthorization
4. Generate PDF

**Mappings:**

```javascript
// Headers
{
  "pdf_template_id": "tpl_utah_vr",
  "template_version": "2024",
  "mapping_scope": "header",
  "source_field": "client.first_name",
  "pdf_field_name": "FirstName"
}

// Summaries
{
  "pdf_template_id": "tpl_utah_vr",
  "template_version": "2024",
  "mapping_scope": "summary",
  "source_field": "total_hours",
  "pdf_field_name": "TotalHours"
}

// Job Development Rows
{
  "pdf_template_id": "tpl_utah_vr",
  "template_version": "2024",
  "mapping_scope": "row",
  "source_field": "date",
  "pdf_field_name": "JobDev_Date_{row}",
  "row_group": "job_development_entries",
  "transform": "date_format",
  "max_rows": 20
}

// Job Coaching Rows
{
  "pdf_template_id": "tpl_utah_vr",
  "template_version": "2024",
  "mapping_scope": "row",
  "source_field": "date",
  "pdf_field_name": "Coaching_Date_{row}",
  "row_group": "coaching_sessions",
  "transform": "date_format",
  "max_rows": 30
}
```

**Fill Process:**

```javascript
const report = {
  header: {
    client: { first_name: "John", last_name: "Doe" },
    ...
  },
  rows: [
    { date: "2024-04-10", entry_type_code: "job_development", ... },
    { date: "2024-04-15", entry_type_code: "job_coaching", ... },
    ...
  ],
  summary: {
    total_hours: "28.50",
    ...
  }
};

const pdfUrl = await base44.functions.invoke('generatePDFReport', {
  templateId: 'tpl_utah_vr',
  reportObject: report
});
```

**Result:**
- Header fields filled once
- Job Development rows 1-20 filled (up to max)
- Job Coaching rows 1-30 filled (up to max)
- Summaries filled once
- PDF generated and uploaded

## Migration from Legacy

Old mapping:
```json
{
  "source_type": "header",
  "source_field": "client.first_name",
  "pdf_field_name": "ClientName",
  "is_repeating_field": false,
  "transform": "none"
}
```

New mapping:
```json
{
  "mapping_scope": "header",
  "source_field": "client.first_name",
  "pdf_field_name": "ClientName",
  "transform": "none"
}
```

**Compatibility:** Old fields still work. `generatePDFReport` supports both structures.

## Best Practices

1. **Group rows logically** - Use row_group for each form section
2. **Set max_rows** - Prevent form overflow
3. **Use sort_order** - Control field order within rows
4. **Transform dates** - Always format dates to MM/DD/YYYY for readability
5. **Version templates** - New form? Create new version with new mappings
6. **Test with sample data** - Verify all fields fill correctly
7. **Conditional display** - Filter rows by type or employer for complex forms
8. **Use static scope** - Form metadata (version, org name) in static fields

## Troubleshooting

### PDF field not filled
**Check:**
1. Field name matches exactly (case-sensitive)
2. Mapping is_active is true
3. Source field exists in report object
4. For rows: max_rows not exceeded

### Wrong row count
**Check:**
1. Report.rows has expected data
2. max_rows setting allows needed rows
3. Conditional_display not filtering unexpectedly

### Transform not applied
**Check:**
1. Transform spelled correctly
2. transform_options match transform (e.g., format with date_format)
3. Value type matches transform (date string for date_format)

### Rows not appearing
**Check:**
1. row_group specified
2. Mapping_scope is 'row' (not 'header')
3. Report.rows is not empty
4. PDF field names use {row} or {{row}} pattern

## See Also

- `lib/pdfFieldMapper.js` - Mapping utilities
- `functions/generatePDFReport.js` - PDF generation
- `entities/PDFFieldMap.json` - Entity schema
- `docs/VR_REPORTING_ARCHITECTURE.md` - Full reporting system