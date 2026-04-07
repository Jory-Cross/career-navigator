# ServiceAuthorization System

Tracks VR service authorizations for clients, enforces hour limits, and prevents logging time beyond authorized hours.

## Overview

**Problem:** VR agencies authorize specific hours for each service type. Staff can accidentally log more hours than authorized, creating compliance issues.

**Solution:** ServiceAuthorization entity tracks authorized hours, calculates remaining hours, and validates time entries before saving.

## Entity Structure

### ServiceAuthorization

```json
{
  "id": "auth_123",
  "client_id": "client_456",
  "service_type": "job_coaching",
  "authorization_number": "AUTH-2024-001234",
  "total_authorized_hours": 20,
  "hours_used": 8.5,
  "hours_remaining": 11.5,
  "start_date": "2024-04-01",
  "end_date": "2024-06-30",
  "status": "active",
  "created_by": "staff@org.com",
  "approved_by": "supervisor@org.com",
  "notes": "Initial authorization for Q2 2024"
}
```

### TimeEntry (Updated)

```json
{
  "id": "entry_789",
  "client_id": "client_456",
  "service_authorization_id": "auth_123",
  "date": "2024-04-10",
  "duration_minutes": 60,
  "category": "job_coaching",
  "entry_type_id": "type_001"
}
```

## Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `client_id` | string | ✓ | Client this authorization applies to |
| `service_type` | enum | ✓ | job_development, job_coaching, life_skills, cbh, pre_ets, other |
| `authorization_number` | string | ✓ | Unique ID from VR agency (e.g. AUTH-2024-001234) |
| `total_authorized_hours` | number | ✓ | Hours approved by agency |
| `hours_used` | number | auto | Hours logged against this auth (calculated) |
| `hours_remaining` | number | auto | total - used (calculated) |
| `start_date` | date | ✓ | When authorization becomes effective |
| `end_date` | date | ✓ | When authorization expires |
| `status` | enum | | active, pending, expired, cancelled, exhausted |
| `created_by` | string | | Email of staff who created |
| `approved_by` | string | | Email of supervisor who approved |
| `notes` | string | | Internal notes |

## Status Values

| Status | Meaning | Can Log Time |
|--------|---------|--------------|
| `pending` | Awaiting approval | No |
| `active` | In effect and available | Yes |
| `expired` | End date passed | No |
| `cancelled` | Manually cancelled | No |
| `exhausted` | All hours used | No |

## Workflow

### 1. Create Authorization

```javascript
const auth = await base44.entities.ServiceAuthorization.create({
  client_id: 'client_123',
  service_type: 'job_coaching',
  authorization_number: 'AUTH-2024-005678',
  total_authorized_hours: 20,
  start_date: '2024-04-01',
  end_date: '2024-06-30',
  created_by: user.email
});
```

### 2. Validate Time Entry

Before creating a time entry, validate against authorization:

```javascript
const validation = await base44.functions.invoke('validateTimeEntryAuthorization', {
  action: 'validate',
  timeEntry: {
    client_id: 'client_123',
    category: 'job_coaching',
    date: '2024-04-10',
    duration_minutes: 120
  }
});

if (!validation.data.valid) {
  // Show error: insufficient hours, expired, etc.
  console.error(validation.data.message);
}
```

**Response:**

```json
{
  "success": true,
  "valid": true,
  "message": "Time entry valid. Authorization: AUTH-2024-005678",
  "warning": null,
  "hoursRemaining": 18,
  "authorizationId": "auth_123"
}
```

### 3. Create Time Entry with Authorization

```javascript
const result = await base44.functions.invoke('validateTimeEntryAuthorization', {
  action: 'create_with_auth',
  timeEntry: {
    client_id: 'client_123',
    category: 'job_coaching',
    date: '2024-04-10',
    duration_minutes: 120,
    description: 'Interview prep session'
  },
  authorizationId: 'auth_123'
});

// Returns:
{
  entry: { id: 'entry_789', ...timeEntry },
  hoursUsed: 10,
  hoursRemaining: 10,
  message: "Time entry created. 10 hours remaining in authorization."
}
```

## Validation Rules

### Hour Limit
- ❌ Cannot log if remaining hours < requested duration
- Returns 422 with message: "Cannot log 2 hours. Only 1.5 hours remaining."

### Date Range
- ❌ Cannot log before `start_date`
- ❌ Cannot log after `end_date`
- Returns 422 with message: "Authorization expired on 2024-06-30"

