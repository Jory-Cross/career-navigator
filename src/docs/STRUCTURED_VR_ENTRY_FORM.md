# Structured VR Time Entry Form

## Overview

`StructuredVRTimeEntryForm` is the **primary entry experience** for time entries in the VR system. It replaces the older form with a **database-driven, 4-step workflow** that ensures fast, accurate data capture for Utah VR reporting.

### Key Features

- **4-step wizard** with clear progression
- **Database-driven** entry types and field templates
- **Flexible core fields** (duration via hours OR start/end times)
- **Dynamic reportable fields** based on entry type
- **Separation of concerns** (reportable vs. internal fields)
- **Draft save** (no validation) and **final submit** (full validation)
- **Report readiness** tracking and visual status
- **Service authorization** support (when required)

## 4-Step Workflow

### Step 1: Select Entry Type

User chooses the service type being provided. Each entry type card displays:
- Service name & description
- Billable badge (if billable)
- Payroll badge (if payroll-eligible)

**Data loaded:**
- All active `EntryType` records from database

### Step 2: Core Time Entry Details

User enters required fields that appear on **every** time entry:

- **Client** (read-only, pre-filled)
- **Employee** (required) — Staff member providing service
- **Service Authorization** (conditional) — Required if entry type has `requires_authorization: true`
- **Date** (required) — Date of service
- **Location** (optional) — Where service was provided
- **Duration** (choice of):
  - Start Time + End Time (auto-calculates duration)
  - OR Hours (e.g., 1.5)
- **Employer** (conditional) — Required if entry type has `requires_employer: true`

**Data loaded:**
- Employees (User records with role='employee')
- Service Authorizations (if entry type requires authorization)

### Step 3: Dynamic Service Details

User completes **entry-type-specific fields** from `ReportFieldTemplate` records.

Features:
- Fields grouped by **section** (e.g., "Job Coaching Details", "Employer Info")
- **Required markers** on mandatory fields
- **Help text** displayed below each field
- **Completion progress** bar shows required fields filled
- **Internal notes** section (not exported to reports)

**Data loaded:**
- ReportFieldTemplate records for selected entry type
- Filtered to active fields only (`is_active: true`)
- Sorted by `order`

### Step 4: Review & Submit

User verifies entry before final save.

**Shows:**
- **Entry summary** (type, date, duration, location)
- **Status badges** (Billable, Payroll, Reportable)
- **Submitted fields** list
- **Report ready status** (green = ready, amber = missing required fields)

**Actions:**
- **Save Draft** — Saves without validation. Allows incomplete entries.
- **Submit Entry** — Full validation. Disabled if required fields are missing.

## Component Structure

```
StructuredVRTimeEntryForm (main)
├── StepIndicator (visual progress)
├── Step 1: Type Selection
├── Step 2: Core Fields
│   ├── Client display
│   ├── Employee select
│   ├── Authorization select (conditional)
│   ├── Date + Duration picker
│   └── Location + Employer (conditional)
├── Step 3: Dynamic Fields
│   ├── Field renderer loop
│   └── Completion bar
├── Step 4: Review
│   ├── Summary badges
│   ├── Field summary
│   └── Report readiness indicator
└── Helper Components
    ├── FieldInput (field renderer)
    ├── CompletionBar (progress)
    └── LoadingCard (async state)
```

## Data Model

### Core Time Entry Fields (Always Present)

These are explicit fields on **every** form step, not guessed from templates:

```javascript
{
  date: string,              // YYYY-MM-DD
  start_time: string,        // HH:MM (optional if using duration_hours)
  end_time: string,          // HH:MM (optional if using duration_hours)
  duration_hours: number,    // decimal hours (optional if using start/end times)
  employee_id: string,       // FK to User (role=employee)
  location: string,          // Where service was provided
  service_authorization_id: string,  // FK to ServiceAuthorization (conditional)
  employer_name: string,     // Employer name (conditional)
  general_notes: string      // Internal notes only (not reported)
}
```

### Dynamic Reportable Fields

Loaded from `ReportFieldTemplate` for the selected entry type:

```javascript
{
  field_key: string,         // Unique within entry type
  label: string,             // Display label
  field_type: 'text' | 'textarea' | 'number' | 'date' | 'time' | 'select' | 'boolean' | ...,
  section: string,           // UI grouping
  is_required: boolean,      // Validation check
  is_reportable: boolean,    // Whether it appears on PDF
  is_internal_only: boolean, // Internal use only
  help_text: string,         // Guidance text
  options: string[],         // For select/multiselect
  placeholder: string        // Input hint
}
```

### TimeEntry Record (Saved to Database)

```javascript
{
  // ── Core fields (always present) ──
  client_id: string,
  employee_id: string,
  date: string,
  start_time: string | null,
  end_time: string | null,
  duration_minutes: number,
  location: string | null,
  service_authorization_id: string | null,
  employer_name: string | null,
  description: string,  // general_notes

  // ── Entry type info ──
  entry_type_id: string,     // FK to EntryType
  entry_type_code: string,   // Stable code for querying

  // ── Report metadata ──
  reporting_period_key: string,  // YYYY-MM for monthly reports
  is_reportable: boolean,    // Copy of entry_type.report_mode !== 'none'
  is_billable: boolean,      // Copy of entry_type.is_billable
  is_payroll_eligible: boolean,  // Copy of entry_type.is_payroll_eligible
  report_ready: boolean,     // True when all required fields are complete

  // ── Workflow ──
  status: 'draft' | 'submitted' | 'approved' | 'locked' | 'void'
}
```

