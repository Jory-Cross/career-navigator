# Feature Development Template (Data-Driven)

All new features must follow this pattern: **Data First, Feature Second**

## Pattern

```
User Action
  ↓
Load data via DataLayer (or queryClientContext)
  ↓
Process/Analyze using business logic
  ↓
Write results back to structured entities (NOT temporary storage)
  ↓
Display from data models (read from entities, not feature state)
```

## Example: Time Entry Form

### ❌ ANTI-PATTERN (Feature-driven)

```jsx
function TimeEntryForm({ clientId }) {
  const [formData, setFormData] = useState({}); // Local state only
  const [currentStep, setCurrentStep] = useState(1);
  
  const handleSubmit = () => {
    // Save only to TimeEntry
    // Field answers lost—no structured data saved
    base44.entities.TimeEntry.create({...});
  };
}
```

**Problems:**
- Field answers only in local state
- Can't generate reports later
- Can't feed data to AI agents
- Can't query by field values

---

### ✅ PATTERN (Data-driven)

```jsx
import { DataLayer } from "@/lib/dataLayer";

function TimeEntryForm({ clientId }) {
  const handleSubmit = async (entryType, formData) => {
    // Create TimeEntry AND ReportFieldAnswer
    const timeEntry = await DataLayer.createTimeEntry(clientId, entryType, {
      date: formData.date,
      duration_hours: formData.hours,
      duration_minutes: formData.hours * 60,
      structured_fields: {
        // All entry-type-specific fields
        jd_activity: formData.activity,
        jd_outcome: formData.outcome,
        jd_hours: formData.hours,
        // ... all fields from VR_ENTRY_TYPES[entryType]
      },
      is_complete: validateRequired(entryType, formData),
      submitted_at: new Date().toISOString(),
    });

    // ✓ Data is now queryable for reports, AI, automations
    // ✓ All fields are structured and can be mapped to PDFs
    // ✓ Other features can read this data
  };
}
```

**Benefits:**
- Structured data persisted
- All downstream features can use it
- Reportable
- AI-queryable
- PDF-fillable

---

## Example: AI Agent (Recommendation Generator)

### ❌ ANTI-PATTERN

```js
async function generateRecommendations(clientId) {
  // AI reads only chat history or unstructured notes
  // Outputs to chat window (lost)
  const insights = await llm.generate(clientNotes);
  displayInChat(insights);
}
```

---

### ✅ PATTERN

```js
async function generateRecommendations(clientId) {
  // 1. Load complete client context from data layer
  const context = await DataLayer.contextForClient(clientId);
  const { client, assessments, vocationalFacts, timeEntries } = context;
  
  // 2. Process with AI
  const prompt = `Use this data: ${JSON.stringify(context)}...`;
  const insights = await llm.generate(prompt);
  
  // 3. Save results back to structured entities
  for (const job of insights.recommendations) {
    await DataLayer.createJobRecommendation(clientId, {
      job_title: job.title,
      fit_score: job.score,
      support_needs: job.accommodations,
      assessments_used: assessments.map(a => a.id),
      client_fields_used: ['vocational_facts_profile'],
      batch_id: generateBatchId(),
    });
  }
  
  // 4. Return reference to stored data (not the insights themselves)
  const savedRecs = await DataLayer.getClientRecommendations(clientId);
  return savedRecs;
}
```

**Result:**
- Recommendations are queryable, filterable
- Can be reviewed by staff
- Can be linked to applications
- Can feed into reports
- Audit trail of what AI recommended

---

## Example: Report Generator

### ❌ ANTI-PATTERN

```js
function generateReport(clientId, dateRange) {
  // Query from TimeEntry only (no structured fields)
  const entries = base44.entities.TimeEntry.filter({...});
  
  // Manual PDF filling with guessing
  form.setField('jd_hours', entries.map(e => e.duration).sum());
  // Lost because no structured data exists
}
```

---

### ✅ PATTERN

```js
async function generateReport(templateId, clientId, dateFrom, dateTo) {
  // 1. Load report context (includes structured data)
  const context = await DataLayer.buildReportContext(
    clientId, dateFrom, dateTo, 'job_development'
  );
  
  const { client, timeEntries } = context;
  
  // 2. Map structured fields to PDF fields
  const template = await base44.entities.PDFTemplate.get(templateId);
  const mappings = await base44.entities.PDFFieldMap.filter({
    pdf_template_id: templateId
  });
  
  // 3. Fill PDF using declarative mappings
  for (const mapping of mappings) {
    const value = resolveFieldValue(mapping, context);
    pdfForm.setField(mapping.pdf_field_name, value);
  }
  
  // 4. Save generated PDF to ClientDocument
  const doc = await DataLayer.createClientDocument(clientId, {
    file_url: uploadedUrl,
    type: 'vr_report',
    notes: `Generated from ${timeEntries.length} time entries`,
  });
  
  return doc;
}
```

**Result:**
- Reports use actual structured data, not guesses
- Repeating rows filled from arrays of entries
- Calculations done from stored data (totals, ratios, etc.)
- Audit trail (document linked to timeEntries)
- No manual data re-entry needed

---

## Checklist: Is My Feature Data-Driven?

- [ ] Does it read from DataLayer (not direct entity queries)?
- [ ] Does it write results to structured entities (not temporary state)?
- [ ] Can the output be queried/filtered by other features?
- [ ] Is data linkable (batch_id, document_id references)?
- [ ] Would a report generator have access to this data?
- [ ] Would an AI agent have access to this data?
- [ ] Are relationships explicit (foreign keys)?
- [ ] Can data be audited (created_by, created_at)?

If you answer "no" to any, redesign to be data-driven.

---

## Common Patterns

### Batch Processing

```js
// Create batch record
const batch = await DataLayer.createReportBatch({
  pdf_template_id,
  entry_type: 'job_development',
  client_ids: [clientA, clientB, clientC],
  date_from, date_to
});

// Process each client
for (const clientId of batch.client_ids) {
  const report = await generateReport(batch.pdf_template_id, clientId, ...);
  // Link to batch
  batch.generated_documents.push({
    client_id: clientId,
    document_id: report.id
  });
}

// Update batch status
await DataLayer.updateReportBatch(batch.id, {
  status: 'completed',
  generated_documents: batch.generated_documents
});
```

### AI Agent Storing Structured Output

```js
const profile = await generateVocationalProfile(clientId);

// Store in Assessment
await DataLayer.createAssessment(clientId, 'career_goals', 
  { extracted_by_ai: true }, // responses
  { 
    strengths: profile.strengths,
    barriers: profile.barriers,
    job_targets: profile.job_targets
  } // extractedFacts
);
```

### Feature-to-Feature Data Passing

```js
// Feature A: Time entry form saves data
await DataLayer.createTimeEntry(clientId, 'job_coaching', {...});

// Feature B: Report generator reads same data
const entries = await DataLayer.getClientTimeEntries(clientId, {
  entry_type: 'job_coaching',
  date_from, date_to
});
```

No direct hand-off needed. Both read from the same data source.

---

## When to Add New Fields

If a feature needs to store data:

1. **Is it used by multiple features?** → Add to core entity (Client, TimeEntry, etc.)
2. **Is it structured (queryable)?** → Add as explicit field or embed in JSON
3. **Is it unstructured (note)?** → Add to `notes` field
4. **Is it temporary (UI state)?** → Keep in React state, don't persist
5. **Is it linked to something?** → Add foreign key or array of IDs

Example: "Job coach notes on this session"
- Queryable by coaching history? → Add to ReportFieldAnswer.answers
- Just for context? → Add to TimeEntry.description
- Temporary scratch? → Keep in React state only