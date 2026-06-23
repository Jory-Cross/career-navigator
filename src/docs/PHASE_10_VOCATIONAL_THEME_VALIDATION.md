# Phase 10: Vocational Theme Candidate Validation Workflow

## Objective
Create a structured validation lifecycle for Vocational Theme Candidates to track validation status as discovery hypotheses, following Griffin-Hammis Customized Employment methodology.

## Files Created

### 1. Entity Schema
**File:** `entities/VocationalThemeCandidateStatus.json`

**Purpose:** Stores the validation lifecycle status of each VTC as a discovery hypothesis.

**Fields:**
- `org_id` (string) — Tenant organization ID
- `client_id` (string) — FK to Client
- `candidate_theme_name` (string) — Exact VTC name (e.g., "Retail Customer Service")
- `category_label` (string) — Source category (e.g., "Emerging Interests")
- `status` (enum) — Current validation status:
  - `untested` (default)
  - `emerging`
  - `supported`
  - `needs_validation`
  - `refuted`
  - `archived`
- `status_date` (date) — Date status was set
- `status_notes` (string) — Narrative explanation
- `reviewer_user_id` (string) — User who set status
- `reviewer_role` (string) — Platform role at time of update
- `is_active` (boolean) — Soft-delete flag

**RLS:** None (standard org_id isolation applies)

---

### 2. Backend Functions

#### Function: `saveVocationalThemeCandidateStatus.js`

**Behavior:**
- Creates or updates candidate status
- Maintains one active status per (client_id, candidate_theme_name)
- Soft-deletes previous active record when new status is set
- Validates:
  - User authentication
  - Client existence
  - Status enum values
  - Required fields

**Request Payload:**
```json
{
  "client_id": "string (required)",
  "candidate_theme_name": "string (required)",
  "category_label": "string (required)",
  "status": "untested|emerging|supported|needs_validation|refuted|archived (required)",
  "status_notes": "string (optional)"
}
```

**Response:**
```json
{
  "success": true,
  "status": { /* VocationalThemeCandidateStatus record */ },
  "message": "Status updated to \"[status]\" for [theme name]"
}
```

**Errors:**
- 401: Unauthorized
- 400: Missing required fields or invalid status value
- 404: Client not found
- 500: Server error

---

#### Function: `getVocationalThemeCandidateStatus.js`

**Behavior:**
- Retrieves active status for a candidate
- Returns default untested status if no record exists
- Includes `exists` flag to distinguish between "untested by default" and "explicitly untested"

**Request Payload:**
```json
{
  "client_id": "string (required)",
  "candidate_theme_name": "string (required)"
}
```

**Response (when no record exists):**
```json
{
  "status": "untested",
  "status_date": "2026-06-23",
  "status_notes": "",
  "exists": false,
  "message": "No status record found; candidate is untested by default"
}
```

**Response (when record exists):**
```json
{
  "id": "string",
  "client_id": "string",
  "candidate_theme_name": "string",
  "status": "emerging|supported|...",
  "status_date": "date",
  "status_notes": "string",
  "reviewer_user_id": "string",
  "reviewer_role": "string",
  "exists": true
}
```

**Errors:**
- 401: Unauthorized
- 400: Missing required fields
- 500: Server error

---

### 3. UI Component

**File:** `components/customized-employment/VocationalThemeCandidateStatusPanel.jsx`

**Purpose:** Displays and manages validation status for a VTC candidate.

**Props:**
- `client` — Client object with id and org_id
- `candidate` — VTC candidate object with themeName and categoryLabel
- `currentUser` — Current authenticated user

**Features:**
1. **Display Mode:**
   - Shows current status with icon and color-coded badge
   - Displays status notes if present
   - Shows "Update Status" button

2. **Edit Mode:**
   - Dropdown to select new status
   - Textarea for optional notes
   - Cancel and Save buttons
   - Loading state during save

3. **Status Badge Styling:**
   | Status | Color | Icon |
   |--------|-------|------|
   | untested | slate | Clock |
   | emerging | amber | AlertCircle |
   | supported | emerald | CheckCircle2 |
   | needs_validation | orange | AlertCircle |
   | refuted | red | XCircle |
   | archived | slate | XCircle |

4. **Behavior:**
   - Fetches current status on component mount
   - Displays loading state while fetching
   - Saves status to database via backend function
   - Shows toast notifications on success/error
   - Reverts to display mode after save

---

## Integration Points

### Vocational Theme Candidate Card

**File Modified:** `components/customized-employment/EvidenceThemeGroupPanel.jsx`

**Changes:**
- Added import: `VocationalThemeCandidateStatusPanel`
- Added validation status section before reviewer consensus
- Section displays between:
  - Evidence Graph Summary
  - Reviewer Consensus
- Only renders when `client` and `currentUser` are present

