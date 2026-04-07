# PDF Repeating Field Mappings

Maps row data to PDF repeating fields dynamically, supporting variable row counts for USOR95, USOR96, and USOR148 forms.

## Overview

**Problem:** PDFs have a fixed set of fields (Day_1, Day_2, ...Hours_1, Hours_2, etc.). Time entry data has variable row counts.

**Solution:** Define repeating field mappings that loop through rows and fill numbered PDF fields dynamically.

## Architecture

```
TimeEntry + ReportFieldAnswer
        ↓
TimeEntryTransformer
        ↓
{ header, rows: [{date, duration, employer}, ...], summary }
        ↓
PDFFieldMap (with is_repeating_field=true)
        ↓
pdfRepeatingFieldHandler.js
        ↓
PDF field fill instructions: { Day_1, Hours_1, Activity_1, Day_2, ... }
        ↓
fillPDFFields()
        ↓
Generated PDF
```

## Field Mapping Structure

### Standard (Header/Summary) Mapping

```json
{
  "pdf_template_id": "template_abc123",
  "source_field": "client_name",
  "source_type": "header",
  "pdf_field_name": "ClientName",
  "is_repeating_field": false,
  "transform": "none"
}
```

### Repeating Row Mapping

```json
{
  "pdf_template_id": "template_abc123",
  "source_field": "date",
  "source_type": "row",
  "pdf_field_name": "Day_{{row}}",
  "is_repeating_field": true,
  "row_group": "job_development_rows",
  "sort_order": 1,
  "transform": "date_format",
  "transform_options": { "format": "MM/DD/YYYY" },
  "max_rows": 31
}
```

## Repeating Field Properties

| Property | Type | Example | Description |
|----------|------|---------|-------------|
| `is_repeating_field` | boolean | `true` | Marks this as a repeating/row field |
| `row_group` | string | `"job_development_rows"` | Logical grouping for rows (required if is_repeating_field=true) |
| `source_field` | string | `"date"`, `"duration_hours"` | Field from row data to extract |
| `pdf_field_name` | string | `"Day_{{row}}"` | PDF field name pattern (supports {{row}} or {row} placeholder) |
| `source_type` | string | `"row"` | Must be `"row"` for repeating fields |
| `sort_order` | number | `1`, `2`, `3` | Order to fill fields within row_group |
| `row_index` | number | `0`, `1`, `5` | Optional: specific row to fill (for sparse mappings) |
| `transform` | string | `"date_format"` | Optional transformation |
| `transform_options` | object | `{"format": "MM/DD/YYYY"}` | Transformation parameters |
| `max_rows` | number | `31` | Maximum rows to fill (prevents PDF overflow) |
| `page_break_after` | number | `10` | Insert page break after N rows |
| `default_value` | string | `""` | Value if row field is missing |

## PDF Field Name Patterns

### Pattern Substitution

The system replaces row placeholders with 1-indexed row numbers:

| Pattern | Row 0 | Row 1 | Row 2 |
|---------|-------|-------|-------|
| `Day_{{row}}` | `Day_1` | `Day_2` | `Day_3` |
| `Hours_{rowNum}` | `Hours_1` | `Hours_2` | `Hours_3` |
| `Activity_1` (static) | `Activity_1` | - | - |
| `Entry_{{row}}_Notes` | `Entry_1_Notes` | `Entry_2_Notes` | - |

## Supported Transformations

| Transform | Input | Output | Options |
|-----------|-------|--------|---------|
| `none` | Any | As-is | - |
| `date_format` | `"2026-04-01"` | `"04/01/2026"` | `{"format": "MM/DD/YYYY"}` |
| `duration_hours` | `60` (minutes) | `"1.00"` | - |
| `hours_from_minutes` | `90` (minutes) | `"1.50"` | - |
| `uppercase` | `"acme corp"` | `"ACME CORP"` | - |

## Example: Job Development (USOR96)

### Data Flow

```javascript
// TimeEntry data transformed
{
  header: {
    client_name: "John Smith",
    reporting_period_start: "2026-04-01",
    total_hours: "12.50"
  },
  rows: [
    { date: "2026-04-01", duration_minutes: 60, employer_name: "Acme Corp", job_title: "Retail" },
    { date: "2026-04-02", duration_minutes: 120, employer_name: "TechCorp", job_title: "Developer" },
    { date: "2026-04-03", duration_minutes: 90, employer_name: "Acme Corp", job_title: "Retail" }
  ],
  summary: {
    total_entries: 3,
    total_hours: "12.50"
  }
}
```

