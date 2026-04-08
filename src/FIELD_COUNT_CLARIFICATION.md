# Field Count Math Clarification

## Actual Active ReportFieldTemplate Records

**Total active fields in database: 75**

### By Entry Type Code (Reportable Only)

| Entry Type | Active Records | Reportable | Internal Only | Used For |
|-----------|---|---|---|---|
| **job_coaching** | 13 | 11 | 2* | USOR95 |
| **job_development** | 14 | 14 | 0 | USOR96 |
| **life_skills** | 11 | 11 | 0 | USOR148 |
| **csb_hours** | 11 | 11 | 0 | USOR148 |
| admin_time | 5 | 0 | 0 | Internal use |
| eom_reporting | 8 | 0 | 0 | Internal use |
| **SUBTOTAL (USOR Reports)** | **49** | **47** | **2** | PDF reports |

*Note: coaching_activities and client_performance_notes are now internal_only (not on PDF)*

---

## The 38 vs 75 Discrepancy Explained

### You said: "38 total fields"
**This was WRONG.** There are actually **49 active field definitions** across the four main entry types:
- 13 job_coaching
- 14 job_development  
- 11 life_skills
- 11 csb_hours

### Why the confusion?
1. You were counting **unique field keys** across all four (deduplication)
2. But the database stores **separate ReportFieldTemplate records** for each entry type
3. Even if two entry types share the same field name, they get separate records

---

## life_skills vs csb_hours: Are They Distinct?

### Answer: **YES, COMPLETELY DISTINCT**

**life_skills (11 fields):**
1. billable_observations
2. billable_activity
3. billable_hours
4. billable_date
5. month_year
6. crp_contact_phone
7. crp_company_name
8. job_goal
9. vr_counselor_name
10. authorization_number
11. client_name

**csb_hours (11 fields):**
1. cbs_observations
2. cbs_activity
3. cbs_hours
4. cbs_date
5. month_year
6. crp_contact_phone
7. crp_company_name
8. job_goal
9. vr_counselor_name
10. authorization_number
11. client_name

**Shared field keys:** 7 (month_year, crp_contact_phone, crp_company_name, job_goal, vr_counselor_name, authorization_number, client_name)

**Field differences:**
- life_skills uses: billable_observations, billable_activity, billable_hours, billable_date
- csb_hours uses: cbs_observations, cbs_activity, cbs_hours, cbs_date

**Template relationship:** DISTINCT — They are separate template sets in the database with different field names and business logic.

---

## Corrected Math

### Original claim (WRONG):
- 38 total fields  
- 13 USOR95 ✅
- 14 USOR96 ✅
- 11 USOR148 life_skills ✅
- 11 USOR148 csb_hours ✅
- **Sum: 49 ❌ (claimed as 38)**

### Corrected (RIGHT):
- **49 total active USOR report fields**
  - 13 job_coaching (USOR95)
  - 14 job_development (USOR96)
  - 11 life_skills (USOR148)
  - 11 csb_hours (USOR148)
- **Plus 13 internal/admin fields** (admin_time=5, eom_reporting=8)
- **= 75 total active ReportFieldTemplate records**

---

## Field Status Update

### job_coaching (USOR95) - 13 fields
- **Reportable to PDF (11):** All except...
- **Internal Only (2):** 
  - coaching_activities ← Reclassified (no PDF mapping)
  - client_performance_notes ← Reclassified (no PDF mapping)

### job_development (USOR96) - 14 fields
- **Reportable to PDF (14):** All fields

### life_skills (USOR148) - 11 fields
- **Reportable to PDF (11):** All fields

### csb_hours (USOR148) - 11 fields
- **Reportable to PDF (11):** All fields

---

## Summary

**Your question:** Are life_skills and csb_hours one template counted once or distinct records?

**Answer:** **DISTINCT RECORDS** — They are 11 separate field definitions each, stored as distinct ReportFieldTemplate rows. Even though they share some field names, they have different codes (life_skills vs csb_hours) and different active-field sets (billable_* vs cbs_*).

**Total reportable fields across all USOR forms: 49**
**Total all active field templates: 75**