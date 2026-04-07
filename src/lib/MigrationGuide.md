# Migration Guide: Feature-Driven → Data-Driven

This guide explains how to incrementally migrate existing features to use the data layer.

## Phase 1: Establish Data Layer (DONE)

- ✓ `lib/dataLayer.js` - Centralized data access
- ✓ `lib/DataModels.md` - Schema documentation
- ✓ `lib/FeatureTemplate.md` - Development pattern
- ✓ Core entities created (Client, TimeEntry, ReportFieldAnswer, etc.)

## Phase 2: Port Existing Features (IN PROGRESS)

### Priority 1: Core Recording Features

These create primary data and must be refactored first.

#### Time Entry Form
- **Current**: Saves to TimeEntry only; field answers lost
- **Target**: Saves to TimeEntry + ReportFieldAnswer
- **Migration**:
  1. Import DataLayer
  2. Replace `base44.entities.TimeEntry.create()` with `DataLayer.createTimeEntry()`
  3. Pass all form fields as `structured_fields` object
  4. Test that ReportFieldAnswer is created with same data
- **Owner**: Form component + TimeEntry page
- **Tests**: 
  - Verify TimeEntry created
  - Verify ReportFieldAnswer created with correct answers
  - Verify fields are queryable

#### Assessment Form
- **Current**: Saves responses to Assessment, no extraction
- **Target**: Saves responses + extracted facts
- **Migration**:
  1. Call processAssessmentDocuments to extract facts (already implemented)
  2. Use `DataLayer.updateAssessmentWithExtractedFacts()` to store
  3. Update Client.vocational_facts_profile with extraction results
  4. Link Assessment ID to Client.assessments_linked
- **Owner**: AssessmentSection component
- **Tests**:
  - Verify Assessment created with responses
  - Verify extracted facts stored
  - Verify Client.assessments_linked updated

#### Job Recommendation Saving
- **Current**: Saves to JobRecommendation (good)
- **Target**: Use DataLayer.createJobRecommendation() consistently
- **Migration**:
  1. Replace all JobRecommendation.create() calls with DataLayer method
  2. Ensure batch_id is always set
  3. Ensure client_fields_used and assessments_used are tracked
- **Owner**: jobSearchAssistant function, UI components
- **Tests**:
  - Verify recommendations are queryable by batch_id
  - Verify citations are preserved

#### Document Upload
- **Current**: Saves to Document/ClientDocument, no linkage
- **Target**: Links to source (TimeEntry, Assessment, etc.)
- **Migration**:
  1. Use `DataLayer.createClientDocument()` with source info
  2. Store generated_from_id (reference to source entity)
  3. Update Document.tags to include report type
- **Owner**: Document upload components
- **Tests**:
  - Verify documents linked to source
  - Verify tags are set correctly

### Priority 2: Reporting Features

These consume data and must work with new structure.

#### Report Generator
- **Current**: May be reading from multiple sources inconsistently
- **Target**: Use `DataLayer.buildReportContext()` exclusively
- **Migration**:
  1. Replace all context-building code with single DataLayer call
  2. Use PDFFieldMap for declarative PDF filling
  3. Save output to ClientDocument via DataLayer
- **Owner**: PDF generation functions, report UI
- **Tests**:
  - Verify context is complete
  - Verify PDF fields populated correctly
  - Verify document saved to Documents tab

#### Batch Report Generator
- **Current**: May iterate over clients
- **Target**: Use ReportBatch entity for tracking
- **Migration**:
  1. Create ReportBatch via DataLayer before processing
  2. Update batch status after each client
  3. Store document IDs in generated_documents array
- **Owner**: generateBatchPDFReports function, batch UI
- **Tests**:
  - Verify batch created and tracked
  - Verify individual PDFs saved to each client's Documents
  - Verify batch completion status

### Priority 3: AI & Analytics Features

These read data and produce insights.

#### Job Search Assistant
- **Current**: Already mostly data-driven (good example)
- **Target**: Ensure all reads use DataLayer
- **Migration**:
  1. Replace raw entity queries with DataLayer.contextForClient()
  2. Ensure recommendations saved via DataLayer
  3. Add assessments_used and client_fields_used tracking
- **Owner**: jobSearchAssistant function
- **Status**: MOSTLY DONE (already good pattern)

#### Client AI Assistant
- **Current**: May be reading from unstructured notes only
- **Target**: Read from Client vocational facts, assessments, time entries
- **Migration**:
  1. Load context via DataLayer.contextForClient()
  2. Pass structured data to LLM prompt
  3. Save insights (recommendations, summaries) back to entities
- **Owner**: clientAIAssistant function, AI panels
- **Tests**:
  - Verify prompt includes vocational facts
  - Verify outputs are saved to appropriate entities

