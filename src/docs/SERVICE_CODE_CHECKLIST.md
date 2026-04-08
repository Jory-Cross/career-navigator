# ✅ Service Code Consistency Checklist

## 🎯 What We're Verifying

Service codes in TimeEntry form data should be:

1. **IDs only** - Never labels (e.g., "1", not "1 - Attend employer training...")
2. **Never duplicated** - Each code type has one field (primary + optional secondary)
3. **Required/optional** - Properly validated based on schema definition

---

## 📋 Architecture Verification

### ✅ Form Rendering (FieldRenderer)

- [x] Dropdown renders with `opt.value` (ID) as select value
- [x] Dropdown displays `opt.label` (human-readable) as option text
- [x] `onChange` receives the value (ID), not label
- [x] No hardcoded dropdown content - uses schema from vrFormConfig.js
- [x] No duplicate dropdowns for same code type

**Code Location:** `components/time-entry/FieldRenderer` (lines 59-76)

**Test:** Open job_coaching form → select "1 - Attend employer training..." → verify stored value is "1"

---

### ✅ Payload Building (timeEntryPayloadBuilder)

- [x] Uses `mapTemplateFields()` to extract form data
- [x] Extraction is schema-based (by field.key)
- [x] No label values make it into payload
- [x] Service codes in form_data are always IDs

**Code Location:** `lib/timeEntryPayloadBuilder.js` (lines 94-117)

**Test:** Create entry with job_coaching → inspect payload → verify `form_data.jc_primary_service_code` is "1" (ID), not label

---

### ✅ Template Field Mapping (templateFieldMapper)

- [x] **Rule 1:** Always extracts by `field.key` (never label)
- [x] **Rule 2:** Never uses `field.label` for extraction
- [x] **Rule 3:** Flat structure (no nesting like `service_codes: { primary: "1" }`)
- [x] **Rule 4:** No hardcoded field names

**Code Location:** `lib/templateFieldMapper.js` (lines 24-49)

**Implementation:**
```javascript
schemaFields.forEach(field => {
  const key = field.key;  // ← Uses key
  const value = formData[key];  // ← Extracts by key
  if (value !== undefined && value !== null) {
    result[key] = value;  // ← Stores by key
  }
});
```

---

### ✅ Required/Optional Handling (validationRules.js)

- [x] Schema defines `required: true/false` for each field
- [x] `validateEntryForm()` checks required fields
- [x] Form submission blocked if required field missing
- [x] Optional fields allow empty values

**Code Location:** `lib/validationRules.js`

**Example from vrFormConfig.js:**
```javascript
{
  key: "jc_primary_service_code",
  required: true,  // ← MUST have value
}

{
  key: "jc_secondary_service_code",
  required: false,  // ← Can be empty
}
```

---

## 🧪 Testing Service Code Consistency

### Manual Test: Create Entry

1. Go to TimeTracking page
2. Click "New Entry"
3. Select "Job Coaching" entry type
4. Fill in required fields
5. For "Primary Service Code", select "1 - Attend employer training..."
6. For "Secondary Service Code" (optional), select "2 - Meet with..."
7. Click "Save Entry"
8. Check browser DevTools → Network → TimeEntry.create
9. Verify payload contains:
   ```json
   {
     "form_data": {
       "jc_primary_service_code": "1",
       "jc_secondary_service_code": "2"
     }
   }
   ```

**Expected:** Service codes are IDs ("1", "2"), not labels ✅

---

### Backend Audit: Run Consistency Check

**Admin-only function** to audit all TimeEntries:

```bash
# In browser console (as admin):
const result = await base44.functions.invoke('validateServiceCodeConsistency', {});
console.log(result.data);
```

**Output format:**
```json
{
  "status": "PASS" or "FAIL",
  "totalEntries": 42,
  "issuesFound": 0,
  "entriesWithLabelValues": [],
  "entriesWithInvalidIds": [],
  "entriesWithDuplication": []
}
```

**Function Location:** `functions/validateServiceCodeConsistency.js`

---

### Frontend Validation: Use Utility

```javascript
import { 
  validateServiceCodeField,
  validateFormDataServiceCodes,
  validateTimeEntryServiceCodes,
  generateServiceCodeReport
} from "@/lib/validateServiceCodeConsistency";

// Validate single field
const result = validateServiceCodeField("jc_primary_service_code", "1");
console.log(result.valid);  // true

// Validate entire form_data
const formResult = validateFormDataServiceCodes(
  { jc_primary_service_code: "1", jc_secondary_service_code: "" },
  "job_coaching"
);
console.log(formResult.valid);  // true

// Generate report
const report = generateServiceCodeReport(timeEntry);
console.log(report);
```

**Utility Location:** `lib/validateServiceCodeConsistency.js`

