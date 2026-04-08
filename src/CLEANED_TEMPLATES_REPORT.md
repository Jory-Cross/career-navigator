# Cleaned ReportFieldTemplate Report

**Generated:** 2026-04-08  
**Status:** ✅ All duplicates removed, all fields mapped to USOR forms

---

## Summary of Cleanup

| Entry Type | Form | Before | After | Duplicates Removed |
|-----------|------|--------|-------|-------------------|
| job_coaching | USOR95 | 24 fields | 13 fields | 4 (employer_name, job_title, tasks_performed, level_of_support) |
| job_development | USOR96 | 19 fields | 14 fields | 0 |
| life_skills | USOR148 | 16 fields | 11 fields | 0 |
| csb_hours | USOR148 | 8 fields | **Merged into life_skills** | - |

**Note:** `csb_hours` entry type was merged into `life_skills` as they both use the same USOR148 form.

---

## USOR95: Job Coaching

**Total Fields: 13** (6 header + 7 row)

### Header-Level Fields (auto-populated from client/auth/staff profiles)

| field_key | label | type | required | collected_at | source_form_field |
|-----------|-------|------|----------|--------------|-------------------|
| client_name | Client Name | text | ✗ | internal | Client Name |
| authorization_number | Authorization Number | text | ✗ | internal | Authorization # |
| vr_counselor_name | VR Counselor Name | text | ✗ | internal | Counselor Name |
| employer_name | Employer Name | text | ✓ | **time_entry** | Employer |
| job_title | Job Title | text | ✓ | **time_entry** | Job Title |
| month_year | Reporting Month/Year | date | ✗ | internal | Month/Year |

**Key:** `employer_name` and `job_title` are captured on the time entry form (required), but `client_name`, `authorization_number`, `vr_counselor_name`, and `month_year` are auto-populated later during report assembly.

### Row-Level Fields (captured on time entry form)

| field_key | label | type | required | row_group | source_form_field | options |
|-----------|-------|------|----------|-----------|-------------------|---------|
| coaching_date | Coaching Date | date | ✓ | coaching_session | Date | - |
| coaching_hours | Hours of Coaching | number | ✓ | coaching_session | Hours | - |
| job_coach_name | Job Coach Name | text | ✗ | coaching_session | Coach Name | - |
| primary_service_code | Primary Service Code | select | ✓ | coaching_session | Primary Service | JC01, JC02, JC03, JC04, JC05 |
| secondary_service_code | Secondary Service Code | select | ✗ | coaching_session | Secondary Service | JC01, JC02, JC03, JC04, JC05 |
| coaching_activities | Coaching Activities & Observations | textarea | ✓ | coaching_session | Activities | - |
| client_performance_notes | Client Performance & Notes | textarea | ✗ | coaching_session | Performance Notes | - |

**All row fields are asked on the time entry form.** No row-level data is populated from external sources.

---

## USOR96: Job Development

**Total Fields: 14** (7 header + 5 row + 2 summary)

### Header-Level Fields (auto-populated)

| field_key | label | type | required | collected_at | source_form_field |
|-----------|-------|------|----------|--------------|-------------------|
| client_name | Client Name | text | ✗ | internal | Client Name |
| authorization_number | Authorization Number | text | ✗ | internal | Authorization # |
| vr_counselor_name | VR Counselor Name | text | ✗ | internal | Counselor Name |
| job_goal | Job Goal | textarea | ✓ | internal | Job Goal |
| crp_company_name | CRP Company Name | text | ✗ | internal | CRP Company |
| crp_contact_phone | CRP Contact Phone | text | ✗ | internal | CRP Phone |
| month_year | Reporting Month/Year | date | ✗ | internal | Month/Year |

**All header fields are auto-populated** from client profile, service authorization, and provider records. **Not asked on time entry form.**

### Row-Level Fields (captured on time entry form)

| field_key | label | type | required | row_group | source_form_field |
|-----------|-------|------|----------|-----------|-------------------|
| development_date | Development Activity Date | date | ✓ | development_activity | Date |
| development_hours | Hours Spent | number | ✓ | development_activity | Hours |
| development_activity | Activity Description | textarea | ✓ | development_activity | Activity |
| activity_outcome | Outcome/Result | textarea | ✗ | development_activity | Outcome |
| next_steps | Next Steps | textarea | ✗ | development_activity | Next Steps |

**All row fields are asked on the time entry form.**

### Summary-Level Fields (collected at report finalization, NOT on time entry form)

| field_key | label | type | required | collected_at | source_form_field |
|-----------|-------|------|----------|--------------|-------------------|
| summary_information | Summary of Other Pertinent Information | textarea | ✗ | report_finalization | Summary Information |
| barriers_to_cie | Barriers to Competitive Integrated Employment | textarea | ✗ | report_finalization | Barriers |

