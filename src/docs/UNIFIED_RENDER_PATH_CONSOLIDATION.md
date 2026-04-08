# 🧹 Unified Render Path Consolidation

## The Problem (Fixed)

We had **three legacy render paths**:

```javascript
// ❌ OLD PATH 1: TimeEntryForm (step-by-step wizard)
if (showTimeEntryForm) return <TimeEntryForm {...} />;

// ❌ OLD PATH 2: QuickTimeLog (quick submit + branch logic)
if (showQuickLog && entryType === "simple") return <QuickSave />;
if (showQuickLog && entryType === "structured") return <GoToFullForm />;

// ❌ OLD PATH 3: JobCoachingLauncher (special case)
if (entryType === "job_coaching") return <JobCoachingTimeEntryForm />;
```

Each had **duplicate validation, save logic, and state management**.

## The Solution (NEW)

**ONE render path:**

```javascript
// ✅ NEW: Unified FormEngine
<FormEngine
  entryTypeCode={selectedEntryTypeCode}
  entry={editingEntry}
  mode="create|edit"
  onSave={async (payload) => {
    // 1️⃣ Save
    await saveTimeEntry({ payload, existingEntry, clientId });
    
    // 2️⃣ Refresh (critical - prevents stale UI)
    await onRefresh();
    
    // 3️⃣ Close
    closeModal();
  }}
  onCancel={() => closeModal()}
/>
```

## Affected Files

### ELIMINATED
- ❌ `components/time-entry/TimeEntryForm` → DEPRECATED (kept for compatibility)
- ❌ `components/dashboard/QuickTimeLog` → DEPRECATED (kept for compatibility)
- ❌ `components/time-entry/JobCoachingLauncher` → Removed from TimeTracking page
- ❌ All conditional branching (`if (entryType === "job_coaching")`, etc.)
- ❌ Duplicate form builders, save handlers, validation logic

### CONSOLIDATED INTO
- ✅ `components/time-entry/FormEngine` - Single render path
- ✅ `lib/saveTimeEntry` - Single save path
- ✅ `lib/timeEntryPayloadBuilder` - Single payload contract

### UPDATED
- ✅ `pages/TimeTracking` - Uses only FormEngine
- ✅ `components/client-detail/TimeLogDashboard` - Uses only FormEngine

## Why This Matters

### Before (Fragmented)
- **3 different form renderers**
  - Each had own validation
  - Each had own save logic
  - Each had own state management
  - Easy to create divergent behavior

- **2 different save paths**
  - `TimeEntryForm` → custom create logic
  - `QuickTimeLog` → `submitTimeEntryWithDualWrite`
  - `JobCoachingTimeEntryForm` → specialized form
  - Payload contracts were different
  - Data could diverge

### After (Unified)
- **1 FormEngine renderer**
  - Same validation for all types
  - Same schema-based rendering
  - No special cases

- **1 save path**
  - `saveTimeEntry()` for all
  - Uses `buildTimeEntryPayload()` for all
  - Deterministic payload contract
  - Data stays consistent

## The Consolidated Save Flow

```javascript
const handleFormSave = async (payload) => {
  try {
    // 1️⃣ Save via unified path
    await saveTimeEntry({
      payload,
      existingEntry,
      clientId
    });

    // 2️⃣ Refresh data to sync UI with DB (CRITICAL!)
    await onRefresh();

    // 3️⃣ Close modal and reset state
    setShowForm(false);
    setEditingEntry(null);
  } catch (err) {
    toast.error(err?.message || "Save failed");
  }
};
```

## No More Branching

| Scenario | Before | After |
|----------|--------|-------|
| Simple entry (admin_time) | QuickTimeLog path | FormEngine + saveTimeEntry |
| Structured entry (job_coaching) | JobCoachingLauncher | FormEngine + saveTimeEntry |
| VR entry (usor96) | TimeEntryForm path | FormEngine + saveTimeEntry |
| Edit existing | TimeTracking inline | FormEngine + saveTimeEntry |

## Pattern Enforcement

### ✅ CORRECT
```javascript
<FormEngine
  entryTypeCode={code}
  onSave={async (payload) => {
    await saveTimeEntry({ payload, existingEntry, clientId });
    await onRefresh();
    closeModal();
  }}
/>
```

### ❌ WRONG
```javascript
// Don't create new render paths
if (isJobCoaching) return <JobCoachingForm />;
if (isVR) return <VRForm />;

// Don't create new save functions
submitQuick() { ... }
submitStructured() { ... }

// Don't skip refresh
await saveTimeEntry(...);
closeModal(); // ❌ Missing refresh!
```

## Testing Impact

Before: Had to test 3 separate form renderers + 2 save paths
After: Test 1 FormEngine + 1 saveTimeEntry function

All entry types go through same code path → same bugs, same fixes, no surprises.

## Migration Notes

### If you find code using old components:
```javascript
// ❌ Old
import TimeEntryForm from "@/components/time-entry/TimeEntryForm";
import QuickTimeLog from "@/components/dashboard/QuickTimeLog";
import JobCoachingLauncher from "@/components/time-entry/JobCoachingLauncher";

// ✅ New
import FormEngine from "@/components/time-entry/FormEngine";
import { saveTimeEntry } from "@/lib/saveTimeEntry";
```

### Deprecation Status
- `TimeEntryForm` - Returns null (deprecated)
- `QuickTimeLog` - Returns null (deprecated)
- `JobCoachingLauncher` - Removed from TimeTracking page

Old files kept in codebase for backward compatibility only. Do not add new code that uses them.