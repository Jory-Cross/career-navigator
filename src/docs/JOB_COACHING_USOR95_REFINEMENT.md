# Job Coaching Time Entry Form Refinement (USOR95)

## Overview
The Job Coaching time entry form has been refined to be **minimal, fast, and focused** on the 4 visible fields required per service event.

## Visible Fields (Time Entry Form Only)

### 1. Service Date (Row Context)
- **Label**: Service Date
- **Type**: date input
- **Required**: Yes (on entry and for report)
- **Purpose**: Capture the full date of the coaching service
- **System Handling**: 
  - Stored as `service_date` internally
  - Day-of-month automatically derived for `coaching_day` field
  - Used to populate month_year at report assembly time

### 2. Day of Month (Read-Only Display)
- **Label**: Day
- **Type**: number (display only)
- **Auto-populated**: From service_date
- **Purpose**: Show the specific day (5, 12, 27, etc.) for staff reference
- **PDF Context**: row
- **Field Key**: `coaching_day`

### 3. Hours (Required)
- **Label**: Hours
- **Type**: number (decimal)
- **Min/Step**: 0.25 hour increments
- **Required**: Yes (on entry and for report)
- **Purpose**: Duration of coaching service
- **PDF Context**: row
- **Field Key**: `coaching_hours`

### 4. Primary Service Code (Required Select)
- **Label**: Primary Service Code
- **Type**: select dropdown
- **Required**: Yes (on entry and for report)
- **Purpose**: Categorize the type of coaching provided
- **PDF Context**: row
- **Field Key**: `primary_service_code`
- **Data Source**: ServiceCode table (centralized reference)

**Display Format in Dropdown**:
```
JC01 - Job Coaching: Direct On-Site Support
JC02 - Job Coaching: Job Task Analysis
JC03 - Job Coaching: Employer Consultation
JC04 - Job Coaching: Follow-Up Support
```

### 5. Secondary Service Code (Optional Select)
- **Label**: Secondary Service Code
- **Type**: select dropdown
- **Required**: No
- **Purpose**: Secondary activity if applicable
- **PDF Context**: row
- **Field Key**: `secondary_service_code`
- **Data Source**: ServiceCode table

## Service Codes (Centralized Reference)

All service codes are stored in the **ServiceCode** entity and include:
- `code` (JC01, JC02, etc.)
- `display_label` (full formatted label for dropdowns)
- `service_type` (job_coaching, job_development, life_skills)
- `is_primary` / `is_secondary` flags for validation

**Current Job Coaching Codes**:
| Code | Description | Category |
|------|-------------|----------|
| JC01 | Direct On-Site Support | Direct Service |
| JC02 | Job Task Analysis | Direct Service |
| JC03 | Employer Consultation | Indirect Service |
| JC04 | Follow-Up Support | Direct Service |

## Removed from Time Entry Form

The following fields are **NOT asked during time entry**:
- ❌ `client_name` → Populated from client profile
- ❌ `authorization_number` → Populated from service authorization
- ❌ `vr_counselor_name` → Populated from service authorization
- ❌ `employer_name` → Populated from client profile
- ❌ `job_title` → Populated from client profile
- ❌ `month_year` → Derived from service_date during report assembly
- ❌ `job_goal` → Populated from service authorization
- ❌ Authorization totals → Computed at report time
- ❌ `coaching_activities` → Marked as internal-only (not for reporting)
- ❌ `client_performance_notes` → Marked as internal-only (not for reporting)

## Data Flow

### Time Entry Capture
```
1. Staff selects Service Date → Day auto-filled
2. Staff enters Hours
3. Staff selects Primary Service Code
4. Staff optionally selects Secondary Service Code
5. Entry saved → TimeEntry + ReportFieldAnswer created
```

### Report Assembly
```
1. TimeEntry records fetched for period
2. ReportFieldAnswer records retrieved
3. Client/Authorization data joined
4. month_year derived from service_date
5. PDF fields populated with combined data
```

## Implementation Files

### Backend Functions
- `seedServiceCodes.js` - Create 10 service codes (job_coaching, job_development, life_skills)
- `refineJobCoachingFields.js` - Set up 4 visible ReportFieldTemplate records for job_coaching

### Components
- `JobCoachingTimeEntryForm.jsx` - Minimal time entry form with 4 visible fields

### Entities
- `ServiceCode.json` - Centralized service code reference table

## Validation Rules

**Time Entry Validation**:
- Service Date required
- Hours > 0
- Primary Service Code required
- Secondary Service Code optional

**Report Validation** (handled separately):
- All required fields present
- Service codes valid
- Data integrity checks

## Next Steps

1. ✅ Service codes seeded
2. ✅ Job Coaching fields refined (4 visible fields)
3. 📋 Update TimeLogDashboard to use JobCoachingTimeEntryForm component
4. 📋 Test end-to-end time entry → PDF output
5. 📋 Repeat process for job_development and life_skills