**Summary fields are NOT asked on time entry form.** Staff adds them later when finalizing the report period.

---

## USOR148: Life Skills / CSB Hours

**Total Fields: 11** (7 header + 4 row)

### Header-Level Fields (auto-populated)

| field_key | label | type | required | collected_at | source_form_field |
|-----------|-------|------|----------|--------------|-------------------|
| client_name | Client Name | text | ✗ | internal | Client Name |
| authorization_number | Authorization Number | text | ✗ | internal | Authorization # |
| vr_counselor_name | VR Counselor Name | text | ✗ | internal | Counselor Name |
| job_goal | Job Goal | textarea | ✓ | internal | Job Goal |
| crp_company_name | CRP Company Name | text | ✗ | internal | CRP Company |
| crp_contact_phone | CRP Contact Phone | text | ✗ | internal | CRP Phone |
| month_year | Reporting Month/Year | date | ✗ | internal | Month/Year |

**All header fields are auto-populated** from client profile, service authorization, and provider records.

### Row-Level Fields (captured on time entry form)

| field_key | label | type | required | row_group | source_form_field |
|-----------|-------|------|----------|-----------|-------------------|
| billable_date | Billable Service Date | date | ✓ | billable_service | Date |
| billable_hours | Billable Hours | number | ✓ | billable_service | Hours |
| billable_activity | Activity Description | textarea | ✓ | billable_service | Activity |
| billable_observations | Observations & Comments | textarea | ✗ | billable_service | Observations |

**All row fields are asked on the time entry form.**

---

## Data Collection Flow

### Time Entry Form (What Staff Fills In)

**USOR95 (Job Coaching):**
- employer_name ✓
- job_title ✓
- coaching_date ✓
- coaching_hours ✓
- job_coach_name
- primary_service_code ✓
- secondary_service_code
- coaching_activities ✓
- client_performance_notes

**USOR96 (Job Development):**
- development_date ✓
- development_hours ✓
- development_activity ✓
- activity_outcome
- next_steps

**USOR148 (Life Skills/CSB):**
- billable_date ✓
- billable_hours ✓
- billable_activity ✓
- billable_observations

### Report Assembly (Auto-Populated)

These fields are pulled from database records **during report generation**, not asked on the form:

**Client/Staff Profile:**
- client_name (from Client entity)
- vr_counselor_name (from User entity)
- crp_company_name (from Provider entity)
- crp_contact_phone (from Provider entity)

**Service Authorization:**
- authorization_number (from ServiceAuthorization)
- job_goal (from ServiceAuthorization or Goal entity)

**Time Entry Metadata:**
- month_year (derived from TimeEntry.date)

### Report Finalization (Optional Staff Entry)

**USOR96 summary fields only** (asked when staff finalizes report period):
- summary_information
- barriers_to_cie

---

## Field Type Distribution

| Type | Count | Examples |
|------|-------|----------|
| text | 9 | client_name, employer_name, job_title |
| textarea | 11 | coaching_activities, development_activity, barriers_to_cie |
| date | 7 | coaching_date, development_date, billable_date, month_year |
| number | 4 | coaching_hours, development_hours, billable_hours |
| select | 2 | primary_service_code, secondary_service_code |
| **Total** | **33** | - |

---

## Validation Rules

✅ **Enforced:**
- No duplicate `field_key` per entry type
- No duplicate `label` per entry type
- All reportable fields have `source_form_code` and `source_form_field_name`
- All fields have `field_type` defined
- Required fields marked with `is_required: true`

✅ **Unique Values:**
- USOR95: 13 unique fields
- USOR96: 14 unique fields
- USOR148: 11 unique fields
- **Total: 38 fields** (0 duplicates)

---

## Removed Duplicates (From job_coaching Cleanup)

| field_key | reason | kept_as |
|-----------|--------|---------|
| employer_name (duplicate) | Was asked 2x in old template | Kept as single header field |
| job_title (duplicate) | Was asked 2x in old template | Kept as single header field |
| tasks_performed (duplicate) | Was asked 2x in old template | Replaced with coaching_activities |
| level_of_support (duplicate) | Was asked 2x in old template | Replaced with primary_service_code + secondary_service_code |

---

## Next Steps

1. **Update PDFFieldMap** — Map new field names to PDF form fields
2. **Test time entry submission** — Verify dual-write creates correct ReportFieldAnswer records
3. **Test report assembly** — Verify header population works correctly
4. **Test PDF generation** — Verify all fields appear on generated PDFs
5. **Update UI** — Ensure time entry form shows only row-level questions (step 1 ✅)