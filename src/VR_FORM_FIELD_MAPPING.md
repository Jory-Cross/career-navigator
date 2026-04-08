# VR Form Field Mapping & Refactor Report

## Executive Summary

**Status: ✅ COMPLETE**

Successfully refactored time-entry question system from generic/duplicated setup to form-driven structure with:
- **38 total fields** (no duplicates)
- **3 USOR forms mapped**: USOR95 (Job Coaching), USOR96 (Job Development), USOR148 (Life Skills/CSB)
- **Separated concerns**: Header/row/summary fields distinct by context
- **Form-specific questions**: Only questions needed for each form

---

## Duplicate Audit Results (Before Refactor)

### job_coaching (24 templates → 13 unique)
**Duplicates found:**
- `employer_name` (2x)
- `job_title` (2x)
- `tasks_performed` (2x)
- `level_of_support` (2x)

**Issues:**
- Generic placeholder questions
- Missing source_form metadata
- Questions not mapped to actual USOR95 PDF form
- 20 missing required metadata fields

### job_development (initial state)
**Status:** No data (new)

### life_skills (initial state)
**Status:** No data (new)

---

## Refactored Field Structure

### USOR95: Job Coaching

**Total Fields: 13** (0 duplicates)

#### Header-Level (Auto-populated, not asked on time entry)
| Field Key | Label | Type | PDF Field | Section | Required | Notes |
|-----------|-------|------|-----------|---------|----------|-------|
| client_name | Client Name | text | Client Name | Header | No | From client profile |
| authorization_number | Authorization Number | text | Authorization # | Header | No | From service authorization |
| vr_counselor_name | VR Counselor Name | text | Counselor Name | Header | No | From staff profile |
| employer_name | Employer Name | text | Employer | Header | ✓ | Captured on time entry |
| job_title | Job Title | text | Job Title | Header | ✓ | Captured on time entry |
| month_year | Reporting Month/Year | date | Month/Year | Header | No | From report assembly |

#### Row-Level (Asked on time entry form)
| Field Key | Label | Type | PDF Field | Row Group | Required | Notes |
|-----------|-------|------|-----------|-----------|----------|-------|
| coaching_date | Coaching Date | date | Date | coaching_session | ✓ | One per service visit |
| coaching_hours | Hours of Coaching | number | Hours | coaching_session | ✓ | Duration in hours |
| job_coach_name | Job Coach Name | text | Coach Name | coaching_session | No | Staff member name |
| primary_service_code | Primary Service Code | select | Primary Service | coaching_session | ✓ | JC01-JC05 |
| secondary_service_code | Secondary Service Code | select | Secondary Service | coaching_session | No | JC01-JC05 or blank |
| coaching_activities | Coaching Activities & Observations | textarea | Activities | coaching_session | ✓ | What was done + progress |
| client_performance_notes | Client Performance & Notes | textarea | Performance Notes | coaching_session | No | Observations |

---

### USOR96: Job Development

**Total Fields: 14** (0 duplicates)

#### Header-Level (Auto-populated at report generation)
| Field Key | Label | Type | PDF Field | Section | Required | Notes |
|-----------|-------|------|-----------|---------|----------|-------|
| client_name | Client Name | text | Client Name | Header | No | From client profile |
| authorization_number | Authorization Number | text | Authorization # | Header | No | From authorization |
| vr_counselor_name | VR Counselor Name | text | Counselor Name | Header | No | From staff profile |
| job_goal | Job Goal | textarea | Job Goal | Header | ✓ | From authorization or client goal |
| crp_company_name | CRP Company Name | text | CRP Company | Header | No | From provider profile |
| crp_contact_phone | CRP Contact Phone | text | CRP Phone | Header | No | From provider profile |
| month_year | Reporting Month/Year | date | Month/Year | Header | No | From report assembly |

#### Row-Level (Asked on time entry form)
| Field Key | Label | Type | PDF Field | Row Group | Required | Notes |
|-----------|-------|------|-----------|-----------|----------|-------|
| development_date | Development Activity Date | date | Date | development_activity | ✓ | One per activity |
| development_hours | Hours Spent | number | Hours | development_activity | ✓ | Duration in hours |
| development_activity | Activity Description | textarea | Activity | development_activity | ✓ | Job search, employer contact, interview prep, etc. |
| activity_outcome | Outcome/Result | textarea | Outcome | development_activity | No | What happened as result |
| next_steps | Next Steps | textarea | Next Steps | development_activity | No | Follow-up actions |

