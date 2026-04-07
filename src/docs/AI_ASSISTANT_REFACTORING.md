# AI Assistant Refactoring: Data-Aware Job Coaching Agent

## Overview

The AI assistant has been refactored from a generic chatbot to a **data-aware job coaching agent** that:

1. **Loads full client context** before responding (via DataLayer pattern)
2. **Grounds recommendations** in actual client data (vocational facts, assessments, time entries)
3. **Persists all outputs** to structured entities (not ephemeral chat)
4. **Generates actionable coaching plans** with specific job recommendations
5. **Creates traceable records** of AI suggestions for audit and follow-up

---

## Architecture Changes

### Before (Feature-Driven)
```
User Input → AI Chat → Generic Response → Lost in Chat History
```

### After (Data-Driven)
```
User Input 
  ↓
Load Client Context (DataLayer)
  ├── Client profile
  ├── Vocational facts (extracted)
  ├── Assessments
  ├── Time entries + structured answers
  ├── Job applications
  ├── Goals
  └── Support notes
  ↓
AI Processing (LLM) with full context
  ↓
Generate Output + Persist to Entities
  ├── JobRecommendation (saved, queryable)
  ├── Document (coaching plan)
  ├── Task (next steps)
  └── Goal (updated)
  ↓
UI displays from stored data
```

---

## Key Changes

### 1. Full Context Loading

**File**: `functions/clientAIAssistant.js`

The function now loads:
- Client demographics + goals + barriers
- Vocational facts (pre-extracted from assessments)
- All assessments with responses
- Time entries with structured field answers
- Job applications (status, dates)
- Previous recommendations (to avoid duplicates)
- Goals and support notes

```js
// Example: Vocational context automatically injected into LLM prompt
const vocationalContext = `
VOCATIONAL FACTS (extracted from assessments):
SKILLS:
  • Strong communication [assessment: career_goals]
  • Attention to detail [assessment: skills_audit]
BARRIERS:
  • Transportation limited [document: intake_form]
  • Social anxiety [assessment: riasec]
...
`;
```

### 2. Data-Grounded Recommendations

The AI prompt now requires:
- **Specific data sources** for each recommendation
- **Cite which assessment/document** informed the suggestion
- **Acknowledge conflicts** in the data instead of guessing
- **Flag missing information** that would improve recommendations

Example prompt instruction:
```
"For EACH job recommendation, cite SPECIFIC client factors (name the source document/assessment)"
"In 'fit_reason': list client factors that make this a good fit + their sources"
"If conflicts exist, note them — do NOT resolve by guessing"
```

### 3. Persistent Outputs

All AI-generated content is saved to entities:

#### Job Recommendations
```js
await base44.asServiceRole.entities.JobRecommendation.create({
  client_id: clientId,
  job_title: 'Retail Associate',
  fit_reason: 'Matches documented customer service skills from career assessment',
  fit_score: 75,
  support_needs: ['Schedule flexibility for medical appointments'],
  status: 'suggested',
  generated_by: user.email,
  batch_id: batchId,
  assessments_used: [assessment_id_1, assessment_id_2],
  client_fields_used: ['vocational_facts_profile', 'barriers', 'goals']
});
```

#### Coaching Plans
```js
// Saved as ClientDocument with full JSON
const doc = await base44.asServiceRole.entities.Document.create({
  client_id: clientId,
  title: 'AI-Generated Coaching Plan - April 7, 2026',
  category: 'reference',
  tags: ['ai-generated', 'coaching', 'plan'],
  notes: 'Based on client vocational facts, assessments, and 22 time entries'
});
```

#### Action Items
```js
// Next coaching session focus auto-created as Task
await base44.asServiceRole.entities.Task.create({
  title: `Coaching Session: Interview skills for customer-facing roles`,
  description: 'Practice handling questions about accommodation needs',
  status: 'pending',
  priority: 'high',
  client_ids: [clientId],
  due_date: nextWeek
});
```

---

## New AI Actions

### 1. `summarize` (Existing)
Client overview and engagement level. Still reads full context.

### 2. `suggest_tasks` (Existing)
Suggests follow-up actions. Still creates Task entities.

### 3. `draft_email` (Existing)
Personalized email drafts. Now grounded in vocational facts.

### 4. `engagement_insights` (Existing)
Analyzes activity patterns. Now includes time entry data breakdown.

### 5. `coaching_recommendations` (NEW)
**Generates job coaching strategy grounded in client data**

Returns:
- **Coaching priorities**: What to focus on based on barriers + goals
- **Job search strategy**: How to find jobs matching their profile
- **Skill gaps**: What to develop before interviews
- **Recommended accommodations**: How to support success
- **Job recommendations**: 3-5 specific roles with reasons (grounded in data)
- **Next session focus**: Specific coaching direction

Example output:
```json
{
  "coaching_priorities": [
    "Build confidence in interviews (noted anxiety in 3 support notes)",
    "Leverage strong organizational skills (documented in RIASEC assessment)"
  ],
  "job_search_strategy": "Focus on administrative roles with clear structure; research companies with strong DEI initiatives",
  "skill_gaps": [
    "Interview response to 'Tell me about a challenge you overcame'"
  ],
  "recommended_accommodations": [
    "Written job descriptions (vs. phone screening only)",
    "Schedule accommodations for medical appointments"
  ],
  "job_recommendations": [
    {
      "job_title": "Administrative Assistant",
      "why_fit": "Matches documented organizational skills from RIASEC and time entry data showing attention to detail",
      "data_basis": "RIASEC: Conventional + time entries with detailed documentation"
    }
  ],
  "next_coaching_session_focus": "Mock interview for administrative roles; practice discussing accommodation needs"
}
```

