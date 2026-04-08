# Unified Create/Edit Flow

## Overview

Create and Edit now share the exact same round-trip path:
1. existing entry → rehydrate to formData
2. formData → FormEngine → DynamicEntryForm
3. DynamicEntryForm → handleDynamicEntrySave
4. handleDynamicEntrySave → buildTimeEntryPayload → saveTimeEntry
5. saveTimeEntry → POST/PUT to backend
6. refresh UI + close modal

**Core Rule**: Create and Edit differ ONLY in the final persistence call (create vs update).

---

## Architecture

### Step 1: Rehydration (for edit)

When editing, we convert the existing TimeEntry record into the shape the form expects.

**File**: `lib/timeEntryRehydration.js`

```javascript
import { buildFormDataFromEntry } from "@/lib/timeEntryRehydration";

const initialFormData = buildFormDataFromEntry(entry, { fields: schema });
```

Handles:
- Legacy `data` field
- New `form_data` field
- Top-level fields (notes, service_code_id, duration_minutes)
- Type normalization (string→number, etc.)
- Missing fields (safe defaults)

### Step 2: Form Mount & Initial Values

**File**: `components/time-entry/DynamicEntryForm`

```javascript
const initialData = useMemo(() => {
  if (entry?.id) {
    // EDIT: Rehydrate existing entry
    return buildFormDataFromEntry(entry, { fields: schema });
  }
  // CREATE: Empty form
  return buildInitialFormData(schema, null);
}, [schema, entry]);

const [formData, setFormData] = useState(initialData);
```

Syncs when entry changes (important for multiple edits):
```javascript
useEffect(() => {
  setFormData(initialData);
}, [initialData]);
```

### Step 3: Form Submission (unified)

**File**: `components/time-entry/DynamicEntryForm`

Same handler for both create and edit:

```javascript
async function handleSubmit(e) {
  e.preventDefault();
  
  await handleDynamicEntrySave({
    entryType: { id: entryTypeObj?.id, code: entryTypeCode, name: entryTypeObj?.name },
    formData,
    schema,
    existingEntry: entry,      // ← null for create, entry object for edit
    mode,                       // ← "create" or "edit"
    saveEntry: async (payload, entryId) => {
      // Use saveTimeEntry which branches on existingEntry
      await saveTimeEntry({
        entryTypeId: entryTypeObj?.id,
        formData,
        schema,
        existingEntry: entry?.id ? entry : null,  // ← branches on ID
      });
      return { id: entryId || entry?.id };
    },
  });
  
  if (onSave) await onSave();  // Refresh parent
}
```

### Step 4: Payload Building (unified)

**File**: `lib/timeEntryPayloadBuilder.js`

Same builder for create & edit:

```javascript
const payload = buildTimeEntryPayload({
  entryType,
  formData,
  schema
});
```

Returns:
```javascript
{
  entry_type_id: "...",
  duration_minutes: 60,
  notes: "...",
  service_code_id: "...",
  form_data: { field1: value1, ... }
}
```

### Step 5: Save Handler (branching)

**File**: `lib/saveTimeEntry.js`

Branches on `existingEntry`:

```javascript
if (existingEntry?.id) {
  // UPDATE: existing ID
  await base44.entities.TimeEntry.update(existingEntry.id, payload);
  const updated = await base44.entities.TimeEntry.get(existingEntry.id);
  validateRoundTripIntegrity(payload, updated);
} else {
  // CREATE: no ID
  const createData = {
    ...payload,
    client_id: clientId,
    employee_id: currentUser.id
  };
  const result = await base44.entities.TimeEntry.create(createData);
  const freshEntry = await base44.entities.TimeEntry.get(result.id);
  validateRoundTripIntegrity(payload, freshEntry);
}
```

---

## Usage in Components

### TimeLogDashboard

```javascript
<Button onClick={() => {
  setEditingEntry(entry);
  setSelectedEntryTypeCode(entry.entry_type_code);
  setShowForm(true);
}}>
  Edit
</Button>

<FormEngine
  entryTypeCode={activeEntryTypeCode}
  entry={editingEntry}                    // ← null for create, entry for edit
  mode={editingEntry ? "edit" : "create"}
  onSave={async () => {
    await onRefresh();
    setShowForm(false);
    setEditingEntry(null);
  }}
/>
```

