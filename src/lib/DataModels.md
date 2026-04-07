# Data-Driven Architecture

All features consume from structured data models. No feature writes directly to chat or temporary storage.

## Core Data Models

### Client (Foundation Entity)
- **id** (UUID)
- **name**, **email**, **phone**
- **demographics**: age, location, disability status
- **employment_goals**: target_role, industry, salary_range
- **barriers**: array of barrier descriptions
- **preferences**: work_type (remote/hybrid/onsite), schedule preferences
- **assessments_linked**: array of Assessment IDs
- **vocational_facts_profile**: extracted structured assessment data (from processAssessmentDocuments)
- **status**: active/inactive/completed
- **created_at**, **updated_at**

### TimeEntry (Activity Ledger)
- **id** (UUID)
- **client_id** (fk Client)
- **entry_type_id** (fk EntryType) - job_development, job_coaching, life_skills, etc.
- **date** (date)
- **duration_minutes** (number)
- **location** (optional)
- **category** (deprecated; use entry_type instead)

### ReportFieldAnswer (Structured Time Entry Data)
- **id** (UUID)
- **time_entry_id** (fk TimeEntry)
- **entry_type_id** (fk EntryType)
- **answers**: { field_key: value, ... } - all structured fields for this entry type
- **submitted_at** (datetime)

### JobRecommendation (AI-Generated, Data-Backed)
- **id** (UUID)
- **client_id** (fk Client)
- **job_title**, **employer**, **location**
- **job_url** (source link)
- **fit_score** (0-100, numeric)
- **fit_reason** (why this job matches)
- **support_needs**: array of accommodations
- **barriers_identified**: array
- **status**: suggested/saved/applied/rejected
- **generated_by**: email of user who generated
- **assessments_used**: array of Assessment IDs that informed this recommendation
- **client_fields_used**: array of client field names used in reasoning
- **batch_id**: groups recommendations from one generation run
- **created_at**

### Assessment (Structured + Extracted)
- **id** (UUID)
- **client_id** (fk Client)
- **assessment_type**: career_goals, skills_audit, job_search_readiness, riasec, wsa
- **responses**: { question_key: answer, ... } - structured form data
- **extracted_facts**: { category: data, ... } - AI-extracted key facts (from processAssessmentDocuments)
- **pdf_url** (generated report)
- **completed_by** (user email)
- **created_at**, **updated_at**

### ClientDocument (Audit Trail + Evidence)
- **id** (UUID)
- **client_id** (fk Client)
- **document_type**: resume, cover_letter, assessment_pdf, vr_report, work_sample
- **file_url**
- **file_name**
- **generated_from_id**: if auto-generated, reference to source (Assessment, TimeEntry, etc.)
- **created_at**
- **created_by** (user email)

### ReportBatch (Multi-Client Report Generation)
- **id** (UUID)
- **pdf_template_id** (fk PDFTemplate)
- **entry_type**: job_development, job_coaching, life_skills
- **client_ids**: array
- **date_range_start**, **date_range_end**
- **status**: processing/completed/failed
- **generated_documents**: array of { client_id, document_id, pdf_url }
- **created_by**, **created_at**

### PDFTemplate (Storage + Versioning)
- **id** (UUID)
- **entry_type_id** (fk EntryType)
- **name** (e.g., "USOR 96 Job Development")
- **pdf_file_url** (base template)
- **version** (e.g., "2024-Q1")
- **is_active** (boolean)
- **created_at**

### PDFFieldMap (Declarative Binding)
- **id** (UUID)
- **pdf_template_id** (fk PDFTemplate)
- **pdf_field_name** (from PDF AcroForm)
- **source_type**: time_entry | report_answer | client | assessment | calculated
- **source_field** (field key to look up)
- **is_repeating_row** (for tables)
- **row_group** (groups related repeating rows)
- **transform**: none | date_format | time_format | hours_from_minutes | full_name
- **transform_options**: { format: "MM/DD/YYYY", ... }
- **default_value** (fallback if empty)

---

## Relationships (Data Flow)

```
Client
  ├── Assessment (multiple, linked by assessments_linked)
  ├── TimeEntry (multiple, tracked by client_id)
  │   └── ReportFieldAnswer (1:1, answers for this entry)
  ├── JobRecommendation (multiple, generated from assessments + client data)
  └── ClientDocument (multiple, reports, resumes, assessments)

TimeEntry
  └── ReportFieldAnswer (1:1, structured data for this entry)

ReportBatch
  ├── PDFTemplate (1:1, which template to use)
  └── ClientDocument (multiple, output documents)

PDFTemplate
  └── PDFFieldMap (multiple, how to populate each field)
```

---

## Feature Consumption Pattern

All features (AI agents, report generators, dashboards) follow this pattern:

1. **Read**: Query Client, Assessment, TimeEntry, JobRecommendation from data layer
2. **Process**: Perform business logic (AI, calculations, filtering)
3. **Write**: Save results back to structured entities (never to temporary chat/memory)
4. **Link**: Create relationships (ReportFieldAnswer, ClientDocument, Assessment.extracted_facts)
5. **Display**: Read from data models to render UI (not from feature state)

---

## No Feature Siloing

- ❌ AI agent generates insights in chat → closed loop
- ✅ AI agent reads Assessment → generates JobRecommendation → links via batch_id → displays from data

- ❌ Time entry UI saves only to chat notes
- ✅ Time entry UI saves to TimeEntry + ReportFieldAnswer → enables reporting + automation

- ❌ Document upload stored as file reference only
- ✅ Document upload saved to ClientDocument + linked to source (Assessment, Report)

---

## Structured vs Unstructured

- **Unstructured**: general notes, chat transcripts, internal observations (store in notes fields)
- **Structured**: anything needed for reporting, automation, AI reasoning (own entity fields or JSON objects)

Example: "Client has transportation barrier"
- Unstructured: stored in Client.general_notes
- Structured: added to Client.barriers array, referenced in JobRecommendation.barriers_identified