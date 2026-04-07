# VR Field Validation System

Enforces required fields by entry type, validates submissions, and ensures VR PDF reporting compliance.

## Overview

The validation system ensures:
- ✅ Required fields are captured before saving time entries
- ✅ All answers belong to their entry type
- ✅ Field definitions exist before report generation
- ✅ VR forms (USOR95, USOR96, USOR148) are fully compliant

## Architecture

```
vrFieldConfig.js (field definitions)
        ↓
timeEntryValidation.js (validation logic)
        ↓
StructuredVRTimeEntryForm.jsx (form validation on save)
        ↓
generateVRBatchReports.js (validation before report generation)
```

## Field Definitions (vrFieldConfig.js)

### Structure

Each entry type defines:
- **entry_type_id/code**: Machine identifier
- **form_name**: VR form name (e.g., "Job Coaching Report (USOR95)")
- **required_fields**: Array of mandatory field keys
- **all_fields**: Complete field definitions with metadata

```javascript
job_coaching: {
  entry_type_id: 'job_coaching',
  entry_type_code: 'job_coaching',
  form_name: 'Job Coaching Report (USOR95)',
  required_fields: ['employer_name', 'coaching_focus', 'goals_addressed', ...],
  all_fields: [
    {
      field_key: 'employer_name',      // Unique identifier
      label: 'Employer Name',           // UI display
      input_type: 'text',               // Form control type
      required: true,                   // Must be filled
      pdf_field_name: 'EmployerName',   // PDF mapping reference
      order: 1,
      section: 'Coaching Session'       // Form grouping
    },
    // ... more fields
  ]
}
```

### Supported Entry Types

| Code | Form Name | VR Form |
|------|-----------|---------|
| `job_development` | Job Development Report | USOR96 |
| `job_coaching` | Job Coaching Report | USOR95 |
| `life_skills` | Life Skills / CBH Report | USOR148 |
| `cbh` | Community-Based Habilitation | USOR148 |

### Field Metadata

- **field_key**: Unique identifier (e.g., `employer_name`)
- **label**: Human-readable text for UI
- **input_type**: `text`, `textarea`, `number`, `date`, `select`, `multiselect`, `checkbox`, `boolean`, `time`
- **required**: Must be filled before saving
- **options**: For select/multiselect fields
- **pdf_field_name**: Maps to PDF form field
- **order**: Display sequence
- **section**: Logical grouping
- **placeholder**: Helper text
- **help_text**: Detailed instructions

## Validation Functions (timeEntryValidation.js)

### Validate Time Entry Basics

```javascript
import { validateTimeEntry } from '@/lib/timeEntryValidation';

const validation = validateTimeEntry({
  client_id: 'abc123',
  date: '2026-04-01',
  duration_minutes: 60,
  entry_type_id: 'job_coaching'
});

// Returns:
// {
//   isValid: true,
//   errors: []
// }
```

**Checks:**
- Client ID exists
- Date is valid (not in future)
- Duration > 0 and ≤ 1440 minutes
- Entry type is selected

### Validate Report Field Answers

```javascript
import { validateReportFieldAnswers } from '@/lib/timeEntryValidation';

const validation = validateReportFieldAnswers('job_coaching', {
  employer_name: 'Acme Corp',
  coaching_focus: 'Job Performance',
  goals_addressed: 'Improve punctuality',
  client_response: 'Positive',
  next_step: 'Follow up next week'
});

// Returns:
// {
//   isValid: true,
//   errors: [],
//   completionRate: 1.0  // 100% of required fields filled
// }
```

**Checks:**
- All answers belong to entry type
- All required fields present and non-empty

### Validate Complete Submission

```javascript
import { validateTimeEntrySubmission } from '@/lib/timeEntryValidation';

const validation = validateTimeEntrySubmission(
  {
    client_id: 'abc123',
    date: '2026-04-01',
    duration_minutes: 60,
    entry_type_id: 'job_coaching'
  },
  {
    employer_name: 'Acme Corp',
    coaching_focus: 'Job Performance',
    goals_addressed: 'Improve punctuality',
    client_response: 'Positive',
    next_step: 'Follow up next week'
  }
);

// Returns:
// {
//   isValid: true,
//   errors: [],
//   warnings: []
// }
```

### Validate Batch for Report Generation

```javascript
import { validateEntriesForBatchReporting } from '@/lib/timeEntryValidation';

const validation = validateEntriesForBatchReporting(
  timeEntries,           // Array of TimeEntry records
  fieldAnswersMap        // { entry_id: { field_key: value, ... } }
);

// Returns:
// {
//   isValid: true,
//   canGenerate: true,   // Safe to generate reports
//   errors: [],
//   warnings: ['Entry 5 (job_coaching): 2 required fields missing'],
//   summary: {
//     job_coaching: { valid: 8, invalid: 0, incomplete: 2 }
//   },
//   totalEntries: 10,
//   validEntries: 8
// }
```

### Validate Fields Exist (Before Reporting)

```javascript
import { validateFieldsExistForReporting } from '@/lib/timeEntryValidation';

const validation = validateFieldsExistForReporting('job_coaching');

// Returns:
// {
//   isValid: true,
//   error: null,
//   missingFieldDefinitions: [],
//   totalFields: 7,
//   requiredFields: 5
// }
```

## Usage in Components

### In Time Entry Form