**UI Layout:**
```
┌─────────────────────────────────────┐
│  Vocational Theme Candidate Card    │
├─────────────────────────────────────┤
│ Supporting Themes                   │
├─────────────────────────────────────┤
│ Supporting Concepts                 │
├─────────────────────────────────────┤
│ Evidence Graph Summary (collapsible) │
├─────────────────────────────────────┤
│ VALIDATION STATUS                   │ ← NEW
│ [Status Badge] [Update Status btn]  │ ← NEW
├─────────────────────────────────────┤
│ Reviewer Consensus                  │
├─────────────────────────────────────┤
│ Staff Feedback                      │
├─────────────────────────────────────┤
```

---

## Validation Workflow

### Status Progression Rules

**Suggested Progression:**
```
Untested → Emerging → Supported → Archived
```

**Alternative Paths:**
```
Untested → Needs Validation
Emerging → Needs Validation
Emerging → Refuted → Archived
Supported → Archived
```

### Key Principles
- **Default:** All new VTCs start as "Untested"
- **No Automatic Transitions:** All status changes are manual, human decisions
- **Soft-Delete Previous:** When new status is set, previous active record is marked `is_active: false`
- **One Active Status:** Only one active status record exists per (client_id, candidate_theme_name) pair

---

## Discovery Activities Integration

Candidates can be validated through:
- Discovery Activities — Hands-on exploration of themes
- Discovery Interviews — Client discussion of themes
- Informational Interviews — Employer validation
- Community Exploration — Real-world testing
- Employer Validation — Direct employer feedback

**Expected Workflow:**
1. VTC created as "Untested" (synthesized from evidence)
2. Discovery Activity conducted → Update status to "Emerging" with notes
3. Additional validation activities → Update status to "Supported" or "Needs Validation"
4. If contradicted by evidence → Update status to "Refuted"
5. If no longer pursuing → Update status to "Archived"

---

## CRUD Operations Verification

### Create (Save Status)
```javascript
const response = await base44.functions.invoke(
  'saveVocationalThemeCandidateStatus',
  {
    client_id: 'client123',
    candidate_theme_name: 'Retail Customer Service',
    category_label: 'Emerging Interests',
    status: 'emerging',
    status_notes: 'Client expressed interest during home discovery.'
  }
);
// Returns: { success: true, status: {...}, message: "..." }
```

### Read (Get Status)
```javascript
const response = await base44.functions.invoke(
  'getVocationalThemeCandidateStatus',
  {
    client_id: 'client123',
    candidate_theme_name: 'Retail Customer Service'
  }
);
// Returns: { status: 'emerging', status_notes: '...', exists: true }
```

### Update (Save Status with Different Status)
```javascript
// Save function is idempotent—calling with new status updates the record
const response = await base44.functions.invoke(
  'saveVocationalThemeCandidateStatus',
  {
    client_id: 'client123',
    candidate_theme_name: 'Retail Customer Service',
    category_label: 'Emerging Interests',
    status: 'supported',  // Changed from 'emerging'
    status_notes: 'Confirmed via Discovery Activity 6/20. Strong engagement.'
  }
);
// Returns: { success: true, status: {...}, message: "..." }
```

### Delete (Soft-Delete via Archive)
```javascript
// Set status to 'archived' to soft-delete the hypothesis
const response = await base44.functions.invoke(
  'saveVocationalThemeCandidateStatus',
  {
    client_id: 'client123',
    candidate_theme_name: 'Retail Customer Service',
    category_label: 'Emerging Interests',
    status: 'archived',
    status_notes: 'Refuted—client expressed no interest after informational interview.'
  }
);
```

---

## What Phase 10 Does NOT Include

This phase does NOT create:
- ✗ Final vocational themes (those come in later phases)
- ✗ AI recommendations or job matching
- ✗ Automatic status transitions or lifecycle automation
- ✗ Analytics dashboards or reporting
- ✗ Outcome tracking or success metrics

This phase ONLY tracks validation status as discovery hypotheses.

---

## Testing Checklist

- [x] Entity schema validates
- [x] Save function validates client existence
- [x] Save function validates status enum
- [x] Save function soft-deletes previous active record
- [x] Get function returns untested by default
- [x] Get function distinguishes exists vs default
- [x] UI component fetches status on mount
- [x] UI component displays all 6 status types
- [x] UI component allows status selection
- [x] UI component allows notes input
- [x] UI component shows loading state
- [x] UI component shows save state
- [x] UI component displays in correct location on card
- [x] UI component requires client and currentUser

---

## Files Summary

| File | Type | Purpose |
|------|------|---------|
| `entities/VocationalThemeCandidateStatus.json` | Entity | Stores validation status |
| `functions/saveVocationalThemeCandidateStatus.js` | Backend | Create/update status |
| `functions/getVocationalThemeCandidateStatus.js` | Backend | Read status |
| `components/customized-employment/VocationalThemeCandidateStatusPanel.jsx` | Component | UI for status management |
| `components/customized-employment/EvidenceThemeGroupPanel.jsx` | Component (modified) | Added status section |

---

## Next Phase

Phase 11 would build on this by:
- Creating automated discovery activity suggestions based on candidate status
- Building validation evidence reports
- Creating status history/audit trail views
- Integrating status with DSR generation
- Adding status-based filtering to candidate lists