### ReportFieldAnswer Record (Saved to Database)

```javascript
{
  time_entry_id: string,        // FK to TimeEntry (1:1)
  entry_type_id: string,
  entry_type_code: string,

  // ── Schema snapshot (point-in-time) ──
  field_schema_version: number, // Version of template at time of submission
  field_schema_snapshot: object,// Full field definitions used
  
  // ── User answers ──
  answers: {
    [field_key]: value,         // Map of field_key -> answer value
    ...
  },

  // ── Status ──
  required_fields_complete: boolean,
  report_ready: boolean,
  submitted_at: string,         // ISO datetime
  validation_errors: string[]   // Failed field keys
}
```

## Usage

### Basic Implementation

```javascript
import StructuredVRTimeEntryForm from '@/components/time-entry/StructuredVRTimeEntryForm';

export default function TimeTrackingPage() {
  const [clientId, setClientId] = useState('...');
  const [clients, setClients] = useState([]);

  useEffect(() => {
    base44.entities.Client.list().then(setClients);
  }, []);

  return (
    <StructuredVRTimeEntryForm
      clientId={clientId}
      clients={clients}
      onSuccess={(timeEntry, isDraft) => {
        if (isDraft) {
          console.log('Draft saved:', timeEntry.id);
        } else {
          console.log('Entry submitted:', timeEntry.id);
        }
      }}
    />
  );
}
```

### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `clientId` | string | Yes | Current client ID |
| `clients` | Client[] | No | List of clients for selection/display |
| `onSuccess` | fn(timeEntry, isDraft) | No | Callback after save |

### Callbacks

```javascript
// Called after TimeEntry + ReportFieldAnswer created
onSuccess(
  {
    id: "te_123",
    date: "2024-01-15",
    duration_minutes: 90,
    entry_type_code: "job_coaching",
    status: "submitted",
    report_ready: true,
    ...
  },
  false  // isDraft
)
```

## Validation

### Draft Save
- No validation required
- Allows incomplete entries
- Creates TimeEntry with `status: 'draft'`
- Status shown in UI as "Draft"

### Final Submit
- Validates **core fields**:
  - Date, Employee, Duration (hours OR start/end times)
  - Service Authorization (if required by entry type)
  - Employer (if required by entry type)
- Validates **required reportable fields**:
  - All `ReportFieldTemplate` records with `is_required: true` must have values
- If any validation fails, displays error and doesn't save
- Creates TimeEntry with `status: 'submitted'`
- Creates ReportFieldAnswer with schema snapshot

## UX Features

### Visual Hierarchy

- **Entry Type Card**: Color-coded by `entry_type.color`, shows badges
- **Step Headers**: "Step X of 4" with clear descriptions
- **Section Headers**: Uppercase, spaced labels group related fields
- **Required Markers**: Red asterisk (*) on required fields
- **Help Text**: Small gray text below field labels
- **Error State**: Red border on inputs, red error message below

### Progress & Status

- **Completion Bar**: Shows required fields progress (Step 3)
- **Report Ready Badge**: Green (ready) or Amber (missing fields) (Step 4)
- **Status Badges**: Billable, Payroll, Reportable (all steps)

### Performance

- Entry types & employees loaded once on mount
- Authorizations loaded on-demand when entry type changes
- Field templates cached until step changes
- No unnecessary re-renders (memoized selects, conditional rendering)

## Integration with VR Reporting

### Report Generation

Once TimeEntry + ReportFieldAnswer are saved, they're available for reporting:

```javascript
const entries = await base44.entities.TimeEntry.filter({
  client_id: "...",
  entry_type_code: "job_coaching",
  status: "submitted",
  report_ready: true,
  reporting_period_key: "2024-01"
});

const answers = await base44.entities.ReportFieldAnswer.filter({
  entry_type_code: "job_coaching"
});

// Use in PDF generation, batch reports, etc.
```

### Authorization Tracking

Service Authorization IDs stored on TimeEntry enable hour tracking:

```javascript
const auth = await base44.entities.ServiceAuthorization.get(authId);
const entries = await base44.entities.TimeEntry.filter({
  service_authorization_id: authId
});
const totalHours = entries.reduce((sum, e) => sum + (e.duration_minutes / 60), 0);
```

## Future Enhancements

- [ ] Conditional field visibility (show/hide based on other field values)
- [ ] Field dependencies (field A required only if field B = "X")
- [ ] Bulk time entry upload
- [ ] Time entry templates (save & reuse common entries)
- [ ] Meeting-to-time-entry conversion
- [ ] Offline support

## Troubleshooting

### Issue: Employee dropdown is empty

**Cause**: No User records with `role: 'employee'` in database

**Solution**: 
1. Create User records or invite staff
2. Ensure their role is set to "employee" in User entity
3. Refresh page

### Issue: Service Authorization dropdown not showing

**Cause**: Entry type has `requires_authorization: true` but no ServiceAuthorization records exist

**Solution**:
1. Create ServiceAuthorization record(s) for the client
2. Ensure `entry_type_code` matches the selected entry type
3. Ensure authorization `status: 'active'`

### Issue: Form shows "Report Ready" but fields are missing

**Cause**: Completion calculation is checking wrong fields

**Solution**: 
1. Verify `ReportFieldTemplate.is_required` is set correctly
2. Verify field answers were saved (check ReportFieldAnswer record)
3. Check browser console for validation errors