```javascript
import { validateTimeEntrySubmission } from '@/lib/timeEntryValidation';

export default function StructuredVRTimeEntryForm({ clientId, onSuccess }) {
  const handleSubmit = async () => {
    // Validate before saving
    const validation = validateTimeEntrySubmission(
      {
        client_id: clientId,
        date: formData.entry_date,
        duration_minutes: formData.hours * 60,
        entry_type_id: selectedType
      },
      fieldAnswers
    );

    if (!validation.isValid) {
      validation.errors.forEach(err => toast.error(err));
      return;
    }

    // Safe to save
    await base44.entities.TimeEntry.create(entryData);
    await base44.entities.ReportFieldAnswer.create(answerData);
  };
}
```

### In Report Generation

```javascript
import { validateEntriesForBatchReporting } from '@/lib/timeEntryValidation';

export async function generateBatchReports(clientIds, dateFrom, dateTo) {
  // Fetch entries and answers
  const entries = await base44.entities.TimeEntry.filter({ ... });
  const answers = await base44.entities.ReportFieldAnswer.filter({ ... });

  // Validate before generating
  const validation = validateEntriesForBatchReporting(entries, answersMap);

  if (!validation.canGenerate) {
    console.error('Cannot generate reports:', validation.errors);
    return validation;
  }

  // Safe to generate
  const pdfs = await generateReports(entries, answers);
  return { success: true, pdfs };
}
```

### Display Validation Results

```javascript
import ValidationResultsPanel from '@/components/reports/ValidationResultsPanel';

export function ReportPreview() {
  const [validation, setValidation] = useState(null);

  return (
    <>
      <button onClick={() => {
        const result = validateEntriesForBatchReporting(entries, answers);
        setValidation(result);
      }}>
        Validate
      </button>

      {validation && (
        <ValidationResultsPanel validation={validation} showDetails={true} />
      )}
    </>
  );
}
```

## Field Validation Rules

### Required Field Enforcement

**Job Development (USOR96):**
- Employer name
- Contact person
- Phone
- Job title
- Job description
- Wage offered
- Start date
- Hours per week
- Employment type

**Job Coaching (USOR95):**
- Employer name
- Coaching focus
- Goals addressed
- Client response
- Next step

**Life Skills / CBH (USOR148):**
- Skill area
- Activity description
- Skill objectives
- Client progress
- Next session plan

### Field Constraints

| Constraint | Rule | Example |
|-----------|------|---------|
| Belong to entry type | Field key must exist in entry type | `employer_name` in `job_coaching` ✓ |
| No cross-entry mixing | Can't mix fields from different types | `employer_name` + `skill_area` ✗ |
| Required if flagged | Must be non-empty | `required: true` enforced on save |
| Date not future | Entry date ≤ today | Date `2026-05-01` invalid on `2026-04-07` |
| Duration valid | > 0 and ≤ 1440 minutes | `duration_minutes: 90` ✓ |

## Error Handling

### Validation Error Messages

```javascript
import { getValidationErrorMessage } from '@/lib/timeEntryValidation';

const msg = getValidationErrorMessage('client_id', 'job_coaching');
// "Please select a client"

const msg2 = getValidationErrorMessage('duration_minutes', 'job_coaching');
// "Please enter a duration (in minutes)"
```

### Exception Flow

```javascript
try {
  const validation = validateTimeEntrySubmission(entryData, answers);
  
  if (!validation.isValid) {
    // Display user-friendly errors
    validation.errors.forEach(err => {
      console.log(`User error: ${err}`);
    });
    return;
  }
  
  // Proceed with save
} catch (error) {
  console.error('Unexpected validation error:', error);
}
```

## Testing Validation

### Unit Tests

```javascript
import { validateTimeEntry, validateReportFieldAnswers } from '@/lib/timeEntryValidation';

// Test required time entry fields
const result = validateTimeEntry({});
assert.isFalse(result.isValid);
assert.includes(result.errors, 'Client is required');

// Test required report fields
const result2 = validateReportFieldAnswers('job_coaching', {});
assert.isFalse(result2.isValid);
assert.lengthOf(result2.errors, 5); // 5 required fields missing

// Test cross-entry contamination
const result3 = validateReportFieldAnswers('job_coaching', {
  skill_area: 'Daily Living' // belongs to life_skills, not job_coaching
});
assert.includes(result3.errors[0], 'does not belong to entry type');
```

### Validation Checklist

- [ ] Required fields enforced on form submit
- [ ] Cross-entry field mixing prevented
- [ ] Date validation rejects future dates
- [ ] Duration validation enforces > 0 and ≤ 1440
- [ ] Batch validation identifies incomplete entries
- [ ] Report generation only proceeds when canGenerate = true
- [ ] Missing field definitions detected before reporting
- [ ] Error messages are user-friendly and actionable
- [ ] Warnings show incomplete entries but allow report generation

## Performance Considerations

- **O(n) validation**: Linear time to validate n entries
- **Early exits**: Stops on first critical error
- **Lazy evaluation**: Field checks only run for selected entry type
- **Cached configs**: Field definitions loaded once, reused

## Migration Notes

- Existing TimeEntry records without entry_type_id: Mark as legacy, don't report
- Fields without pdf_field_name: Optional PDF mapping, skip in fillPDFFields
- Backfill ReportFieldAnswer for legacy entries: Script to generate default answers

## Future Enhancements

- [ ] Conditional field requirements (if X, then Y required)
- [ ] Custom validation rules per organization
- [ ] Field value constraints (min/max, regex patterns)
- [ ] Cross-field validation (date A < date B)
- [ ] Async validation (check against external APIs)