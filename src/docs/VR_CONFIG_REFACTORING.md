# VR Form Configuration Refactoring

## Overview

The VR form configuration has been refactored to treat the **database as the source of truth** rather than the static config files. This provides:

- **Flexibility**: Update forms without code deployment
- **Scalability**: Support multiple entry types and custom fields per organization
- **Auditability**: Track configuration changes and migrations
- **Fallback safety**: Graceful degradation if database is unavailable

## Architecture

### Three-Tier Approach

```
┌─────────────────────────────────────────────────────────────┐
│ 1. DATABASE (Source of Truth)                               │
│    - EntryType entities                                     │
│    - ReportFieldTemplate entities                           │
│    - Dynamically updatable                                  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. VR Config Resolver (lib/vrConfigResolver.js)             │
│    - Queries database first                                 │
│    - Caches for performance (5min TTL)                      │
│    - Falls back to seed config if DB unavailable            │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Seed Config (lib/vrFormConfig.js)                        │
│    - Static reference data                                  │
│    - Dev fallback                                           │
│    - Migration source                                       │
└─────────────────────────────────────────────────────────────┘
```

### File Roles

| File | Role | Mutable |
|------|------|---------|
| `lib/vrFormConfig.js` | Seed data source, dev reference, fallback config | No |
| `lib/vrFieldConfig.js` | Legacy field helpers (deprecated) | No |
| `lib/vrConfigResolver.js` | Database-first query layer with fallback | No |
| `functions/seedVRConfig.js` | Migration utility: seed → database | N/A |
| Database: `EntryType` | Production source of truth | Yes |
| Database: `ReportFieldTemplate` | Production source of truth | Yes |

## Migration

### Step 1: Preview Migration

Check what will be created from seed data:

```javascript
const res = await base44.functions.invoke('seedVRConfig', {
  action: 'preview'
});

// Returns: { entry_types_to_create: [...], templates_to_create: [...] }
```

### Step 2: Execute Migration

Create database records from seed config:

```javascript
const res = await base44.functions.invoke('seedVRConfig', {
  action: 'execute'
});

// Returns: { success: true, results: { ... } }
// - Creates EntryType records
// - Creates ReportFieldTemplate records
// - Tracks _migrated_from and _migrated_at for audit trail
// - Skips existing records (safe to re-run)
```

### Step 3: Use Config Resolver

Replace direct imports with the resolver:

```javascript
// OLD (static)
import { VR_ENTRY_TYPES } from '@/lib/vrFormConfig';
const fields = VR_ENTRY_TYPES.job_coaching.fields;

// NEW (database-first, with fallback)
import { getFieldTemplatesForEntryType } from '@/lib/vrConfigResolver';
const fields = await getFieldTemplatesForEntryType('job_coaching');
```

## Usage Examples

### Get Entry Types

```javascript
import { getAllEntryTypes, getEntryType } from '@/lib/vrConfigResolver';

// Get all types
const types = await getAllEntryTypes();

// Get one type
const jobCoaching = await getEntryType('job_coaching');
```

### Get Field Templates

```javascript
import {
  getFieldTemplatesForEntryType,
  getFieldsBySection,
  getRequiredFields,
  getReportableFields
} from '@/lib/vrConfigResolver';

// All fields (sorted by order)
const fields = await getFieldTemplatesForEntryType('job_coaching');

// Grouped by section
const bySection = await getFieldsBySection('job_coaching');

// Only required fields
const required = await getRequiredFields('job_coaching');

// Only reportable fields (appear on PDF)
const reportable = await getReportableFields('job_coaching');
```

### Validate Answers

```javascript
import { validateFieldAnswers } from '@/lib/vrConfigResolver';

const answers = { jc_date: '2024-01-15', jc_hours: 4, jc_job_coach_name: 'John' };
const validation = await validateFieldAnswers('job_coaching', answers);

// Returns:
// {
//   isValid: false,
//   missing: [{ key: 'jc_primary_service_code', label: 'Primary Service Code' }],
//   completed: 3,
//   total: 4
// }
```

## Database Schema

### EntryType Entity

```json
{
  "id": "...",
  "org_id": "...",
  "name": "Job Coaching",
  "code": "job_coaching",
  "description": "On-site job coaching and support (USOR95)",
  "program_type": "vr",
  "color": "#8B5CF6",
  "is_active": true,
  "requires_client": true,
  "is_billable": false,
  "is_payroll_eligible": true,
  "max_hours_per_period": null,
  "requires_field_answers": true,
  "_migrated_from": "vrFormConfig.VR_ENTRY_TYPES",
  "_migrated_at": "2024-01-15T10:00:00Z",
  "_migrated_by": "admin@example.com"
}
```

### ReportFieldTemplate Entity