### Status
- ✓ Can only log against `active` status
- ❌ Cannot log against pending, expired, cancelled, exhausted
- System auto-updates to `exhausted` when hours_remaining ≤ 0

### Category Mapping
TimeEntry categories map to service types:

```javascript
job_coaching → job_coaching
life_skills → life_skills
cbh → cbh
job_search → job_development
resume_work → job_development
interview_prep → job_development
follow_up → job_development
consultation → job_development
```

## Hour Calculation

### hours_used (Auto-Calculated)
```
hours_used = SUM(duration_minutes / 60 for all TimeEntry with this auth_id)
```

### hours_remaining (Auto-Calculated)
```
hours_remaining = total_authorized_hours - hours_used
```

### Updated On
- When TimeEntry is created
- When TimeEntry is updated
- When TimeEntry is deleted (hours subtracted)

## Integration with Reports

### Report Headers

Use authorization data in PDF report headers:

```javascript
// In TimeEntryTransformer or PDFFieldMap
const authorization = await base44.entities.ServiceAuthorization.filter({
  id: timeEntry.service_authorization_id
}).then(a => a[0]);

const headerData = {
  authorization_number: authorization.authorization_number,
  total_hours: authorization.total_authorized_hours,
  hours_used: authorization.hours_used,
  hours_remaining: authorization.hours_remaining,
  period_start: authorization.start_date,
  period_end: authorization.end_date
};
```

### PDF Field Mappings

Add to PDFFieldMap:

```json
[
  {
    "pdf_field_name": "AuthorizationNumber",
    "source_field": "authorization_number",
    "source_type": "header"
  },
  {
    "pdf_field_name": "TotalAuthorizedHours",
    "source_field": "total_authorized_hours",
    "source_type": "header"
  },
  {
    "pdf_field_name": "HoursUsed",
    "source_field": "hours_used",
    "source_type": "header"
  },
  {
    "pdf_field_name": "HoursRemaining",
    "source_field": "hours_remaining",
    "source_type": "header"
  }
]
```

## API Reference

### validateTimeEntryAuthorization Function

#### Action: `validate`

Validates time entry without saving.

```javascript
{
  action: 'validate',
  timeEntry: {
    client_id: string,
    service_authorization_id?: string,
    category: string,
    date: string (YYYY-MM-DD),
    duration_minutes: number
  }
}
```

**Response (Success):**
```json
{
  "success": true,
  "valid": true,
  "message": "Time entry valid. Authorization: AUTH-2024-005678",
  "warning": null,
  "hoursRemaining": 18.5,
  "authorizationId": "auth_123"
}
```

**Response (Failure):**
```json
{
  "success": false,
  "valid": false,
  "message": "Cannot log 2 hours. Only 1 hour remaining.",
  "error": "INSUFFICIENT_HOURS",
  "hoursRemaining": 1,
  "authorizationId": "auth_123"
}
```

**Error Codes:**
- `NO_AUTHORIZATION` - No active authorization found
- `INSUFFICIENT_HOURS` - Not enough hours remaining
- `AUTHORIZATION_EXPIRED` - Authorization end date passed

#### Action: `create_with_auth`

Validates and creates time entry, updates authorization hours.

```javascript
{
  action: 'create_with_auth',
  timeEntry: { ...full time entry data },
  authorizationId?: string
}
```

**Response:**
```json
{
  "success": true,
  "entry": { ...TimeEntry record },
  "authorizationId": "auth_123",
  "hoursUsed": 10.5,
  "hoursRemaining": 9.5,
  "message": "Time entry created. 9.5 hours remaining."
}
```

#### Action: `get_summary`

Gets authorization summary for a client.

```javascript
{
  action: 'get_summary',
  client_id: string
}
```

**Response:**
```json
{
  "success": true,
  "summary": {
    "total": 3,
    "active": [
      {
        "id": "auth_123",
        "number": "AUTH-2024-005678",
        "serviceType": "job_coaching",
        "totalHours": 20,
        "hoursUsed": 10.5,
        "hoursRemaining": 9.5,
        "percentUsed": "52.5",
        "startDate": "2024-04-01",
        "endDate": "2024-06-30",
        "status": "active",
        "isActive": true,
        "isExpired": false,
        "isExhausted": false
      }
    ],
    "expired": [],
    "exhausted": [],
    "byServiceType": {
      "job_coaching": [...]
    }
  }
}
```

## Frontend Components

### AuthorizationPanel

Display client's active authorizations with hours tracking:

