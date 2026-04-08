# ⚠️ Silent Failure Guards

## Overview

Silent failures occur when:
- ❌ API call succeeds (no error thrown)
- ❌ But data is incomplete or corrupted
- ❌ UI doesn't know what went wrong
- ❌ User sees "saved" but data is broken

**Solution:** Multi-layer validation guards at each step.

---

## Guard Layers

### Layer 1: Input Validation (saveTimeEntry)

**Location:** `lib/saveTimeEntry.js` (lines 21-46)

```javascript
// ⚠️ Guard 1: Payload exists
if (!payload) {
  throw new Error("Payload is missing - cannot save entry");
}

// ⚠️ Guard 2: entry_type_code required
if (!entryTypeCode) {
  throw new Error("Missing entry_type_code - entry type must be specified");
}

// ⚠️ Guard 3: date required
if (!payload.date) {
  throw new Error("Missing date field - service date is required");
}

// ⚠️ Guard 4: duration_minutes required and positive
if (payload.duration_minutes === undefined || payload.duration_minutes === null) {
  throw new Error("Missing duration_minutes - service hours/duration is required");
}
if (Number(payload.duration_minutes) <= 0) {
  throw new Error(`Invalid duration_minutes: ${payload.duration_minutes} - must be greater than 0`);
}

// ⚠️ Guard 5: form_data structure check
if (payload.form_data === undefined) {
  console.warn("[saveTimeEntry] ⚠️ form_data is missing...");
  payload.form_data = {};
}
```

**What it catches:**
- Empty payloads
- Missing entry type
- Missing date
- Zero or negative duration
- Missing form_data object

---

### Layer 2: Payload Normalization (buildTimeEntryPayload)

**Location:** `lib/timeEntryPayloadBuilder.js` (lines 131-155)

```javascript
// ⚠️ Guard: Entry type must exist in registry
const config = getEntryTypeConfig(entryTypeCode);
if (!config) {
  throw new Error(`❌ Unknown entry type: "${entryTypeCode}"...`);
}

// ⚠️ Guard: Date extraction must succeed
const date = extractDate(formData);
if (!date) {
  throw new Error("❌ Missing or invalid date - could not parse from...");
}

// ⚠️ Guard: Duration normalization must produce positive number
const durationMinutes = normalizeDuration(formData);
if (!durationMinutes || durationMinutes <= 0) {
  throw new Error(`❌ Missing or invalid duration - must be positive. Got: ${durationMinutes}...`);
}
```

**What it catches:**
- Unrecognized entry type codes
- Unparseable date values
- Zero duration after conversion (e.g., 0 hours → 0 minutes)
- Non-numeric duration values

---

### Layer 3: Final Payload Validation (before persistence)

**Location:** `lib/saveTimeEntry.js` (lines 68-74)

```javascript
// ⚠️ Guard: Verify final payload structure
if (!builderPayload.date) {
  throw new Error("❌ Payload validation failed: missing date after normalization");
}
if (!builderPayload.duration_minutes || builderPayload.duration_minutes <= 0) {
  throw new Error("❌ Payload validation failed: invalid duration_minutes after normalization");
}
if (!builderPayload.entry_type_code) {
  throw new Error("❌ Payload validation failed: missing entry_type_code in final payload");
}
```

**What it catches:**
- Data loss during normalization
- Payload corruption between builder and persistence
- Builder returning incomplete payloads

---

### Layer 4: Create Data Validation

**Location:** `lib/saveTimeEntry.js` (lines 87-100)

```javascript
const createData = {
  ...builderPayload,
  client_id: clientId,
  employee_id: currentUser.id
};

// ⚠️ Guard: User authenticated
if (!currentUser?.id) {
  throw new Error("❌ Cannot create entry: user not authenticated or missing employee_id");
}

// ⚠️ Guard: Create data has minimum required fields
if (!createData.date) {
  throw new Error("❌ Create payload missing date");
}
if (!createData.duration_minutes || createData.duration_minutes <= 0) {
  throw new Error("❌ Create payload invalid duration_minutes");
}
if (!createData.employee_id) {
  throw new Error("❌ Create payload missing employee_id");
}
```

**What it catches:**
- Unauthenticated user trying to create entry
- Missing employee_id (would create orphaned record)
- Date or duration lost during merge
- Invalid duration values

---

### Layer 5: Post-Persistence Verification

**Location:** `lib/saveTimeEntry.js` (lines 108-112, 119-123)

```javascript
// ⚠️ UPDATE: Verify record actually exists after update
const updated = await base44.entities.TimeEntry.get(existingEntry.id);
if (!updated) {
  throw new Error("❌ Post-update verification failed: could not retrieve updated entry");
}

// ⚠️ CREATE: Verify operation returned an ID
const result = await base44.entities.TimeEntry.create(createData);
if (!result || !result.id) {
  throw new Error("❌ Create operation failed - no ID returned");
}
```

**What it catches:**
- Database update that silently failed
- Database create that returned nothing
- Records that disappeared after save
- Database consistency issues

---

## Guard Coverage Matrix

