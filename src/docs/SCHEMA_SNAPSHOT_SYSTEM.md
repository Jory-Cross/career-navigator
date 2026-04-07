# Schema Snapshot System

Field definitions captured at submission time ensure old entries remain stable and readable even when ReportFieldTemplate definitions change.

## Problem Solved

**Scenario:** You define a field "goal_addressed" with options ["Employment", "Education", "Life Skills"]. User John answers it with "Employment". Later, admin changes the options to ["Career", "Education", "Independence"]. 

**Without snapshots:** John's old "Employment" answer becomes invalid. Reports can't understand what he meant.

**With snapshots:** John's record stores the exact field definition he saw at submission time. Reports always know what options were available to him.

## Architecture

```
┌─────────────────────────────────────────────┐
│ ReportFieldTemplate (Current, Mutable)      │
│ ─────────────────────────────────────────── │
│ • goal_addressed                            │
│ • options: ["Career", "Education", ...]    │ ← Changed!
│ • label: "Primary Goal"                     │
└─────────────────────────────────────────────┘
                    ↓
         User submits field answers
                    ↓
┌─────────────────────────────────────────────┐
│ ReportFieldAnswer (Immutable, Timestamped)  │
│ ─────────────────────────────────────────── │
│ answers: { goal_addressed: "Employment" }   │
│ field_schema_snapshot: {                    │
│   goal_addressed: {                         │
│     label: "Primary Goal"                   │
│     options: ["Employment", "Education",    │
│               "Life Skills"]  ← Original!   │
│     is_required: true                       │
│     field_type: "select"                    │
│     ...                                     │
│   }                                         │
│ }                                           │
│ submitted_at: "2024-04-15T10:30:00Z"        │
└─────────────────────────────────────────────┘
```

## ReportFieldAnswer Fields

### Core Answer Data

**answers** (object)
- User's responses: `{ field_key: value, ... }`
- Example: `{ "employer_name": "Target", "goal_addressed": "Employment", "units": 2 }`

### Schema Snapshot

**field_schema_version** (string)
- Version of template used (e.g., "2024-Q1", "v3")
- Matches PDFTemplate.version

**field_schema_snapshot** (object)
- Complete field definitions at submission time
- Structure: `{ field_key: { label, field_type, is_required, options, ... }, ... }`
- Immutable after creation

### Completion Status

**required_fields_complete** (boolean)
- All required fields (per snapshot) answered? true/false

**report_ready** (boolean)
- Can this entry be used in a report?
- true if required_fields_complete AND no validation errors

### Audit Trail

**submitted_at** (ISO datetime)
- When answers were submitted

**submitted_by** (email)
- User who submitted

**revision_number** (number)
- Increments on re-submission (1, 2, 3...)

**previous_revision_id** (string)
- Link to prior ReportFieldAnswer if this is a revision

**notes** (string)
- Why resubmitted, internal notes

### Validation

**validation_errors** (array)
- Any type/format errors found at submission time
- For debugging/audit trail

## Usage Flow

### Submitting Field Answers

```javascript
const response = await base44.functions.invoke('submitFieldAnswers', {
  time_entry_id: 'entry_001',
  entry_type_id: 'type_001',
  entry_type_code: 'job_coaching',
  answers: {
    employer_name: 'Target',
    goal_addressed: 'Employment',
    units: 2
  },
  template_version: '2024-Q1'
});

// Returns:
{
  success: true,
  field_answer_id: 'fa_001',
  required_fields_complete: true,
  report_ready: true,
  revision_number: 1,
  validation: {
    fields_answered: 3,
    required_fields: 5,
    missing_count: 2,
    errors: [],
    warnings: []
  },
  summary: {
    completion_percentage: 60,
    missing_required_fields: ['units_description', 'outcome'],
    can_generate_report: false  // Some required fields missing
  }
}
```

### Checking Completion Status

```javascript
const fieldAnswer = await base44.entities.ReportFieldAnswer.filter({
  time_entry_id: 'entry_001'
})[0];

// Is this entry report-ready?
if (fieldAnswer.report_ready) {
  // Safe to include in PDF
} else {
  // Missing required fields
  console.log(`Missing: ${fieldAnswer.validation_errors}`);
}
```

### Accessing Field Snapshot

```javascript
// View what fields existed at time of submission
const snapshot = fieldAnswer.field_schema_snapshot;

// Iterate over fields as user saw them
Object.entries(snapshot).forEach(([fieldKey, fieldDef]) => {
  console.log(`${fieldKey}: ${fieldDef.label}`);
  console.log(`  Type: ${fieldDef.field_type}`);
  console.log(`  Required: ${fieldDef.is_required}`);
  if (fieldDef.field_type === 'select') {
    console.log(`  Options: ${fieldDef.options.join(', ')}`);
  }
});

// Get user's answer
const userAnswer = fieldAnswer.answers[fieldKey];
```

### Detecting Schema Changes

```javascript
import { compareSchemaWithSnapshot } from '@/lib/fieldAnswerSubmission.js';

const changes = await compareSchemaWithSnapshot(
  base44,
  entryTypeId,
  fieldAnswer
);

console.log('New fields added:', changes.added);
console.log('Fields removed:', changes.removed);
console.log('Fields modified:', changes.modified);

if (changes.has_breaking_changes) {
  // Alert: form definition changed significantly
}
```

