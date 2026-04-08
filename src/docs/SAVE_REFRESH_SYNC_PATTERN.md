# 🔁 Save → Refresh → Close Pattern

## The Pattern (MANDATORY)

After ANY time entry save operation, **always refresh data before closing the modal**:

```javascript
const handleFormSave = async (payload) => {
  try {
    // 1️⃣ Save entry
    await saveTimeEntry({
      payload,
      existingEntry,
      clientId
    });

    // 2️⃣ Refresh data to sync UI with DB (CRITICAL)
    await onRefresh();

    // 3️⃣ Close modal and reset state
    setShowForm(false);
    setEditingEntry(null);
  } catch (err) {
    toast.error("Save failed");
  }
};
```

## Why This Matters

**Hidden Bug Risk:**
- Save succeeds in DB
- Modal closes
- UI still shows stale data
- User thinks entry is missing or broken
- Refresh page? Data is there.

**The Fix:**
The `onRefresh()` callback refetches from the API and syncs the parent component state, ensuring UI reflects the actual database state.

## Implementations

### TimeLogDashboard
- ✅ DONE - Uses `onRefresh()` callback after save

### DynamicEntryForm
- ⚠️ Component-level only - Parent must handle refresh
- The form calls `onSave()` callback
- Parent (`TimeLogDashboard`) handles refresh

### TimeTracking page
- ⚠️ Check that `queryClient.invalidateQueries()` is called after save

### Other Components Saving Time Entries
- Must follow the same pattern
- NO EXCEPTIONS

## Debugging the Pattern

If after save you see stale data:

1. Check console for:
   ```
   🟢 Saving Entry Payload: {...}
   ```

2. Verify `onRefresh()` was called:
   ```javascript
   await onRefresh(); // Must be awaited
   ```

3. Check React Query cache:
   ```javascript
   await queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
   ```

## Anti-Patterns (🚫 Do Not Do)

```javascript
// ❌ WRONG - Closes immediately, stale data
await saveTimeEntry(payload);
setShowForm(false);

// ❌ WRONG - Refresh not awaited
onRefresh(); // Fire and forget
setShowForm(false);

// ❌ WRONG - Manual delay
await saveTimeEntry(payload);
await new Promise(r => setTimeout(r, 500)); // Brittle
setShowForm(false);

// ❌ WRONG - No refresh at all
await saveTimeEntry(payload);
setShowForm(false);
```

## Testing the Pattern

```javascript
// Test: Save → Check DB → Check UI
test('saves and syncs data', async () => {
  // 1. Save entry
  await user.click(saveButton);
  
  // 2. Verify onRefresh was called
  expect(mockRefresh).toHaveBeenCalled();
  
  // 3. Verify modal closed
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  
  // 4. Verify entry appears in list
  expect(screen.getByText('Job Coaching')).toBeInTheDocument();
});
```

## When onRefresh Isn't Available

If the parent doesn't provide `onRefresh`, use React Query directly:

```javascript
const queryClient = useQueryClient();

const handleFormSave = async (payload) => {
  try {
    await saveTimeEntry(payload);
    
    // Manually invalidate cache
    await queryClient.invalidateQueries({ 
      queryKey: ['timeEntries', clientId] 
    });
    
    setShowForm(false);
  } catch (err) {
    toast.error("Save failed");
  }
};
``