### Field Mappings

```json
[
  {
    "pdf_field_name": "ClientName",
    "source_field": "client_name",
    "source_type": "header",
    "is_repeating_field": false
  },
  {
    "pdf_field_name": "Day_{{row}}",
    "source_field": "date",
    "source_type": "row",
    "is_repeating_field": true,
    "row_group": "job_development_rows",
    "sort_order": 1,
    "transform": "date_format",
    "transform_options": { "format": "MM/DD/YYYY" }
  },
  {
    "pdf_field_name": "Hours_{{row}}",
    "source_field": "duration_minutes",
    "source_type": "row",
    "is_repeating_field": true,
    "row_group": "job_development_rows",
    "sort_order": 2,
    "transform": "duration_hours"
  },
  {
    "pdf_field_name": "Employer_{{row}}",
    "source_field": "employer_name",
    "source_type": "row",
    "is_repeating_field": true,
    "row_group": "job_development_rows",
    "sort_order": 3
  },
  {
    "pdf_field_name": "JobTitle_{{row}}",
    "source_field": "job_title",
    "source_type": "row",
    "is_repeating_field": true,
    "row_group": "job_development_rows",
    "sort_order": 4
  }
]
```

### Generated PDF Fields

```javascript
{
  ClientName: "John Smith",
  Day_1: "04/01/2026",
  Hours_1: "1.00",
  Employer_1: "Acme Corp",
  JobTitle_1: "Retail",
  Day_2: "04/02/2026",
  Hours_2: "2.00",
  Employer_2: "TechCorp",
  JobTitle_2: "Developer",
  Day_3: "04/03/2026",
  Hours_3: "1.50",
  Employer_3: "Acme Corp",
  JobTitle_3: "Retail"
}
```

## Example: Job Coaching (USOR95)

### Mappings

```json
[
  {
    "pdf_field_name": "ClientName",
    "source_field": "client_name",
    "source_type": "header",
    "is_repeating_field": false
  },
  {
    "pdf_field_name": "CoachingDate_{{row}}",
    "source_field": "date",
    "source_type": "row",
    "is_repeating_field": true,
    "row_group": "coaching_sessions",
    "sort_order": 1,
    "transform": "date_format",
    "transform_options": { "format": "MM/DD/YYYY" }
  },
  {
    "pdf_field_name": "CoachingFocus_{{row}}",
    "source_field": "coaching_focus",
    "source_type": "row",
    "is_repeating_field": true,
    "row_group": "coaching_sessions",
    "sort_order": 2
  },
  {
    "pdf_field_name": "GoalsAddressed_{{row}}",
    "source_field": "goals_addressed",
    "source_type": "row",
    "is_repeating_field": true,
    "row_group": "coaching_sessions",
    "sort_order": 3
  },
  {
    "pdf_field_name": "ClientResponse_{{row}}",
    "source_field": "client_response",
    "source_type": "row",
    "is_repeating_field": true,
    "row_group": "coaching_sessions",
    "sort_order": 4
  }
]
```

## Example: Life Skills / CBH (USOR148)

### Mappings

```json
[
  {
    "pdf_field_name": "SkillArea_{{row}}",
    "source_field": "skill_area",
    "source_type": "row",
    "is_repeating_field": true,
    "row_group": "life_skills_sessions",
    "sort_order": 1
  },
  {
    "pdf_field_name": "ActivityDesc_{{row}}",
    "source_field": "activity_description",
    "source_type": "row",
    "is_repeating_field": true,
    "row_group": "life_skills_sessions",
    "sort_order": 2
  },
  {
    "pdf_field_name": "ClientProgress_{{row}}",
    "source_field": "client_progress",
    "source_type": "row",
    "is_repeating_field": true,
    "row_group": "life_skills_sessions",
    "sort_order": 3
  }
]
```

## Usage in Code

### Fill PDF with Repeating Fields