## Report Generation with Snapshots

When generating PDFs or reports, use the saved snapshot to reconstruct field data:

```javascript
// Get field answer (includes snapshot)
const fieldAnswer = await base44.entities.ReportFieldAnswer.filter({
  time_entry_id: entryId
})[0];

if (!fieldAnswer.report_ready) {
  throw new Error('Entry not ready for reporting');
}

// Reconstruct field data using snapshot
const reportFields = reconstructFieldData(fieldAnswer);

// Example: reportFields = [
//   {
//     field_key: 'employer_name',
//     label: 'Employer Name',
//     value: 'Target',
//     section: 'Service Details',
//     is_answered: true
//   },
//   {
//     field_key: 'goal_addressed',
//     label: 'Primary Goal',
//     value: 'Employment',
//     options: ['Employment', 'Education', 'Life Skills'],
//     is_answered: true
//   },
//   ...
// ]

// Use in report assembly
reportObject.field_answers = reportFields;
```

## Schema Snapshot Structure

```json
{
  "employer_name": {
    "field_key": "employer_name",
    "label": "Employer Name",
    "field_type": "text",
    "is_required": true,
    "section": "Service Details",
    "placeholder": "e.g., Target, Walmart",
    "help_text": "Name of employer or workplace",
    "order": 1,
    "options": [],
    "is_active": true
  },
  "goal_addressed": {
    "field_key": "goal_addressed",
    "label": "Primary Goal",
    "field_type": "select",
    "is_required": true,
    "section": "Service Details",
    "placeholder": null,
    "help_text": "Which employment goal does this service address?",
    "order": 2,
    "options": ["Employment", "Education", "Life Skills"],
    "is_active": true
  },
  "units": {
    "field_key": "units",
    "label": "Service Units",
    "field_type": "number",
    "is_required": false,
    "section": "Metrics",
    "placeholder": "1-999",
    "help_text": null,
    "order": 3,
    "options": [],
    "is_active": true
  }
}
```

## Handling Revisions

Users can resubmit/update field answers. Each revision increments the version.

```javascript
// First submission
{
  field_answer_id: 'fa_001',
  revision_number: 1,
  submitted_at: '2024-04-10T09:00:00Z',
  answers: { employer_name: 'Target', goal_addressed: 'Employment' }
}

// User updates answers (missing required field was filled)
{
  field_answer_id: 'fa_001',  // Same ID
  revision_number: 2,          // Incremented
  submitted_at: '2024-04-12T14:30:00Z',
  previous_revision_id: 'fa_001',  // Link to revision 1
  notes: 'Resubmitted revision 2',
  answers: { employer_name: 'Target', goal_addressed: 'Employment', units: 2 }
}
```

## Validation at Submission

When answers are submitted, validation checks:

1. **Type validation** - number, date, email, phone formats
2. **Select options** - answer matches available options from snapshot
3. **Required fields** - all required fields have values
4. **Extra fields** - warns if answer provided for unknown field

Results stored in validation_errors for audit trail.

## Best Practices

1. **Always submit field answers** - Never skip this step
   ```javascript
   // ✓ Good
   await base44.functions.invoke('submitFieldAnswers', { ... });
   
   // ✗ Bad - no snapshot captured
   await base44.entities.TimeEntry.create({ ... });
   ```

2. **Check report_ready before reporting**
   ```javascript
   if (fieldAnswer.report_ready) {
     // Safe to include in report
   } else {
     // Get missing fields
     const missing = getMissingRequiredFields(fieldAnswer);
   }
   ```

3. **Use snapshot for understanding old data**
   ```javascript
   // Don't assume current template matches old entry
   const snapshot = fieldAnswer.field_schema_snapshot;
   // Now you know exactly what fields/options existed
   ```

4. **Handle schema changes gracefully**
   ```javascript
   const changes = await compareSchemaWithSnapshot(base44, typeId, fieldAnswer);
   if (changes.has_breaking_changes) {
     // Alert user, allow reconciliation
   }
   ```

5. **Preserve revision history**
   - Don't delete old ReportFieldAnswer records
   - Track previous_revision_id for audit trail
   - Use revision_number in reports if needed

## Compatibility

**Legacy support:** Old ReportFieldAnswer records (before schema snapshot)
- `is_complete` field still works (maps to required_fields_complete)
- `field_schema_snapshot` will be null
- Can migrate on read if needed

**Migration:**
```javascript
// For old records without snapshot, regenerate it
if (!fieldAnswer.field_schema_snapshot) {
  const templates = await base44.entities.ReportFieldTemplate.filter({
    entry_type_id: fieldAnswer.entry_type_id
  });
  const snapshot = buildFieldSnapshot(templates);
  await base44.entities.ReportFieldAnswer.update(fieldAnswer.id, {
    field_schema_snapshot: snapshot
  });
}
```

## See Also

- `entities/ReportFieldAnswer.json` - Entity schema
- `lib/fieldAnswerSubmission.js` - Utilities for snapshot handling
- `functions/submitFieldAnswers.js` - Backend function
- `docs/VR_REPORTING_ARCHITECTURE.md` - Full reporting system
- `docs/STRUCTURED_REPORTING_GUIDE.md` - Field template system