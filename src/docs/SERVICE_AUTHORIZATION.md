# Service Authorization System

Tracks VR service authorizations for clients and enforces hour limits, date ranges, and reporting compliance.

## Entity Overview

### ServiceAuthorization

Represents a VR service authorization issued by a VR agency.

```json
{
  "id": "auth_001",
  "org_id": "org_123",
  "client_id": "client_456",
  "service_type_code": "job_coaching",
  "authorization_number": "AUTH-2024-001234",
  "vr_counselor_name": "Jane Smith",
  "job_goal": "Retail Manager",
  "employer_name": "Target",
  "total_authorized_hours": 40,
  "used_hours": 12.5,
  "remaining_hours": 27.5,
  "authorization_start_date": "2024-04-01",
  "authorization_end_date": "2024-06-30",
  "status": "active",
  "notes": "Client pursuing retail management position"
}
```

**Status Values:**
- `active` - Currently valid and has remaining hours
- `pending` - Not yet in effect (start date in future)
- `expired` - Past end date
- `exhausted` - All hours used
- `cancelled` - Manually cancelled

### TimeEntry Link

TimeEntry can reference a ServiceAuthorization:

```json
{
  "id": "entry_001",
  "client_id": "client_456",
  "service_authorization_id": "auth_001",
  "date": "2024-04-10",
  "duration_minutes": 120,
  "entry_type_code": "job_coaching",
  "description": "Interview prep session"
}
```

## Workflow

### 1. Create Authorization

Create a service authorization in the system:

```javascript
const auth = await base44.entities.ServiceAuthorization.create({
  client_id: 'client_456',
  service_type_code: 'job_coaching',
  authorization_number: 'AUTH-2024-001234',
  vr_counselor_name: 'Jane Smith',
  job_goal: 'Retail Manager',
  employer_name: 'Target',
  total_authorized_hours: 40,
  authorization_start_date: '2024-04-01',
  authorization_end_date: '2024-06-30',
  status: 'active'
});
```

### 2. Log Time Entry

Create a time entry linked to authorization:

```javascript
// Call backend function to validate and create
const response = await base44.functions.invoke('validateTimeEntryAuthorization', {
  action: 'create_with_auth',
  timeEntry: {
    client_id: 'client_456',
    date: '2024-04-10',
    duration_minutes: 120,
    entry_type_code: 'job_coaching',
    description: 'Interview prep session'
  },
  serviceAuthorizationId: 'auth_001'  // Optional - will auto-fetch if omitted
});

// Response includes validation + created entry
{
  success: true,
  entry: { id: 'entry_001', ... },
  validation: {
    isValid: true,
    message: 'Authorization valid',
    warnings: [],
    authorization: { ... },
    remainingHours: 27.5
  }
}
```

### 3. Auto-Update Hours

When time entry is created, authorization hours are automatically updated:

```javascript
{
  "used_hours": 12.5,        // Incremented by 2 hours
  "remaining_hours": 27.5,   // Decremented by 2 hours
  "status": "active"         // Updated if needed (e.g., exhausted)
}
```

### 4. Generate Report

Report generator pulls authorization data from linked entries:

```javascript
const response = await base44.functions.invoke('generateVersionedReport', {
  action: 'generate',
  params: {
    client_id: 'client_456',
    report_type: 'job_coaching',
    entry_type_id: 'type_001',
    time_entry_ids: ['entry_001', 'entry_002', 'entry_003']
  }
});

// PDF report header includes:
// - Authorization Number: AUTH-2024-001234
// - VR Counselor: Jane Smith
// - Job Goal: Retail Manager
// - Total Authorized Hours: 40
// - Hours Used: 6
// - Hours Remaining: 34
```

## Validation Rules

### Date Range Validation

Time entries must fall within authorization date range:

```javascript
if (timeEntry.date < authorization.authorization_start_date) {
  // Error: "Entry date is before authorization start"
}

if (timeEntry.date > authorization.authorization_end_date) {
  // Error: "Entry date is after authorization end"
}
```

### Hour Limit Validation

Time entry cannot exceed remaining hours:

```javascript
const entryHours = 2.0;
const remainingHours = 3.5;

if (entryHours > remainingHours) {
  // Error: "Entry hours (2.0) exceeds remaining (3.5)"
}
```

### Low Hours Warning

Warn if remaining hours would fall below 5:

```javascript
const newRemaining = remainingHours - entryHours;  // 1.5

if (newRemaining < 5 && newRemaining > 0) {
  // Warning: "Low on hours: only 1.5 hours will remain"
}
```

### Status Validation

- `expired` - No entries allowed after end date
- `exhausted` - No entries allowed (0 hours remaining)
- `cancelled` - No entries allowed

## API Functions

### Backend: validateTimeEntryAuthorization

Validates and creates time entries with authorization checks.

**Endpoint:** POST `/validateTimeEntryAuthorization`

**Actions:**

#### validate

Check if time entry is valid against authorization:

```javascript
const response = await base44.functions.invoke('validateTimeEntryAuthorization', {
  action: 'validate',
  timeEntry: {
    client_id: 'client_456',
    date: '2024-04-10',
    duration_minutes: 120,
    entry_type_code: 'job_coaching'
  },
  serviceAuthorizationId: 'auth_001'
});

// Returns:
{
  isValid: true,
  message: 'Authorization valid',
  errors: [],
  warnings: [],
  authorization: {
    id: 'auth_001',
    authorization_number: 'AUTH-2024-001234',
    vr_counselor_name: 'Jane Smith',
    job_goal: 'Retail Manager',
    total_authorized_hours: 40,
    used_hours: 12.5,
    remaining_hours: 27.5
  }
}
```

#### create_with_auth

Validate and create time entry:

```javascript
const response = await base44.functions.invoke('validateTimeEntryAuthorization', {
  action: 'create_with_auth',
  timeEntry: {
    client_id: 'client_456',
    date: '2024-04-10',
    duration_minutes: 120,
    entry_type_code: 'job_coaching',
    description: 'Interview prep'
  },
  serviceAuthorizationId: 'auth_001'
});

// Returns on success:
{
  success: true,
  entry: {
    id: 'entry_001',
    client_id: 'client_456',
    service_authorization_id: 'auth_001',
    date: '2024-04-10',
    duration_minutes: 120,
    entry_type_code: 'job_coaching'
  },
  validation: { ... }
}

// Returns on validation error:
{
  error: 'Entry hours (2.5) exceeds remaining (1.5)',
  isValid: false,
  errors: ['Entry hours (2.5) exceeds remaining (1.5)'],
  warnings: []
}
```

### Frontend Library: authorizationValidation.js

**getActiveAuthorization(base44, clientId, serviceTypeCode)**
- Get first active authorization for a client/service type
- Returns: `ServiceAuthorization | null`

**getClientAuthorizations(base44, clientId)**
- Get all authorizations for a client
- Returns: `ServiceAuthorization[]`

**getAuthorizationSummary(base44, clientId)**
- Get summary: counts by status, grouped by service type
- Returns: `{ total, active, pending, expired, exhausted, cancelled, byServiceType }`

**getAuthorizationTimeEntries(base44, authorizationId)**
- Get all time entries for an authorization
- Returns: `TimeEntry[]`

**isAuthorizationValid(authorization)**
- Check if authorization is still valid
- Returns: `boolean`

**updateAuthorizationHours(base44, authorizationId)**
- Recalculate used/remaining hours and update status
- Called automatically after time entry creation

## UI Components

### AuthorizationPanel

Displays all authorizations for a client with status, hours, and date range.

```jsx
import AuthorizationPanel from '@/components/authorization/AuthorizationPanel';

<AuthorizationPanel
  clientId="client_456"
  onAuthorizationSelect={(auth) => {
    console.log('Selected:', auth);
  }}
/>
```

**Features:**
- Shows all authorizations (active, expired, exhausted)
- Displays hours remaining with progress bar
- Color-coded status badges
- Low-hours warning (< 5 hours)
- Interactive selection for time entry linking

## Report Integration

### TimeEntry Transformer

Extracts authorization data for PDF generation:

```javascript
const transformer = new TimeEntryTransformer(
  timeEntries,
  fieldAnswers,
  client,
  { authorization }  // Pass auth data
);

const data = transformer.transform();

// data.header includes:
{
  authorization_number: 'AUTH-2024-001234',
  vr_counselor_name: 'Jane Smith',
  job_goal: 'Retail Manager',
  employer_name: 'Target',
  total_authorized_hours: 40,
  hours_used: 6,
  hours_remaining: 34
}
```

### PDF Field Mapping

