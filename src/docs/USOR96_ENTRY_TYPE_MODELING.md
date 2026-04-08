# USOR96 Entry Type Modeling

## CRITICAL: USOR96 is NOT a Separate Entry Type

**USOR96 reporting is modeled under the `job_development` entry type**, not as a separate `usor96` entry type.

This design ensures:
- Single source of truth for job development activities
- Consistent field schema across the system
- Simplified entry type management
- No duplicate or conflicting entry types

## Entry Type Configuration

### job_development
- **Code**: `job_development`
- **Report Mode**: `usor96_monthly`
- **PDF Template**: USOR96 form
- **Row-Level Fields** (pdf_context: 'row'):
  - `development_date` - Date of activity
  - `development_hours` - Hours spent
  - `development_activity` - Activity description
  - `activity_outcome` - Outcome/result
  - `next_steps` - Next steps

## Data Flow for USOR96 Reporting

1. **Entry Creation**: Staff logs time via `StructuredVocRehabForm` with `entryTypeCode="job_development"`
2. **Field Capture**: Form collects answers to structured questions based on `ReportFieldTemplate` records filtered by:
   - `entry_type_code="job_development"`
   - `is_active=true`
   - `is_internal_only=false`
   - `pdf_context='row'` (row-level only)
3. **Dual Write**: `submitTimeEntryWithDualWrite()` creates:
   - `TimeEntry` record (with `entry_type_code="job_development"`)
   - `ReportFieldAnswer` record (with immutable schema snapshot)
4. **Report Generation**: `GeneratedReport` queries TimeEntry records where `entry_type_code="job_development"` and uses the USOR96 template

## Why This Approach?

- **Single Entry Type**: Avoids confusing developers who might create a separate `usor96` entry type
- **Clear Semantics**: The entry type reflects the actual service (job development), not the report form it uses
- **Flexibility**: Any entry type can use any report template via `report_mode`
- **Consistency**: The field schema is stable and authoritative

## Preventing Future Mistakes

### DO NOT:
- Create an `EntryType` record with `code="usor96"`
- Add a separate entry in `INTENDED_FIELDS` for `usor96`
- Route USOR96 submissions to a different entry type

### DO:
- Route all USOR96 activities through `job_development`
- Update `job_development` fields if USOR96 requirements change
- Refer to this document when adding new VR entry types

## Field Update Workflow

If USOR96 field requirements change:

1. Update `ReportFieldTemplate` records with `entry_type_code="job_development"` and `pdf_context='row'`
2. The validator (`validateEntryTypeFields.js`) will audit against `INTENDED_FIELDS.job_development`
3. All existing forms automatically load the new fields on next render
4. No code changes needed to forms or routing logic