```json
{
  "id": "...",
  "org_id": "...",
  "entry_type_id": "...",
  "entry_type_code": "job_coaching",
  "field_key": "jc_primary_service_code",
  "label": "Primary Service Code",
  "field_type": "select",
  "section": "Service Codes",
  "order": 5,
  "is_required": true,
  "is_reportable": true,
  "is_internal_only": false,
  "pdf_context": "repeating_row",
  "options": ["1", "2", "3", ...],
  "placeholder": null,
  "help_text": null,
  "schema_version": 1,
  "is_active": true,
  "_migrated_from": "vrFormConfig.VR_ENTRY_TYPES",
  "_migrated_at": "2024-01-15T10:00:00Z",
  "_migrated_by": "admin@example.com"
}
```

## Key Fields Preserved

The migration preserves all important field metadata:

- `field_type` (text, date, number, select, textarea, etc.)
- `is_required` - If field is mandatory
- `is_reportable` - If field appears on PDF
- `is_internal_only` - If field is staff-only
- `pdf_context` - Where field appears (repeating_row, header_field, summary_field, none)
- `section` - UI grouping
- `order` - Display order
- `options` - For select fields

## Caching

The `vrConfigResolver` implements 5-minute caching for performance:

```javascript
// First call: queries database
const fields = await getFieldTemplatesForEntryType('job_coaching'); // DB call

// Subsequent calls within 5 minutes: uses cache
const fields2 = await getFieldTemplatesForEntryType('job_coaching'); // Cache hit

// After seed/update: invalidate cache
import { invalidateCache } from '@/lib/vrConfigResolver';
invalidateCache();
```

## Fallback Behavior

If the database is unavailable, the resolver automatically falls back to seed config:

```javascript
// If EntryType.list() fails, uses DEFAULT_ENTRY_TYPES
const types = await getAllEntryTypes();
// → Returns fallback data, continues operation
```

## Legacy Config Files

### `lib/vrFormConfig.js`

**Still used for:**
- Reference during development
- Seed data source for migration
- Fallback data if database unavailable

**NOT used for:**
- Runtime field validation (use resolver instead)
- Form rendering (use resolver instead)
- Authorization checks (use resolver instead)

### `lib/vrFieldConfig.js`

**Deprecated.** The helper functions have been moved to `vrConfigResolver.js`:

| Old Function | New Location |
|---|---|
| `getFieldsForEntryType()` | Use `getFieldTemplatesForEntryType()` |
| `getRequiredFieldsForEntryType()` | Use `getRequiredFields()` |
| `getAllFieldsForEntryType()` | Use `getFieldTemplatesSorted()` |
| `validateRequiredFields()` | Use `validateFieldAnswers()` |
| `getFieldByKey()` | Use `getFieldTemplate()` |
| `getFieldsBySection()` | Use `getFieldsBySection()` (same) |

## Updating Forms in Production

Once the database is seeded, you can update forms directly:

1. **Edit an EntryType:**
   ```javascript
   await base44.entities.EntryType.update('entry_type_id', {
     name: "New Name",
     description: "Updated description"
   });
   ```

2. **Edit a ReportFieldTemplate:**
   ```javascript
   await base44.entities.ReportFieldTemplate.update('template_id', {
     label: "New Label",
     is_required: true,
     options: ["Option A", "Option B"]
   });
   invalidateCache(); // Refresh cache
   ```

3. **Add a new field:**
   ```javascript
   await base44.entities.ReportFieldTemplate.create({
     entry_type_code: 'job_coaching',
     field_key: 'new_field',
     label: "New Field",
     field_type: "text",
     section: "Details",
     order: 99,
     is_required: false
   });
   invalidateCache();
   ```

4. **Deactivate a field (soft-delete):**
   ```javascript
   await base44.entities.ReportFieldTemplate.update('template_id', {
     is_active: false
   });
   invalidateCache();
   ```

## Reset (Emergency Only)

To clear migrated records and restore seed config fallback:

```javascript
const res = await base44.functions.invoke('seedVRConfig', {
  action: 'reset',
  confirmed_reset: true
});
```

⚠️ **WARNING**: This deletes all auto-migrated records. Manually created records are preserved (they lack `_migrated_from`).

## Troubleshooting

### Issue: Forms still loading from old config

**Solution**: Ensure you're using the resolver:
```javascript
// Wrong
import { VR_ENTRY_TYPES } from '@/lib/vrFormConfig';

// Right
import { getFieldTemplatesForEntryType } from '@/lib/vrConfigResolver';
```

### Issue: Changes not reflecting

**Solution**: Invalidate cache after updates:
```javascript
import { invalidateCache } from '@/lib/vrConfigResolver';
invalidateCache();

// Then reload
const fields = await getFieldTemplatesForEntryType('job_coaching');
```

### Issue: Database empty, need fallback

The resolver automatically falls back if database is unavailable. No action needed.

### Issue: Need to re-migrate

Run preview first to see what's changed:
```javascript
const preview = await base44.functions.invoke('seedVRConfig', { action: 'preview' });
// Review results, then:
const result = await base44.functions.invoke('seedVRConfig', { action: 'execute' });
``