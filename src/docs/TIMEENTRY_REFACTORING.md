# TimeEntry Refactoring: From Category to EntryType

Removes reliance on legacy `category` enum. `entry_type_id` and `entry_type_code` are now the source of truth for VR reporting.

## What Changed

### Before (Legacy)
```javascript
{
  client_id: "client_123",
  date: "2024-04-10",
  duration_minutes: 120,
  category: "job_coaching",  // ← Only way to identify service type
  description: "Interview prep"
}
```

**Problems:**
- Category enum was disconnected from EntryType definitions
- Filtering by category was ambiguous (job_search vs job_development?)
- No link between TimeEntry and actual EntryType configuration
- Report type determined by loose mapping logic

### After (Refactored)
```javascript
{
  client_id: "client_123",
  date: "2024-04-10",
  duration_minutes: 120,
  entry_type_id: "type_001",           // ← Reference to EntryType.id
  entry_type_code: "job_coaching",     // ← Denormalized for fast lookups
  description: "Interview prep"
  // category removed (or legacy only)
}
```

**Benefits:**
- True reference to EntryType definitions
- Filtering by `entry_type_code` is unambiguous
- Service type linked to organization's EntryType configuration
- Report generation uses `entry_type_code` directly

## TimeEntry Entity Changes

```json
{
  "required": ["duration_minutes", "entry_type_id", "entry_type_code"],
  "properties": {
    "entry_type_id": {
      "type": "string",
      "description": "Reference to EntryType.id (true source of truth)"
    },
    "entry_type_code": {
      "type": "string",
      "description": "Denormalized EntryType.code for fast lookups"
    },
    "category": {
      "type": "string",
      "enum": [...],
      "description": "Legacy field for backward compatibility only"
    }
  }
}
```

## Creating Time Entries (New Way)

### Using TimeEntryFactory

```javascript
import { createTimeEntry, validateTimeEntryData } from '@/lib/timeEntryFactory';

// Option 1: With entry_type_code
const result = await createTimeEntry(base44, {
  client_id: 'client_123',
  date: '2024-04-10',
  duration_minutes: 120,
  entry_type_code: 'job_coaching',  // Factory finds and validates EntryType
  description: 'Interview prep'
});

// Option 2: With entry_type_id
const result = await createTimeEntry(base44, {
  client_id: 'client_123',
  date: '2024-04-10',
  duration_minutes: 120,
  entry_type_id: 'type_001',  // Factory fetches code and validates
  description: 'Interview prep'
});

// Both options result in:
{
  success: true,
  entry: {
    id: 'entry_789',
    client_id: 'client_123',
    entry_type_id: 'type_001',      // Both filled in
    entry_type_code: 'job_coaching', // Both filled in
    duration_minutes: 120,
    // ... rest of fields
  }
}
```

### Form Component (TimeEntryFormRefactored)

```jsx
import TimeEntryFormRefactored from '@/components/time-entry/TimeEntryFormRefactored';

<TimeEntryFormRefactored
  clientId="client_123"
  onSuccess={(entry) => {
    console.log('Entry created:', entry);
    // entry.entry_type_id and entry.entry_type_code are both set
  }}
/>
```

**Key Features:**
- Dropdown loads active EntryType records (not hardcoded category enum)
- User selects EntryType by name/code
- System automatically saves both `entry_type_id` and `entry_type_code`
- Time calculation: start_time + end_time → duration_minutes

## Filtering and Querying

### Get entries by entry type

```javascript
// ✓ Good: Filter by entry_type_code
const entries = await base44.entities.TimeEntry.filter({
  client_id: 'client_123',
  entry_type_code: 'job_coaching'
});

// ✓ Also good: Filter by entry_type_id
const entries = await base44.entities.TimeEntry.filter({
  client_id: 'client_123',
  entry_type_id: 'type_001'
});

// ❌ Avoid: Legacy category filter
const entries = await base44.entities.TimeEntry.filter({
  category: 'job_coaching'  // Ambiguous, don't use
});
```

### Group entries by entry type

```javascript
// Using TimeEntryTransformer
const transformer = new TimeEntryTransformer(timeEntries, fieldAnswers, client);

// Groups by entry_type_code (not category)
const grouped = transformer.groupByEntryType();
// Result: { 'job_coaching': [...], 'cbh': [...], 'job_development': [...] }
```

