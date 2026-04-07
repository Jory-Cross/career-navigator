# Time Entry Transformer

Transforms raw TimeEntry + ReportFieldAnswer records into structured PDF data without modifying originals.

## Purpose

- **Group** entries by client, entry type, employer, date range
- **Transform** into PDF-ready structure: header fields, repeating rows, summary data
- **Preserve** original records (read-only transformation)
- **Feed** structured output into PDF generation

## Architecture

```
TimeEntry + ReportFieldAnswer
            ↓
    TimeEntryTransformer
            ↓
  { header, rows, summary }
            ↓
    fillPDFFields()
            ↓
       PDF Document
```

## Usage

### Basic Transform

```javascript
import { TimeEntryTransformer } from '@/lib/timeEntryTransformer';

const transformer = new TimeEntryTransformer(timeEntries, fieldAnswers, client);
const { header, rows, summary } = transformer.transform();

// header: { client_name, report_date, total_hours, ... }
// rows: [ { date, duration_hours, employer_name, ... }, ... ]
// summary: { total_entries, by_entry_type, by_employer, ... }
```

### From Base44 SDK

```javascript
import { createTransformerForClient } from '@/lib/timeEntryTransformer';

const transformer = await createTransformerForClient(
  base44,
  clientId,
  '2026-01-01',
  '2026-03-31'
);

const transformed = transformer.transform();
```

### Multiple Clients

```javascript
import { createTransformersForClients } from '@/lib/timeEntryTransformer';

const transformers = await createTransformersForClients(
  base44,
  ['client_1', 'client_2', 'client_3'],
  '2026-01-01',
  '2026-03-31'
);

// transformers = {
//   client_1: TimeEntryTransformer,
//   client_2: TimeEntryTransformer,
//   ...
// }
```

## Output Structure

### Header (Client & Period Info)

```javascript
{
  client_name: "John Smith",
  client_email: "john@example.com",
  client_phone: "555-0123",
  client_address: "123 Main St",
  reporting_period_start: "2026-04-01",
  reporting_period_end: "2026-04-30",
  reporting_month: "April 2026",
  report_generated_date: "2026-04-07",
  total_entries: 12,
  total_hours: "12.50",
  total_minutes: 750
}
```

### Rows (Repeating Data)

```javascript
[
  {
    row_number: 1,
    date: "2026-04-01",
    duration_minutes: 60,
    duration_hours: "1.00",
    entry_type: "job_coaching",
    category: "job_coaching",
    description: "Interview preparation",
    general_notes: "Client practiced behavioral questions",
    // Spread structured answers from ReportFieldAnswer
    employer_name: "Acme Corp",
    job_title: "Retail Associate",
    goal_addressed: "Employment",
    units: 1,
    _has_answers: true,
    _answer_count: 4
  },
  // ... more rows
]
```

### Summary (Aggregations)

```javascript
{
  total_entries: 12,
  total_hours: "12.50",
  total_minutes: 750,
  average_hours_per_entry: "1.04",
  
  // Aggregated by entry type
  by_entry_type: {
    job_coaching: {
      count: 8,
      total_minutes: 480,
      total_hours: "8.00",
      average_hours: "1.00"
    },
    resume_work: {
      count: 4,
      total_minutes: 270,
      total_hours: "4.50",
      average_hours: "1.13"
    }
  },
  
  // Aggregated by employer
  by_employer: {
    "Acme Corp": {
      count: 7,
      total_minutes: 420,
      total_hours: "7.00",
      average_hours: "1.00"
    },
    "TechCorp": {
      count: 5,
      total_minutes: 330,
      total_hours: "5.50",
      average_hours: "1.10"
    }
  },
  
  // Numeric field totals
  field_totals: {
    units: {
      sum: 12,
      count: 12,
      values: [1, 1, 1, ...]
    }
  },
  
  date_range: {
    start: "2026-04-01",
    end: "2026-04-30"
  }
}
```

## Grouping Methods

### By Client

```javascript
const grouped = transformer.groupByClient();
// { client_1: [entries...], client_2: [entries...] }
```

### By Entry Type

```javascript
const grouped = transformer.groupByEntryType();
// { job_coaching: [entries...], resume_work: [entries...] }
```

### By Employer

```javascript
const grouped = transformer.groupByEmployer('employer_name');
// { 'Acme Corp': [entries...], 'TechCorp': [entries...] }
```