### Job Coaching (or any other form)

Just pass `entry` to FormEngine:
- If `entry?.id` exists → EDIT mode
- If entry is null → CREATE mode

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                  DASHBOARD (LIST VIEW)                      │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ├─ Create: setEditingEntry(null)
                    ├─ Edit: setEditingEntry(entry)
                    │
┌───────────────────▼─────────────────────────────────────────┐
│                  FORM DIALOG                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  FormEngine                                         │   │
│  │  - entry={editingEntry}                             │   │
│  │  - mode={edit|create}                               │   │
│  └──────────────┬──────────────────────────────────────┘   │
│                 │                                           │
│  ┌──────────────▼──────────────────────────────────────┐   │
│  │  DynamicEntryForm                                   │   │
│  │  - rehydrate: buildFormDataFromEntry(entry, schema) │   │
│  │  - formData = initialData                           │   │
│  │  - handleChange() → setFormData()                   │   │
│  │  - handleSubmit() → saveTimeEntry()                 │   │
│  └──────────────┬──────────────────────────────────────┘   │
└─────────────────┼──────────────────────────────────────────┘
                  │
┌─────────────────▼──────────────────────────────────────────┐
│  handleDynamicEntrySave()                                 │
│  - buildTimeEntryPayload(entryType, formData, schema)     │
│  - validateBeforeSave(payload)                            │
│  - freeze payload                                         │
│  - call saveEntry() callback                              │
└─────────────────┬──────────────────────────────────────────┘
                  │
┌─────────────────▼──────────────────────────────────────────┐
│  saveTimeEntry()                                          │
│  - if existingEntry?.id → UPDATE branch                   │
│  - else → CREATE branch                                   │
│  - POST/PUT payload                                       │
│  - validateRoundTripIntegrity()                           │
│  - return result with ID                                  │
└─────────────────┬──────────────────────────────────────────┘
                  │
┌─────────────────▼──────────────────────────────────────────┐
│  Refresh & Close                                          │
│  - onRefresh() → re-query TimeEntry list                  │
│  - setShowForm(false)                                     │
│  - setEditingEntry(null)                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Checklist: Is Edit Using Same Flow as Create?

- [x] Edit loads entry via rehydration (`buildFormDataFromEntry`)
- [x] Edit and create share same schema
- [x] Edit and create share same formData shape
- [x] Edit and create share same validation (`validateBeforeSave`)
- [x] Edit and create share same payload builder (`buildTimeEntryPayload`)
- [x] Edit branches on `existingEntry?.id` only at persistence layer
- [x] Edit payload is same as create payload (no special edit logic)
- [x] Edit updates same record, not creating new one
- [x] Job Coaching uses same handler for edit
- [x] Job Development uses same handler for edit
- [x] Old entries still open safely (backward compat)
- [x] Duration displays correctly on edit (via normalization)
- [x] Save refreshes list and shows updated values (via toast + onRefresh)
- [x] Round-trip integrity verified after save

---

## Backward Compatibility

Old entries may have:
- `data` field instead of `form_data` → rehydration checks both
- `legacy_category` instead of `entry_type_code` → display logic handles
- Missing `service_code_id` → defaults to null
- Duration in various formats → normalized to number
- Fields no longer in schema → ignored (correct behavior)

All handled by:
1. `buildFormDataFromEntry()` — safe defaults for missing fields
2. `buildTimeEntryPayload()` — only includes schema-defined fields
3. `getEntryTypeDisplay()` — falls back to legacy_category

---

## Testing

### Create Flow (unchanged)
1. Click "Add Entry"
2. Select entry type
3. Fill form
4. Click "Save Entry"
5. See toast "Entry created"
6. List refreshes with new row

### Edit Flow (now unified)
1. Click "Edit" on existing entry
2. Form opens with values pre-filled (rehydrated)
3. Edit one field
4. Click "Save Changes"
5. See toast "Entry updated"
6. List refreshes with updated values

### Edge Cases
- **Edit without changing**: Form shows current values, save succeeds silently
- **Edit then create another**: New form is empty (fresh initialData)
- **Old entry with legacy_category**: Edit form loads, new form_data structure on save
- **Stale modal**: If modal stays open, values sync when entry changes