### Report generation

```javascript
// Generate versioned report for specific entry type
const result = await base44.functions.invoke('generateVersionedReport', {
  action: 'generate',
  params: {
    client_id: 'client_123',
    report_type: 'job_coaching',  // Maps to entry_type_code
    entry_type_id: 'type_001',
    time_entry_ids: [
      'entry_001',
      'entry_002',
      'entry_003'
      // All must have entry_type_id='type_001' and entry_type_code='job_coaching'
    ]
  }
});
```

## Service Type Mapping

Entry type codes map to service types for authorization:

```javascript
// From authorizationValidation.js
function mapEntryTypeCodeToServiceType(entryTypeCode) {
  const mapping = {
    'job_development': 'job_development',
    'job_coaching': 'job_coaching',
    'life_skills': 'life_skills',
    'cbh': 'cbh',
    'pre_ets': 'pre_ets',
    'admin': null,  // No service type
    'other': null
  };
  return mapping[entryTypeCode] || 'job_development';
}
```

This replaces the old category-based mapping.

## Report Field Validation

Report fields now validated using entry_type_id/code:

```javascript
// Old way (don't use):
const reportType = mapCategoryToReportType(timeEntry.category);

// New way:
const reportType = mapEntryTypeCodeToReportType(timeEntry.entry_type_code);
```

Available report types:
- `job_development`
- `job_coaching`
- `life_skills`
- `cbh`
- `monthly_summary`
- `quarterly_summary`
- `other`

## Backward Compatibility

The `category` field remains in TimeEntry schema for backward compatibility:

```javascript
{
  entry_type_code: "job_coaching",  // Primary
  category: "job_coaching"           // Legacy, optional
}
```

**Do not:**
- Use `category` for new filtering or reporting
- Rely on category/entry_type_code matching
- Create TimeEntry without entry_type_id/code

**The legacy category field will be phased out in future releases.**

## Update TimeEntry (updateTimeEntry)

Use the factory function to safely update entries:

```javascript
import { updateTimeEntry } from '@/lib/timeEntryFactory';

const result = await updateTimeEntry(base44, 'entry_789', {
  duration_minutes: 90,
  description: 'Updated description'
});

// entry_type_id and entry_type_code preserved from original
// Legacy category not propagated
```

If changing entry type:

```javascript
const result = await updateTimeEntry(base44, 'entry_789', {
  entry_type_code: 'cbh'  // Change to CBH
  // Factory validates and updates both id and code
});
```

## Bulk Operations

Create multiple time entries safely:

```javascript
import { bulkCreateTimeEntries } from '@/lib/timeEntryFactory';

const results = await bulkCreateTimeEntries(base44, [
  {
    client_id: 'client_123',
    date: '2024-04-10',
    duration_minutes: 60,
    entry_type_code: 'job_coaching'
  },
  {
    client_id: 'client_123',
    date: '2024-04-11',
    duration_minutes: 120,
    entry_type_code: 'cbh'
  }
]);

// Results:
{
  success: [entry1, entry2],  // Created entries
  failed: []                   // Any validation errors
}
```

## Authorization Validation

Service authorization validation now uses entry_type_code:

```javascript
import { validateTimeEntryAgainstAuthorization } from '@/lib/authorizationValidation';

const validation = await validateTimeEntryAgainstAuthorization(base44, {
  client_id: 'client_123',
  date: '2024-04-10',
  duration_minutes: 120,
  entry_type_code: 'job_coaching'  // Used to find matching authorization
});

if (!validation.isValid) {
  console.error(validation.message);
}
```

## Report Versioning

ReportVersion snapshots include entry_type_ids:

```javascript
{
  id: 'rv_001',
  report_type: 'job_coaching',      // Matches entry_type_code
  entry_type_id: 'type_001',        // Reference to EntryType
  time_entry_ids: [
    'entry_001',
    'entry_002',
    'entry_003'
    // All with entry_type_code='job_coaching'
  ],
  time_entry_count: 3,
  total_hours: 5.5
}
```

## TimeEntry Transformer

Updated to group by entry_type_code:

```javascript
const transformer = new TimeEntryTransformer(timeEntries, fieldAnswers, client);
const data = transformer.transform();

// data.rows includes:
{
  row_number: 1,
  entry_type_id: 'type_001',        // Added
  entry_type_code: 'job_coaching',  // Source of truth
  duration_minutes: 120,
  date: '2024-04-10',
  // ... plus all report field answers
}

// data.summary aggregates by entry_type_code
{
  by_entry_type: {
    'job_coaching': { count: 5, total_hours: 10.5 },
    'cbh': { count: 3, total_hours: 4.5 }
  }
}
```

## PDF Field Mapping

Update PDFFieldMap to reference entry_type_code:

```javascript
// Instead of:
{
  source_field: "category",
  source_type: "report_answer"
}

// Use:
{
  source_field: "entry_type_code",
  source_type: "report_answer"
}
```

## Migration Checklist

If migrating existing TimeEntry records:

- [ ] Ensure all EntryType records are created and active
- [ ] For each TimeEntry without entry_type_id/code:
  - [ ] Find matching EntryType by name or category
  - [ ] Set entry_type_id = EntryType.id
  - [ ] Set entry_type_code = EntryType.code
- [ ] Update report field mappings to use entry_type_code
- [ ] Test report generation with new entry types
- [ ] Test authorization validation with entry_type_code
- [ ] Update any custom report queries to use entry_type_code

## API Reference

### TimeEntry Factory Functions

**createTimeEntry(base44, data)**
- Creates single TimeEntry with validated entry_type_id/code
- Returns: `{ success, entry } | { success, error }`

**validateTimeEntryData(base44, data)**
- Validates TimeEntry data without saving
- Returns: `{ valid, errors?, entryType }`

**getActiveEntryTypes(base44)**
- List all active EntryType records
- Returns: `EntryType[]`

**getEntryType(base44, idOrCode)**
- Get single EntryType by id or code
- Returns: `EntryType | null`

**bulkCreateTimeEntries(base44, dataArray)**
- Create multiple TimeEntry records
- Returns: `{ success: [], failed: [] }`

**updateTimeEntry(base44, timeEntryId, data)**
- Update TimeEntry while preserving entry_type
- Returns: `{ success, entry } | { success, errors }`

### Mapping Functions

**mapEntryTypeCodeToServiceType(entryTypeCode)**
- Maps entry_type_code → ServiceAuthorization.service_type
- Used in authorization validation

**mapEntryTypeCodeToReportType(entryTypeCode)**
- Maps entry_type_code → ReportVersion.report_type
- Used in report generation

## Best Practices

1. **Always use factory functions** to create/update TimeEntry
   - Ensures consistency
   - Validates against EntryType definitions
   - Prevents orphaned entries

2. **Filter by entry_type_code or entry_type_id**
   - Never filter by category
   - Be specific in queries

3. **Include both id and code when creating records**
   - Factory handles this automatically
   - Never manually set just one

4. **Validate against active EntryTypes**
   - Check is_active before creating
   - Factory does this automatically

5. **Group reports by entry_type_code**
   - TimeEntryTransformer does this
   - Matches ReportVersion.report_type

## Troubleshooting

### "EntryType not found"

**Cause:** TimeEntry references non-existent EntryType

**Solution:**
1. Verify EntryType exists: `await getEntryType(base44, 'job_coaching')`
2. Check is_active: `entryType.is_active === true`
3. Create missing EntryType if needed

### "Ambiguous service type"

**Cause:** Using category instead of entry_type_code

**Solution:**
- Replace all `timeEntry.category` with `timeEntry.entry_type_code`
- Use `mapEntryTypeCodeToServiceType()` instead of category mapping

### Report type mismatch

**Cause:** TimeEntry.entry_type_code doesn't match ReportVersion.report_type

**Solution:**
- Ensure entry_type_code maps to report_type via `mapEntryTypeCodeToReportType()`
- Create ReportVersion with matching entry_type_id

## See Also

- `entities/TimeEntry.json` - Entity schema
- `entities/EntryType.json` - Entry type definitions
- `lib/timeEntryFactory.js` - Creation/update utilities
- `lib/timeEntryTransformer.js` - Report data transformation
- `components/time-entry/TimeEntryFormRefactored.jsx` - UI component