### By Month

```javascript
const grouped = transformer.groupByMonth();
// { '2026-04': [entries...], '2026-05': [entries...] }
```

### By Date Range

```javascript
const filtered = transformer.groupByDateRange('2026-04-01', '2026-04-30');
// [entries...]
```

## Filtering & Limiting

### Filter Rows

```javascript
const filtered = transformer.filterRows(entry => 
  entry.entry_type_id === 'job_coaching'
);

const transformed = filtered.transform();
// Only job coaching entries
```

### Limit Rows (for pagination)

```javascript
const page1 = transformer.limitRows(10); // First 10 entries
const { rows } = page1.transform();
```

### Chaining

```javascript
const transformed = transformer
  .filterRows(e => e.category === 'job_coaching')
  .limitRows(5)
  .transform();
```

## PDF Mapping Source Types

The transformer supports these source types in PDFFieldMap:

### `header` - Client & period info

```json
{
  "source_type": "header",
  "source_field": "client_name",
  "pdf_field_name": "ClientName"
}
```

Available fields: `client_name`, `client_email`, `client_phone`, `client_address`, `reporting_period_start`, `reporting_period_end`, `reporting_month`, `report_generated_date`, `total_entries`, `total_hours`, `total_minutes`

### `summary` - Aggregated data

```json
{
  "source_type": "summary",
  "source_field": "total_hours",
  "pdf_field_name": "TotalHours",
  "transform": "none"
}
```

Available fields: `total_entries`, `total_hours`, `total_minutes`, `average_hours_per_entry`, `by_entry_type_*`, `by_employer_*`

### `row` - Repeating row data (for dynamic row filling)

```json
{
  "source_type": "row",
  "source_field": "date",
  "pdf_field_name": "EntryDate_1"
}
```

Available fields: `row_number`, `date`, `duration_hours`, `entry_type`, `category`, `description`, `general_notes`, plus all structured answer fields

### `report_field` - Calculated fields

```json
{
  "source_type": "report_field",
  "source_field": "month_year",
  "pdf_field_name": "MonthYear"
}
```

Available fields: `month_year`, `report_date`, `total_hours`, `total_entries`

## Integration with PDF Generation

### In generateVRBatchReports

```javascript
// 1. Transform data
const transformer = new TimeEntryTransformer(timeEntries, answers, client);
const transformed = transformer.transform();

// 2. Fill PDF
fillPDFFields(form, mappings, transformed);

// Function receives structured data, not raw records
```

### In generatePDFReport

Same pattern — transformer is created first, output is fed to fillPDFFields.

## Data Integrity

**Original records are never modified:**

```javascript
const transformer = new TimeEntryTransformer(timeEntries, fieldAnswers, client);
const transformed = transformer.transform();

// timeEntries, fieldAnswers, client are unchanged
// transformed is a new structure for PDF use
```

## Performance Considerations

- **Lazy evaluation**: Grouping methods don't modify original data
- **Cached answers**: answersMap is built once, reused for all lookups
- **Immutable pattern**: Each filter/limit creates a new transformer
- **Memory**: Transformation data is ephemeral (only for PDF generation)

## Example: Complete PDF Workflow

```javascript
import { createTransformerForClient } from '@/lib/timeEntryTransformer';

// 1. Create transformer
const transformer = await createTransformerForClient(
  base44,
  clientId,
  '2026-04-01',
  '2026-04-30'
);

// 2. Transform
const { header, rows, summary } = transformer.transform();

// 3. Load PDF
const pdfDoc = await PDFDocument.load(templateBytes);
const form = pdfDoc.getForm();

// 4. Fill using transformation
mappings.forEach(mapping => {
  const value = resolveValue(mapping, {
    header,
    rows,
    summary,
    currentDate: new Date().toISOString().split('T')[0]
  });
  form.getFieldByName(mapping.pdf_field_name).setText(String(value || ''));
});

// 5. Save
const pdfBytes = await pdfDoc.save();
```

## Testing

Check that:
- [ ] transform() returns { header, rows, summary }
- [ ] Original entries/answers unchanged after transform
- [ ] Grouping methods return correct subsets
- [ ] Summary totals match manual calculation
- [ ] Header fields populated correctly
- [ ] Rows include all structured answers
- [ ] Filtering/limiting works correctly