```javascript
import { compilePDFFieldInstructions } from '@/lib/pdfRepeatingFieldHandler';

// transformed = { header: {...}, rows: [...], summary: {...} }
// mappings = [PDFFieldMap records]

const instructions = compilePDFFieldInstructions(transformed, mappings);
// Returns: { ClientName: "John", Day_1: "04/01/2026", Hours_1: "1.00", ... }

// Fill PDF
const form = pdfDoc.getForm();
Object.entries(instructions).forEach(([fieldName, value]) => {
  const field = form.getFieldByName(fieldName);
  if (field) field.setText(String(value || ''));
});
```

### Validate Repeating Mappings

```javascript
import { validateRepeatingMappings } from '@/lib/pdfRepeatingFieldHandler';

const validation = validateRepeatingMappings(mappings, rowCount);
if (!validation.isValid) {
  validation.errors.forEach(err => console.error(err));
}
```

### Get Max Rows for Group

```javascript
import { getMaxRowsForGroup } from '@/lib/pdfRepeatingFieldHandler';

const maxRows = getMaxRowsForGroup('job_development_rows', mappings);
const rowsToFill = Math.min(actualRows.length, maxRows);
```

## Best Practices

### 1. Row Group Naming

Use descriptive names that include the form:

```
job_development_rows     (USOR96)
job_coaching_sessions    (USOR95)
life_skills_sessions     (USOR148)
cbh_activities           (USOR148 alt)
```

### 2. Sort Order

Number sequentially within a row group to control fill order:

```json
[
  { "sort_order": 1, "source_field": "date" },       // Fill date first
  { "sort_order": 2, "source_field": "duration" },   // Then hours
  { "sort_order": 3, "source_field": "employer" }    // Then employer
]
```

### 3. Max Rows

Always set `max_rows` to prevent PDF overflow:

```json
{
  "max_rows": 31,  // USOR96 has max 31 days
  "page_break_after": 10  // For multi-page forms
}
```

### 4. Date Formatting

Always specify the PDF's expected date format:

```json
{
  "transform": "date_format",
  "transform_options": { "format": "MM/DD/YYYY" }
}
```

### 5. Default Values

Provide sensible defaults for optional fields:

```json
{
  "source_field": "notes",
  "default_value": ""
}
```

## Testing

### Unit Test: Row Field Substitution

```javascript
import { substitutePDFFieldName } from '@/lib/pdfRepeatingFieldHandler';

assert.equal(substitutePDFFieldName("Day_{{row}}", 0), "Day_1");
assert.equal(substitutePDFFieldName("Day_{{row}}", 5), "Day_6");
assert.equal(substitutePDFFieldName("Hours_1", 0), "Hours_1"); // Static, no substitution
```

### Unit Test: Row Field Compilation

```javascript
import { buildRepeatingRowInstructions } from '@/lib/pdfRepeatingFieldHandler';

const rows = [
  { date: "2026-04-01", duration_minutes: 60 },
  { date: "2026-04-02", duration_minutes: 120 }
];

const mappings = [
  { source_field: "date", pdf_field_name: "Day_{{row}}", transform: "date_format" },
  { source_field: "duration_minutes", pdf_field_name: "Hours_{{row}}", transform: "duration_hours" }
];

const instructions = buildRepeatingRowInstructions(rows, mappings);
assert.equal(instructions.Day_1, "04/01/2026");
assert.equal(instructions.Hours_1, "1.00");
assert.equal(instructions.Day_2, "04/02/2026");
assert.equal(instructions.Hours_2, "2.00");
```

## Troubleshooting

### PDF Fields Not Filling

1. Check PDF field names exactly match (case-sensitive)
2. Verify row count doesn't exceed `max_rows`
3. Ensure `source_field` exists in row data
4. Check transformations don't return undefined

### Row Numbers Off by One

PDF fields typically use 1-indexing (Day_1, Day_2), while arrays use 0-indexing.
The system automatically converts: `rowIndex=0` → `{{row}}=1`.

### Missing Rows

If fewer rows exist than PDF fields, remaining fields stay empty (or use `default_value`).
This is intentional to support variable-length time entry reports.

## Migration from Old System

If using legacy `source_type` values like `"time_entry"` or `"report_answer"`:

1. Classify as header/summary (non-repeating)
2. Set `source_type="header"` or `"summary"`
3. Add new repeating mappings with `source_type="row"`
4. Test PDF generation end-to-end