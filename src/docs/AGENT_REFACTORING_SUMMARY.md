# AI Agent Refactoring: Data-Aware Architecture

## Overview

The career coach agent has been refactored to enforce **data-first design**: no AI response without loaded client data. All recommendations are grounded in stored records and persist to the database.

## What Changed

### Before (Generic)
```
User Question → LLM → Generic Response ❌
```

### After (Data-Aware)
```
User Request → Load Full Client Context → Validate Data → LLM (with context) → Store Results → Respond ✅
```

## New Components

### 1. `functions/dataAwareAgent.js` (16KB)

Backend function that enforces data-first architecture:

- **4 Actions:**
  - `job_recommendations` - Generate 5-7 job matches grounded in vocational data
  - `progress_summary` - Analyze 30-day progress with specific data
  - `service_suggestions` - Recommend services to accelerate progress
  - `coaching_plan` - Design 4-week coaching plan with weekly tasks

- **Data Loading:**
  - Client profile + vocational facts
  - TimeEntry records (enriched with ReportFieldAnswers)
  - Assessment responses (full data)
  - Job applications history
  - Tasks, goals, activities

- **Validation:**
  - Prevents responses if insufficient data
  - Returns 422 with gaps list
  - Can force with `force: true`

- **Output Storage:**
  - JobRecommendation table (for recommendations)
  - ClientDocument table (for summaries/plans)
  - Task table (for action items)

### 2. `agents/career_coach.json` (Updated)

Agent configuration updated to emphasize data-driven approach:

- **New tool_configs:**
  - Added: TimeEntry, ReportFieldAnswer, Goal
  - Removed: Resume, InterviewSession, Meeting, OnboardingStep (read-only knowledge)

- **Reinforced instructions:**
  - "CANNOT provide recommendations without data"
  - "Load client context BEFORE offering advice"
  - "Every recommendation must reference specific data"

- **Web search capability:**
  - Maintains live job search integration
  - Uses web_search for real job postings
  - Grounds market data in client profile

## Key Features

### 1. No Generic Responses

❌ Bad:
> "You might be good at retail jobs because many people have retail skills."

✅ Good:
> "Your assessment shows strong customer service scores (92nd percentile), and your 4 retail applications advanced to interviews 3 times. Retail management is your next logical step."

### 2. Data Validation

Checks before any LLM call:

```json
{
  "error": "Insufficient data",
  "gaps": [
    "No time entries logged",
    "No structured report answers"
  ]
}
```

Guides user to collect required data.

### 3. Persistent Outputs

All AI-generated content stored:

```javascript
// JobRecommendation
{
  job_title: "QA Technician",
  fit_reason: "Assessment shows 97th percentile attention-to-detail. 2 of 3 applications were QA roles.",
  fit_score: 87,
  assessments_used: ["assess_1", "assess_2"],
  client_fields_used: ["vocational_facts_profile", "barriers"]
}

// ClientDocument (summaries/plans)
// Task (action items)
```

### 4. Audit Trail

Every output includes:
- `generated_by` - who ran the agent
- `batch_id` - groups related outputs
- `assessments_used` - which assessments
- `client_fields_used` - what data was referenced

## API Usage

### Generate Job Recommendations

```javascript
const result = await base44.functions.invoke('dataAwareAgent', {
  action: 'job_recommendations',
  clientId: 'client_123'
});

// Returns: JobRecommendation[] with fit_reason, fit_score, support_strategy
```

### Generate Progress Summary

```javascript
const result = await base44.functions.invoke('dataAwareAgent', {
  action: 'progress_summary',
  clientId: 'client_123'
});

// Returns: ClientDocument with situation, progress, barriers, next steps
// Saved to: ClientDocument table
```

### Suggest Additional Services

```javascript
const result = await base44.functions.invoke('dataAwareAgent', {
  action: 'service_suggestions',
  clientId: 'client_123'
});

// Returns: Suggested services + auto-created Task records
```

### Generate Coaching Plan

```javascript
const result = await base44.functions.invoke('dataAwareAgent', {
  action: 'coaching_plan',
  clientId: 'client_123'
});

// Returns: 4-week plan saved to ClientDocument
// Creates: 4 weekly Task records
```

## Data Sources

### Required
- **Client** (profile, target role, barriers)
- **TimeEntry** (≥1 activity logged)
- **Assessment** (≥1 completed)
- **ReportFieldAnswer** (≥1 structured response)

### Enriched Data
- **JobApplication** (application history)
- **Task** (pending work)
- **Goal** (career objectives)
- **Document** (past summaries)
- **Activity** (engagement history)

## Benefits

### For Clients
- Personalized advice grounded in their data
- Service recommendations based on specific gaps
- Coaching plans tailored to their barriers and goals
- All recommendations stored for future reference

### For Coaches
- Data-driven insights (not generic advice)
- Audit trail showing what informed each recommendation
- Suggested tasks auto-created
- Progress summaries with specific data

### For Supervisors
- All AI-generated content is persistent and auditable
- Can track which client data informed recommendations
- Can identify when client data is insufficient
- Can validate AI recommendations against client outcomes

## Compliance

This architecture ensures:
- **USOR95, USOR96, USOR148:** Recommendations grounded in service data
- **Data Integrity:** All outputs linked to source data
- **Auditability:** Every recommendation has a trail
- **No Hallucination:** AI confined to loaded client data

## Migration Notes

### Existing `clientAIAssistant` Function

The `functions/clientAIAssistant.js` remains unchanged for backward compatibility:
- Still supports `summarize`, `suggest_tasks`, `draft_email`, `engagement_insights`, `coaching_recommendations`
- Uses same data-loading pattern
- Outputs to ClientDocument and Task tables

### New Recommended Path

For new features, use `dataAwareAgent.js`:
- Simpler API (action-based)
- Stricter data validation
- Better structured output
- Clearer audit trail

## Testing Checklist

- [ ] Load client context with no data → returns error with gaps
- [ ] Load client context with full data → returns context string
- [ ] Generate recommendation → validates data before LLM call
- [ ] Save recommendation → creates JobRecommendation record with all fields
- [ ] Save summary → creates ClientDocument with data provenance note
- [ ] Create coaching plan → generates 4 Task records with due dates

## Documentation

- `docs/DATA_AWARE_AGENT.md` - Complete API reference and architecture
- `docs/AGENT_REFACTORING_SUMMARY.md` - This file (overview and migration)