#### Analytics Dashboard
- **Current**: Aggregates raw entity data
- **Target**: Reads from data layer, may benefit from computed views
- **Migration**:
  1. Import DataLayer for all client queries
  2. Use DataLayer.getClientTimeEntries() for time aggregations
  3. Create helper functions for common metrics
- **Owner**: Reports page, dashboard components
- **No breaking changes** if DataLayer queries are equivalent

### Priority 4: Automation & Webhooks

These trigger on data changes and must use events correctly.

#### Scheduled Time Entry Reminders
- **Current**: Unknown—may not exist yet
- **Target**: Automation on TimeEntry create
- **Approach**: Create entity automation trigger on TimeEntry.create
- **Tests**: Verify reminders sent for incomplete entries

#### Batch Report Generation Trigger
- **Current**: Manual trigger via UI
- **Target**: Could be scheduled automation
- **Approach**: Scheduled task that queries pending batches
- **Tests**: Verify batches processed on schedule

## Migration Roadmap

### Week 1: Data Layer Establishment
- ✓ Write DataModels.md, DataLayer.js, FeatureTemplate.md
- ✓ Create/validate core entities in database
- ✓ Test DataLayer methods in isolation

### Week 2: Core Recording (Time + Assessment)
- [ ] Migrate StructuredVRTimeEntryForm to use DataLayer.createTimeEntry()
- [ ] Migrate AssessmentSection to link assessments_linked
- [ ] Migrate processAssessmentDocuments results to updateAssessmentWithExtractedFacts()
- [ ] Add tests for each

### Week 3: Job Recommendations & Documents
- [ ] Migrate JobRecommendation saves to DataLayer
- [ ] Migrate Document uploads to link to source
- [ ] Update jobSearchAssistant to use DataLayer consistently
- [ ] Add tests

### Week 4: Reports & Batch Generation
- [ ] Migrate report generators to use DataLayer.buildReportContext()
- [ ] Migrate batch generator to use ReportBatch entity
- [ ] Ensure PDFs saved to ClientDocument
- [ ] Full end-to-end tests

### Week 5: AI Agents
- [ ] Audit clientAIAssistant to read from DataLayer
- [ ] Ensure AI outputs saved to entities
- [ ] Update other AI agents as needed

### Week 6: Analytics & Dashboards
- [ ] Audit dashboard data queries
- [ ] No code changes needed if queries are equivalent

## Testing Strategy

For each migrated feature:

1. **Unit**: DataLayer method works in isolation
2. **Integration**: Feature saves data correctly
3. **Data Consistency**: Related entities updated (links, counts)
4. **Queryability**: Saved data can be queried by other features
5. **Backward Compatibility**: Old data still accessible (if applicable)

Example test:

```js
test('Time entry saves structured fields', async () => {
  const entry = await DataLayer.createTimeEntry(clientId, 'job_coaching', {
    date: '2026-04-07',
    duration_hours: 3,
    structured_fields: {
      jc_hours: 3,
      jc_primary_service_code: '3',
      jc_employer_name: 'Acme Corp'
    }
  });
  
  // Verify TimeEntry created
  expect(entry.id).toBeDefined();
  
  // Verify ReportFieldAnswer created with answers
  const answers = await DataLayer.getTimeEntryStructuredData(entry.id);
  expect(answers.answers.jc_primary_service_code).toBe('3');
});
```

## Common Issues & Solutions

### Issue: "Feature X can't find data that Feature Y saved"
**Solution**: Both features using DataLayer? Check they're querying the same entity/field names.

### Issue: "Old code path still creating orphaned entities"
**Solution**: Search codebase for `base44.entities.X.create()` outside of DataLayer. Replace with DataLayer calls.

### Issue: "UI shows data, but it's not in database"
**Solution**: Feature keeping data in React state only. Add explicit DataLayer.create() call in save handler.

### Issue: "Report has blank fields"
**Solution**: Structured fields not being saved. Check that ReportFieldAnswer.answers has the field key.

## Rollback Plan

If migration breaks a feature:

1. Revert the specific feature file
2. Keep DataLayer in place (won't hurt)
3. Feature reverts to old behavior (reads/writes unchanged)
4. Fix the migration and retry

DataLayer is backward compatible—old code can coexist with new code temporarily.

## Success Criteria

When migration is complete:

- [ ] All user actions save to structured data models
- [ ] All features read from DataLayer (not raw entity queries)
- [ ] All time entries include structured fields
- [ ] All assessments include extracted facts
- [ ] All reports generated from structured data
- [ ] All recommendations include citations
- [ ] All AI outputs stored in entities
- [ ] Dashboard/analytics use DataLayer queries
- [ ] No unlinked data (orphaned records)
- [ ] Audit trail complete (created_by, created_at on all data)

## Questions?

When in doubt: **"Will another feature need this data?"**
- Yes → Store in entity
- No → Keep in React state