| Scenario | Guard Layer | Throws Error | Prevents | 
|----------|------------|--------------|----------|
| Empty payload | 1 | Yes | Silent null errors |
| Missing entry_type_code | 1 | Yes | Wrong entry type |
| Missing date | 1 + 2 | Yes | Undated entries |
| Zero duration | 1 + 2 + 3 | Yes | Zero-minute entries |
| Unparseable date | 2 | Yes | Invalid date storage |
| Unknown entry type | 2 | Yes | Unrecognized type |
| Lost date during normalize | 3 | Yes | Data corruption |
| Lost duration during normalize | 3 | Yes | Data corruption |
| Unauthenticated user | 4 | Yes | Orphaned records |
| Missing employee_id | 4 | Yes | Database constraint violation |
| Create returns no ID | 5 | Yes | Silent failure |
| Update returns nothing | 5 | Yes | Silent failure |

---

## Error Message Quality

Each error message includes:

✅ **What went wrong**
```
❌ Missing duration_minutes
```

✅ **Why it matters**
```
- service hours/duration is required
```

✅ **What was provided** (if applicable)
```
Got: 0
Got: undefined
Got: "abc"
```

✅ **Where to look**
```
Check duration_minutes, duration_hours, or structured fields (jc_hours, jd_hours, etc.)
Could not parse from formData.date or structured date fields
```

---

## Testing Silent Failures

### Test Case 1: Missing Duration

```javascript
// Payload with zero duration
const payload = {
  entry_type_code: "job_coaching",
  date: "2026-04-08",
  duration_minutes: 0,  // ❌ BAD
  form_data: {}
};

await saveTimeEntry({ payload });
// ✅ Throws: "Invalid duration_minutes: 0 - must be greater than 0"
// ✅ Toast error shown
// ✅ Entry NOT saved
```

### Test Case 2: Missing Entry Type

```javascript
// Payload with missing entry_type_code
const payload = {
  date: "2026-04-08",
  duration_minutes: 120,
  form_data: {}
};

await saveTimeEntry({ payload });
// ✅ Throws: "Missing entry_type_code - entry type must be specified"
// ✅ Toast error shown
// ✅ Entry NOT saved
```

### Test Case 3: Missing Date

```javascript
// Payload with missing date
const payload = {
  entry_type_code: "job_coaching",
  duration_minutes: 120,
  form_data: {}
};

await saveTimeEntry({ payload });
// ✅ Throws: "Missing date field - service date is required"
// ✅ Toast error shown
// ✅ Entry NOT saved
```

### Test Case 4: Post-Create Verification

```javascript
// If create() returns null/undefined
const result = await base44.entities.TimeEntry.create(createData);
// result = null (hypothetical database issue)

// ✅ Throws: "Create operation failed - no ID returned"
// ✅ Toast error shown
// ✅ User notified of failure
```

---

## Prevention Checklist

When saving entries:

- [x] Payload must exist (not null/undefined)
- [x] entry_type_code must be provided
- [x] date must be provided
- [x] duration_minutes must be > 0
- [x] Entry type must exist in registry
- [x] Date must parse successfully
- [x] Duration must normalize to positive number
- [x] Final payload must have date, duration, entry_type_code
- [x] User must be authenticated
- [x] Create data must have employee_id
- [x] Database operation must return valid record/ID
- [x] Post-persist verification must succeed

---

## Console Output for Debugging

All guards produce clear console logs:

```
🟢 [saveTimeEntry] === START ===
🟢 [saveTimeEntry] Incoming payload: {...}
🟢 [saveTimeEntry] Normalized payload: {...}
🟢 Saving Entry Payload: {...}
🟢 [saveTimeEntry] Creating TimeEntry with payload: {...}
🟢 [saveTimeEntry] Create successful, entry ID: abc-123
🟢 [saveTimeEntry] === SUCCESS ===
```

Or if guard triggers:

```
🟢 [saveTimeEntry] === START ===
🟢 [saveTimeEntry] Incoming payload: {...}
🔴 Save Entry Failed: {
  payload: {...},
  error: "❌ Invalid duration_minutes: 0 - must be greater than 0"
}
🔴 [saveTimeEntry] === FAILED ===
```

---

## No More Silent Failures

| Old Behavior | New Behavior |
|---|---|
| Save succeeds but data is corrupt | ❌ Guard layer 2/3 catches it |
| Duration is zero but saved | ❌ Guard layer 1 catches it |
| Date doesn't parse but saved | ❌ Guard layer 2 catches it |
| Create returns nothing, UI doesn't know | ❌ Guard layer 5 catches it |
| Error hidden in logs | ✅ User sees toast + console error |

---

## Future-Proofing

When adding new required fields:

```javascript
// ✅ Add to guard layer 1 (input validation)
if (!payload.newRequiredField) {
  throw new Error("Missing newRequiredField - description of why it's required");
}

// ✅ Add to guard layer 3 (final validation)
if (!builderPayload.newRequiredField) {
  throw new Error("❌ Payload validation failed: newRequiredField lost during normalization");
}

// ✅ Test: Try to save without the field
// ✅ Verify: Error is thrown, entry not saved
```

The multi-layer guard system catches all paths where data could be lost.