### 6. `save_coaching_plan` (NEW)
**Persists coaching plan to Documents + creates Task for next steps**

Saves:
- Full coaching plan as Document (JSON)
- Next session focus as Task (auto-due in 7 days)
- Audit trail (who generated, when, based on which data)

---

## UI Changes

### New "Coaching" Tab

The AI Assistant panel now has 5 tabs:
1. **Summary** - Client overview
2. **Tasks** - Suggested follow-ups (with save to Task entity)
3. **Email** - Draft personalized messages
4. **Insights** - Engagement analysis
5. **Coaching** - Job coaching strategy + save plan (NEW)

The Coaching tab displays:
- Coaching priorities
- Job search strategy
- Skill gaps
- Recommended accommodations
- Job recommendations (with data basis)
- Next session focus
- **"Save Plan" button** → Persists to Documents + creates Task

---

## Data Flow Example

### User clicks "Generate Coaching Plan"

1. **Frontend** calls `clientAIAssistant` action `coaching_recommendations`
2. **Backend**:
   a. Loads full client context (DataLayer pattern)
   b. Injects vocational facts into LLM prompt
   c. LLM generates coaching plan grounded in data
   d. Returns structured response
3. **Frontend** displays coaching plan
4. **User clicks "Save Plan"**
5. **Backend**:
   a. Calls `save_coaching_plan` action
   b. Saves plan to ClientDocument (with audit trail)
   c. Creates Task for next coaching session
   d. Returns success
6. **Frontend** shows toast: "Coaching plan saved to Documents!"
7. **Next time** staff member loads client profile:
   - Sees coaching plan in Documents
   - Sees task in Tasks section
   - Can see Job Recommendations in client's recommendation list

---

## Data Quality Safeguards

### 1. Grounding in Vocational Facts
If `client.vocational_facts_profile` is empty:
- Prompt includes: "No vocational facts extracted yet — run assessment preprocessing"
- Recommendations are less specific but still data-backed
- UI flags this limitation

### 2. Conflict Detection
If extracted facts have conflicts (e.g., "I like working alone" vs "Strong teamwork skills"):
- LLM is instructed: "Do NOT resolve conflicts by guessing — flag for staff review"
- Conflicts appear in output
- Staff reviews and clarifies

### 3. Source Attribution
Every recommendation must cite:
- **Assessment used**: "Based on RIASEC assessment"
- **Document reviewed**: "From intake interview"
- **Time entry pattern**: "From 12 job coaching sessions"

### 4. Audit Trail
All AI outputs include:
- **generated_by**: Email of user who ran AI
- **created_at**: When the plan was generated
- **batch_id**: Groups recommendations from one session
- **assessments_used**: Which assessments informed this
- **client_fields_used**: Which client data fields were used

---

## Migration Path (If Using Existing AI Assistant)

### Phase 1: Awareness
Staff see new "Coaching" tab in AI Assistant.

### Phase 2: Adoption
Staff use "Generate Coaching Plan" for new clients:
- Click button → See plan → Click "Save Plan" → Done
- Plan appears in Documents
- Task auto-created for next session

### Phase 3: Integration
Coaching plans + recommendations feed into:
- Job applications (linked recommendations)
- Time entries (coaching focuses recorded)
- Reports (coaching effectiveness tracked)

---

## Common Questions

### "What if vocational facts aren't extracted?"
Recommendations still work, but are less specific. Prompt auto-adjusts. Recommend running `processAssessmentDocuments` first for best results.

### "Can the AI make mistakes?"
Yes. That's why:
- All outputs are saved (staff can review, edit, delete)
- Data sources are cited (staff can verify)
- Conflicts are flagged (not auto-resolved)
- Staff must manually approve job recommendations

### "How is this different from a regular chatbot?"
- **Regular chatbot**: User input → AI response → Lost in chat
- **This agent**: User input → Load full context → AI response → Save to database → Links to other features

### "Who can see these coaching plans?"
- Person who generated (and saved) it
- Anyone with access to the client's Documents
- Anyone querying JobRecommendation table
- Appears in audit logs

---

## Testing Checklist

- [ ] Generate coaching plan on client with vocational facts → Verify recommendations cite assessment names
- [ ] Generate coaching plan on client without assessments → Verify prompt auto-adjusts
- [ ] Click "Save Plan" → Verify Document created + Task created + Toast shows success
- [ ] Load client profile → Verify coaching plan appears in Documents tab
- [ ] Load client profile → Verify next session task appears in Tasks
- [ ] Check JobRecommendation table → Verify recommendations saved with batch_id + citations
- [ ] Check Activity log → Verify "AI Coaching Plan Generated" entry recorded

---

## Technical Notes

### DataLayer Usage
The assistant now follows the DataLayer pattern from `lib/dataLayer.js`:
- All entity reads go through DataLayer (or direct queries when needed)
- All writes use `base44.asServiceRole.entities.*`
- Context is built once, passed to LLM, then outputs saved back

### LLM Model
Uses `claude_sonnet_4_6` by default (high quality for grounded analysis). Can be changed in response schema.

### Performance
Loading full context (~30 entities) takes ~2-3 seconds. LLM generation takes ~5-10 seconds. Total time: ~10-15 seconds. Consider async in future.

### Scaling
For high-volume coaching (100+ clients), consider:
- Caching vocational facts
- Batch recommendation generation
- Async save (generate -> show draft -> save in background)

---

## Next Steps

1. **Staff Training**: Show team the new Coaching tab
2. **Feedback**: Collect early feedback on recommendation quality
3. **Refinement**: Adjust LLM prompt based on real use cases
4. **Integration**: Link coaching plans to job application workflow
5. **Analytics**: Track which coaching recommendations lead to job placements