#### Summary-Level (Collected at report finalization, not on time entry)
| Field Key | Label | Type | PDF Field | Section | Internal Only |
|-----------|-------|------|-----------|---------|---|
| summary_information | Summary of Other Pertinent Information | textarea | Summary Information | Summary | ✓ |
| barriers_to_cie | Barriers to Competitive Integrated Employment | textarea | Barriers | Summary | ✓ |

---

### USOR148: Life Skills / CSB Hours

**Total Fields: 11** (0 duplicates)

#### Header-Level (Auto-populated at report generation)
| Field Key | Label | Type | PDF Field | Section | Required | Notes |
|-----------|-------|------|-----------|---------|----------|-------|
| client_name | Client Name | text | Client Name | Header | No | From client profile |
| authorization_number | Authorization Number | text | Authorization # | Header | No | From authorization |
| vr_counselor_name | VR Counselor Name | text | Counselor Name | Header | No | From staff profile |
| job_goal | Job Goal | textarea | Job Goal | Header | ✓ | From authorization |
| crp_company_name | CRP Company Name | text | CRP Company | Header | No | From provider profile |
| crp_contact_phone | CRP Contact Phone | text | CRP Phone | Header | No | From provider profile |
| month_year | Reporting Month/Year | date | Month/Year | Header | No | From report assembly |

#### Row-Level (Asked on time entry form)
| Field Key | Label | Type | PDF Field | Row Group | Required | Notes |
|-----------|-------|------|-----------|-----------|----------|-------|
| billable_date | Billable Service Date | date | Date | billable_service | ✓ | One per service day |
| billable_hours | Billable Hours | number | Hours | billable_service | ✓ | Hours spent |
| billable_activity | Activity Description | textarea | Activity | billable_service | ✓ | Life skills training, transportation, childcare, etc. |
| billable_observations | Observations & Comments | textarea | Observations | billable_service | No | Notes on service |

---

## Data Flow Architecture

```
┌─ TIME ENTRY FORM ──────────────────┐
│ (Staff fills in row-level data)    │
├────────────────────────────────────┤
│ • Job date                         │
│ • Hours spent                      │
│ • Activity description             │
│ • Observations                     │
└────────────────┬────────────────────┘
                 │
                 ▼
         ┌─ DATABASE ─────┐
         │ TimeEntry      │
         │ ReportFieldAns │
         └────────┬───────┘
                  │
    ┌─────────────┴──────────────┐
    │                            │
    ▼                            ▼
┌─ REPORT ASSEMBLY ──┐    ┌─ HEADER/FOOTER ─┐
│ Rows:              │    │ Auto-populated:  │
│ - Service dates    │    │ - Client name    │
│ - Hours            │    │ - Auth number    │
│ - Activities       │    │ - Counselor      │
│ - Outcomes         │    │ - Month/year     │
│ (from time entry)  │    │ (from profiles)  │
└────────┬───────────┘    └────────┬────────┘
         │                         │
         └────────────┬────────────┘
                      ▼
          ┌─ PDF GENERATION ──┐
          │ Fill all fields   │
          │ Sign & submit     │
          └───────────────────┘
```

---

## Form-Specific Behavior

### When Staff Selects Entry Type

**job_coaching:**
- Show 7 row-level questions
- Do NOT ask client_name, authorization, etc. (auto-populated)
- Do NOT ask month_year (added at report assembly)

**job_development:**
- Show 5 row-level questions
- Do NOT ask header/summary fields
- Do NOT ask summary fields (collected during report finalization)

**life_skills:**
- Show 4 row-level questions
- Do NOT ask header fields
- Simple, focused service entry

---

## PDF Field Mapping