---

## 🚨 Anti-Patterns (AVOID)

### ❌ Storing label instead of ID
```javascript
// BAD - Form stores label
formData["jc_primary_service_code"] = "1 - Attend employer training..."

// GOOD - Form stores ID
formData["jc_primary_service_code"] = "1"
```

### ❌ Duplicate dropdown rendering
```javascript
// BAD - Two dropdowns for same field
<Select>{options.map(...)}</Select>
<Select>{options.map(...)}</Select>

// GOOD - One dropdown per field
<FieldRenderer field={schema[index]} ... />
```

### ❌ Storing both ID and label
```javascript
// BAD - Duplication
form_data: {
  jc_primary_service_code: "1",
  jc_primary_service_code_text: "1 - Attend employer training..."
}

// GOOD - ID only
form_data: {
  jc_primary_service_code: "1"
}
```

### ❌ Hardcoding field names
```javascript
// BAD - Hardcoded, breaks if schema changes
if (formData.primary_service_code) { ... }

// GOOD - Iterate schema
schemaFields.forEach(field => {
  const value = formData[field.key];
})
```

### ❌ Skipping validation
```javascript
// BAD - No validation
await saveTimeEntry(payload);
closeModal();

// GOOD - Validate before save
const validation = validateFormDataServiceCodes(formData, code);
if (!validation.valid) {
  setError(validation.errors[0]);
  return;
}
await saveTimeEntry(payload);
closeModal();
```

---

## 📊 Service Code Reference

### Job Coaching (job_coaching)

| ID | Description |
|----|-------------|
| 1 | Attend employer training (client and job coach) |
| 2 | Meet with worksite sups and natural supports |
| 3 | Review, train, teach essential job duties with client |
| 4 | Provide individualized training for learning job tasks |
| 5 | Perform onsite follow-up checks with client |
| 6 | Provide direct interventions on the job |
| 7 | Identify and set up accommodations (employer & VR) |
| 8 | Build and coordinate natural supports for continued work success |
| 9 | Shadow and observe client while on worksite |
| 10 | Develop and implement support plan after job coach fades |
| 11 | Develop work culture skills (breaks, sick days, etc.) |
| 12 | Develop work conditioning and hardening |
| 13 | Provide support and encouragement |
| 14 | Provide other support approved in advance by VR |
| 15 | Provide transportation training |

**Field Names:**
- `jc_primary_service_code` (required)
- `jc_secondary_service_code` (optional)

---

## 🔄 Data Flow: Service Code Roundtrip

```
┌─────────────────────────────────────────┐
│ User selects service code from dropdown │
│ Display: "1 - Attend employer..."       │
│ Stored: "1"                             │
└──────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│ FieldRenderer.onChange()                │
│ Passes value to parent form              │
│ formData["jc_primary_service_code"] = "1"
└──────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│ DynamicEntryForm.handleSubmit()         │
│ Builds payload via buildTimeEntryPayload │
│ Calls mapTemplateFields() by key        │
└──────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│ saveTimeEntry()                         │
│ Sends to API:                           │
│ {                                       │
│   form_data: {                          │
│     jc_primary_service_code: "1"        │
│   }                                     │
│ }                                       │
└──────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│ Database stores TimeEntry               │
│ form_data.jc_primary_service_code = "1" │
└──────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│ Edit entry: form rehydrated             │
│ formData["jc_primary_service_code"] = "1"
│ Dropdown shows "1 - Attend..." (linked  │
│ via options: [{value:"1", label:"..."}] │
└──────────────────────────────────────────┘
```

**Verification Points:**
- ✅ Stored value is always "1" (ID), never "1 - Attend employer..."
- ✅ Display text comes from options array, not stored data
- ✅ Roundtrip maintains data integrity

---

## Summary

| Check | Status | Evidence |
|-------|--------|----------|
| Service codes stored as IDs | ✅ | FieldRenderer + mapTemplateFields |
| No duplicate dropdowns | ✅ | Single SelectContent per field |
| No label values in payload | ✅ | mapTemplateFields extracts by key |
| Required/optional enforced | ✅ | validateEntryForm checks schema |
| No hardcoded field names | ✅ | All from vrFormConfig.js schema |
| Validation utility provided | ✅ | validateServiceCodeConsistency.js |
| Backend audit available | ✅ | functions/validateServiceCodeConsistency.js |

---

## Maintenance

When adding new service code fields:

1. ✅ Add to vrFormConfig.js with proper key/label/required
2. ✅ Use FieldRenderer (automatically handles it)
3. ✅ Schema-based extraction handles it automatically
4. ✅ No additional code needed
5. ✅ Run backend audit to verify consistency

**No special handling needed** - the unified architecture handles it.