```jsx
import AuthorizationPanel from '@/components/authorization/AuthorizationPanel';

<AuthorizationPanel
  clientId="client_123"
  onAuthorizationSelect={(authId) => {
    // User selected an authorization
  }}
/>
```

Features:
- Show active, expired, exhausted authorizations
- Progress bar for hours used
- Quick action to use authorization
- Grouped by service type

## Validation Library

Use `lib/authorizationValidation.js` for client-side or server-side validation:

```javascript
import {
  validateTimeEntryAgainstAuthorization,
  getActiveAuthorization,
  updateAuthorizationHours,
  getAuthorizationStatus,
  validateAuthorizationStatus
} from '@/lib/authorizationValidation';

// Get active authorization
const auth = await getActiveAuthorization(
  base44,
  clientId,
  'job_coaching',
  '2024-04-10'
);

// Validate entry
const validation = await validateTimeEntryAgainstAuthorization(base44, timeEntry);
if (!validation.isValid) {
  console.error(validation.message);
}

// Update hours after entry creation
const result = await updateAuthorizationHours(base44, authId, 120, 'add');
```

## Best Practices

### 1. Always Link TimeEntry to Authorization

```javascript
// ✓ Good
const entry = await base44.entities.TimeEntry.create({
  client_id,
  service_authorization_id: authId,
  category: 'job_coaching',
  duration_minutes: 120
});

// ❌ Bad - disconnected from authorization
const entry = await base44.entities.TimeEntry.create({
  client_id,
  category: 'job_coaching',
  duration_minutes: 120
});
```

### 2. Validate Before Saving

```javascript
// ✓ Good
const validation = await validateTimeEntryAgainstAuthorization(base44, entry);
if (!validation.isValid) {
  throw new Error(validation.message);
}

// ❌ Bad - assumes authorization exists
const entry = await base44.entities.TimeEntry.create({...});
```

### 3. Show Remaining Hours to Staff

```jsx
// ✓ Good UI feedback
"Logging 1.5 hours will leave 8.5 hours remaining (42% used)"
"⚠️ Only 1 hour remaining in authorization!"

// ❌ Bad
"1.5 hours logged successfully"
```

### 4. Set Expiration Alerts

```javascript
// ✓ Good - warn when expiring soon
const status = getAuthorizationStatus(auth);
if (status.daysUntilExpiry <= 7) {
  alert(`Authorization expires in ${status.daysUntilExpiry} days!`);
}
```

### 5. Track Authorization in Reports

```javascript
// Include in PDF headers
Authorization: AUTH-2024-005678
Period: 04/01/2024 - 06/30/2024
Hours Authorized: 20
Hours Used: 10.5 (52.5%)
Hours Remaining: 9.5
```

## Testing

### Unit Test: Validation

```javascript
const result = await validateTimeEntryAgainstAuthorization(base44, {
  client_id: 'client_123',
  category: 'job_coaching',
  date: '2024-04-10',
  duration_minutes: 120
});

assert(result.isValid);
assert.equal(result.hoursRemaining, 18);
```

### Integration Test: Time Entry Creation

```javascript
const result = await base44.functions.invoke('validateTimeEntryAuthorization', {
  action: 'create_with_auth',
  timeEntry: {...},
  authorizationId: 'auth_123'
});

assert(result.data.success);
assert(result.data.entry.service_authorization_id === 'auth_123');
assert.equal(result.data.hoursRemaining, 9.5);
```

## Troubleshooting

### "No active authorization found"

**Cause:** TimeEntry category doesn't map to a ServiceAuthorization

**Fix:**
1. Check TimeEntry category is valid (job_coaching, life_skills, etc.)
2. Verify ServiceAuthorization exists for that service_type
3. Check authorization start_date <= entry date <= end_date
4. Check authorization status is 'active'

### "Cannot log hours beyond authorized"

**Cause:** Hours logged exceed authorization remaining hours

**Solution:**
1. Check hoursRemaining in authorization
2. Reduce TimeEntry duration_minutes
3. Create new authorization if needed

### "Authorization not updating"

**Cause:** TimeEntry created without service_authorization_id

**Fix:**
1. Always link TimeEntry to specific authorization
2. Use `create_with_auth` action instead of direct create
3. Re-calculate hours_used for authorization (sum TimeEntry entries)

## Reporting Compliance

This system ensures:
- **USOR95/96:** Hours logged match authorization
- **Audit Trail:** Each time entry links to its authorization
- **Compliance:** No hours logged beyond authorized limit
- **Documentation:** Authorization details in report headers