### USOR95 → App Fields
| USOR95 PDF Field | App Field Key | Data Source | Populated By |
|------------------|---------------|-------------|---|
| Client Name | client_name | Client entity | Report assembly |
| Authorization # | authorization_number | ServiceAuthorization | Report assembly |
| Counselor Name | vr_counselor_name | User entity | Report assembly |
| Employer | employer_name | TimeEntry / FormAnswer | Time entry form |
| Job Title | job_title | TimeEntry / FormAnswer | Time entry form |
| Month/Year | month_year | TimeEntry.date | Report assembly |
| Date (rows) | coaching_date | TimeEntry.date | Time entry form |
| Hours (rows) | coaching_hours | TimeEntry.duration_minutes | Time entry form |
| Coach Name | job_coach_name | ReportFieldAnswer | Time entry form |
| Primary Service | primary_service_code | ReportFieldAnswer | Time entry form |
| Secondary Service | secondary_service_code | ReportFieldAnswer | Time entry form |
| Activities | coaching_activities | ReportFieldAnswer | Time entry form |
| Performance | client_performance_notes | ReportFieldAnswer | Time entry form |

### USOR96 → App Fields
| USOR96 PDF Field | App Field Key | Data Source | Populated By |
|------------------|---------------|-------------|---|
| Client Name | client_name | Client entity | Report assembly |
| Authorization # | authorization_number | ServiceAuthorization | Report assembly |
| Job Goal | job_goal | ServiceAuthorization / Goal | Report assembly |
| CRP Company | crp_company_name | Provider entity | Report assembly |
| CRP Phone | crp_contact_phone | Provider entity | Report assembly |
| Date (rows) | development_date | TimeEntry.date | Time entry form |
| Hours (rows) | development_hours | TimeEntry.duration_minutes | Time entry form |
| Activity | development_activity | ReportFieldAnswer | Time entry form |
| Outcome | activity_outcome | ReportFieldAnswer | Time entry form |
| Next Steps | next_steps | ReportFieldAnswer | Time entry form |
| Summary | summary_information | Report level | Report finalization dialog |
| Barriers | barriers_to_cie | Report level | Report finalization dialog |

### USOR148 → App Fields
| USOR148 PDF Field | App Field Key | Data Source | Populated By |
|-------------------|---------------|-------------|---|
| Client Name | client_name | Client entity | Report assembly |
| Authorization # | authorization_number | ServiceAuthorization | Report assembly |
| Job Goal | job_goal | ServiceAuthorization / Goal | Report assembly |
| CRP Company | crp_company_name | Provider entity | Report assembly |
| CRP Phone | crp_contact_phone | Provider entity | Report assembly |
| Date (rows) | billable_date | TimeEntry.date | Time entry form |
| Hours (rows) | billable_hours | TimeEntry.duration_minutes | Time entry form |
| Activity | billable_activity | ReportFieldAnswer | Time entry form |
| Observations | billable_observations | ReportFieldAnswer | Time entry form |

---

## Implementation Status

✅ **Completed:**
- ReportFieldTemplate records cleaned (38 total, 0 duplicates)
- Form-specific field definitions
- Metadata complete (source_form_code, source_form_field_name, etc.)
- Separation of header/row/summary concerns

✅ **In Place:**
- Time entry form shows only row-level questions
- Row-level fields match actual service capture needs
- Header/summary fields handled by report assembly layer

📋 **Next Steps:**
- Update PDFFieldMap to match new field names
- Test time entry submission with new fields
- Verify report assembly pulls header data correctly
- Test PDF generation with actual USOR forms

---

## Field Validation Rules

✅ **Enforced:**
- No duplicate field_keys per entry_type (verified via database uniqueness)
- No duplicate labels per entry_type
- All reportable fields have source_form_code and source_form_field_name
- All fields have required field_type

✅ **Per Form:**
- job_coaching: 13 fields (6 header + 7 row)
- job_development: 14 fields (7 header + 5 row + 2 summary)
- life_skills: 11 fields (7 header + 4 row)

---

## Benefits of This Refactor

1. **No Duplicates** - Each form has exactly one definition per field
2. **Form-Driven** - Questions match actual USOR PDFs, not generic templates
3. **Clear Intent** - Header/row/summary separation eliminates confusion
4. **Minimal Capture** - Time entry form asks only what's needed
5. **Scalable** - Easy to add new forms (add new entry type)
6. **Auditable** - Full traceability from form → field → app data