Map PDF fields to authorization data:

```json
{
  "source_field": "authorization_number",
  "source_type": "header",
  "pdf_field_name": "AuthorizationNumber"
},
{
  "source_field": "vr_counselor_name",
  "source_type": "header",
  "pdf_field_name": "VRCounselorName"
},
{
  "source_field": "job_goal",
  "source_type": "header",
  "pdf_field_name": "EmploymentGoal"
},
{
  "source_field": "total_authorized_hours",
  "source_type": "header",
  "pdf_field_name": "TotalAuthorizedHours"
}
```

## Examples

### Scenario 1: Create Entry with Auto-Fetch

Automatically fetch active authorization:

```javascript
const response = await base44.functions.invoke('validateTimeEntryAuthorization', {
  action: 'create_with_auth',
  timeEntry: {
    client_id: 'client_456',
    date: '2024-04-10',
    duration_minutes: 120,
    entry_type_code: 'job_coaching'
    // No serviceAuthorizationId - will auto-fetch
  }
});
```

### Scenario 2: Warn Before Creating

Validate before showing confirmation:

```javascript
const validation = await base44.functions.invoke('validateTimeEntryAuthorization', {
  action: 'validate',
  timeEntry: {
    client_id: 'client_456',
    date: '2024-04-10',
    duration_minutes: 120,
    entry_type_code: 'job_coaching'
  },
  serviceAuthorizationId: 'auth_001'
});

if (!validation.isValid) {
  alert(`Cannot create entry: ${validation.message}`);
  return;
}

if (validation.warnings.length > 0) {
  const confirmed = confirm(validation.warnings.join('\n\n'));
  if (!confirmed) return;
}

// User confirmed - proceed with creation
```

### Scenario 3: Check Authorization Status

Get summary for client dashboard:

```javascript
const summary = await base44.functions.invoke('getAuthorizationSummary', {
  clientId: 'client_456'
});

// Display:
// - 3 total authorizations
// - 1 active
// - 2 expired
// - Grouped by service type with totals
```

## Best Practices

1. **Always validate before creating time entries**
   - Use `validateTimeEntryAuthorization` backend function
   - Check for errors and warnings
   - Display user-friendly messages

2. **Link time entries to authorizations**
   - Set `service_authorization_id` when creating
   - Enables audit trail and reporting
   - Allows tracking hours against specific authorizations

3. **Monitor low-hours warnings**
   - Alert users when remaining hours < 5
   - Prevent data entry mistakes
   - Plan for authorization renewals

4. **Update authorization status automatically**
   - Backend function updates status after entry creation
   - Marks as `exhausted` when hours reach 0
   - Marks as `expired` when end date passes

5. **Include authorization data in reports**
   - Pull from linked authorization
   - Display authorization number, counselor, goal
   - Show hours used vs. authorized
   - Enable compliance verification

6. **Enforce date ranges**
   - Block entries outside auth date range
   - Prevents backdating or forward-dating
   - Ensures reporting period compliance

## Troubleshooting

### "No active authorization found"

**Cause:** TimeEntry references non-existent or inactive authorization

**Solution:**
1. Verify authorization exists: `await getClientAuthorizations(base44, clientId)`
2. Check status is `active`: `auth.status === 'active'`
3. Create authorization if missing

### "Entry date is outside authorization range"

**Cause:** TimeEntry date doesn't fall within authorization start/end dates

**Solution:**
1. Verify entry date is within range
2. Adjust authorization dates if needed
3. Create new authorization for that period

### "Remaining hours would go below zero"

**Cause:** Entry duration exceeds available hours

**Solution:**
1. Reduce entry duration
2. Verify authorization hours were entered correctly
3. Create new authorization with additional hours

### Hours not updating

**Cause:** Time entries created without calling validation function

**Solution:**
- Always use `validateTimeEntryAuthorization` or manual `updateAuthorizationHours()`
- Ensures `used_hours` and `remaining_hours` stay in sync

## See Also

- `entities/ServiceAuthorization.json` - Entity schema
- `entities/TimeEntry.json` - TimeEntry with auth reference
- `functions/validateTimeEntryAuthorization.js` - Validation function
- `lib/authorizationValidation.js` - Client-side utilities
- `components/authorization/AuthorizationPanel.jsx` - UI component
- `lib/timeEntryTransformer.js` - Report data extraction