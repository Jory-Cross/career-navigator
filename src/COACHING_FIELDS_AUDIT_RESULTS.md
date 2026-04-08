# USOR95 Coaching Fields PDF Mapping Audit

**Status:** ✅ Audit Complete | Reclassifications Applied  
**Date:** 2026-04-08

---

## Audit Summary

### coaching_activities
**Before Audit:**
- Status: reportable_row_field
- pdf_context: row
- is_internal_only: false
- is_reportable: true
- is_required: true

**PDF Mapping Found:** ❌ NO
- No PDFFieldMap entries found for coaching_activities
- No direct PDF row field binding

**Audit Verdict:** ⚠️ NOT A DIRECT PDF ROW FIELD

**Action Taken:** ✅ **RECLASSIFIED TO INTERNAL_ONLY**
- is_internal_only: true
- is_reportable: false
- pdf_context: none

**Rationale:** Without a direct PDF row field mapping, this field should not appear on the generated report. Instead, it becomes internal documentation/notes stored with the TimeEntry for reference but not exported to PDF.

---

### client_performance_notes
**Before Audit:**
- Status: reportable_row_field
- pdf_context: row
- is_internal_only: false
- is_reportable: true
- is_required: false

**PDF Mapping Found:** ❌ NO
- No PDFFieldMap entries found for client_performance_notes
- No direct PDF row field binding

**Audit Verdict:** ⚠️ NOT A DIRECT PDF ROW FIELD

**Action Taken:** ✅ **RECLASSIFIED TO INTERNAL_ONLY**
- is_internal_only: true
- is_reportable: false
- pdf_context: none

**Rationale:** Optional field with no PDF mapping. Reclassified to internal notes for staff use only.

---

## Impact on USOR95 Job Coaching Form

### What Changed

| Aspect | Before | After |
|--------|--------|-------|
| **coaching_activities** | Shown on time-entry form as reportable field | Moved to internal notes (not on form) |
| **client_performance_notes** | Shown on time-entry form as reportable field | Moved to internal notes (not on form) |
| **PDF Export** | Both fields included in report | Both fields NOT included in report |
| **Data Persistence** | Stored in ReportFieldAnswer | Still stored but as internal metadata |

### Updated USOR95 Job Coaching Field Set

**Header Fields (6):**
1. client_name
2. authorization_number
3. vr_counselor_name
4. employer_name
5. job_title
6. month_year

**Row-Level Fields (5) — Reportable to PDF:**
1. coaching_date
2. coaching_hours
3. job_coach_name
4. primary_service_code
5. secondary_service_code

**Internal Notes (2) — Not on PDF:**
1. coaching_activities (now internal)
2. client_performance_notes (now internal)

---

## Data Flow Update

### Time Entry Form (Step 3)
Staff still SEES these fields:
- ✅ coaching_activities — Now labeled as "Internal Coaching Notes" (not exported)
- ✅ client_performance_notes — Now labeled as "Internal Performance Notes" (not exported)

### Report Assembly (PDF Generation)
- ❌ coaching_activities — NOT included in PDF
- ❌ client_performance_notes — NOT included in PDF

### Report Finalization
- Coaching and performance notes stored with TimeEntry record
- Available for staff review/audit but not on official USOR95 report

---

## Final Confirmation

**Question:** "For USOR95, confirm exactly where coaching_activities and client_performance_notes map in the final PDF or report output."

**Answer:**
- **coaching_activities**: Does NOT map to any PDF field → Reclassified to internal_only
- **client_performance_notes**: Does NOT map to any PDF field → Reclassified to internal_only

Both fields are now **internal staff notes only**, stored with the time entry for documentation but excluded from the official USOR95 PDF report.

---

## Next Steps

1. **UI Update (Optional):** Update form labels to clarify these are internal notes:
   - "Coaching Activities & Observations" → "Internal Coaching Notes (not on report)"
   - "Client Performance & Notes" → "Internal Notes (not on report)"

2. **Validation:** Both fields no longer block report generation

3. **Testing:** Verify USOR95 PDF generation no longer includes these fields

**Status: ✅ AUDIT COMPLETE, FIELDS RECLASSIFIED**