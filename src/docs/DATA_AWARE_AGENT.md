# Data-Aware AI Agent Architecture

The data-aware agent (`dataAwareAgent.js`) enforces a strict data-first design: **no AI response without loaded client data**. All recommendations are grounded in stored records, and all outputs are persisted to the database.

## Design Principles

### 1. No Generic Responses

Every recommendation must be justified by specific client data:
- ❌ "You might be good at retail jobs"
- ✅ "Your assessment shows strong customer service skills, and your 3 retail applications have all reached interviews. Retail management is a logical next step."

### 2. Data Loading Before LLM

```
Request → Load Client Context → Validate Data → Build Prompt → LLM → Store Results → Response
```

### 3. Persistent Outputs

All AI-generated content is stored:
- **Job Recommendations** → `JobRecommendation` table
- **Summaries & Plans** → `ClientDocument` table
- **Action Items** → `Task` table

## API Endpoints

### POST /dataAwareAgent

**Required Body:**
```json
{
  "action": "job_recommendations" | "progress_summary" | "service_suggestions" | "coaching_plan",
  "clientId": "client_abc123"
}
```

**Optional:**
```json
{
  "force": true  // Skip data validation (use with caution)
}
```

## Supported Actions

### 1. `job_recommendations`

Generates 5-7 job recommendations grounded in vocational data.

**Data Used:**
- Vocational facts profile
- Assessment responses
- Time entry history
- Employment goals
- Work barriers
- Current job applications

**Output:**
- Returns `JobRecommendation[]` records
- Each record includes:
  - `job_title` - specific role
  - `employer` - industry/type
  - `fit_reason` - why it fits (data-driven)
  - `fit_score` - 0-100
  - `support_strategy` - accommodations needed
  - `batch_id` - groups related recommendations
  - `assessments_used` - IDs of assessments that informed this
  - `client_fields_used` - fields referenced (vocational_facts_profile, goals, barriers)

**Example:**

```javascript
const result = await base44.functions.invoke('dataAwareAgent', {
  action: 'job_recommendations',
  clientId: 'client_123'
});

// Returns:
{
  success: true,
  action: 'job_recommendations',
  batch_id: 'batch_1712869200000',
  recommendations: [
    {
      id: 'rec_xyz',
      job_title: 'Quality Assurance Technician',
      employer: 'Manufacturing',
      fit_reason: 'Your assessment shows strong attention-to-detail (97th percentile). 2 of your 3 job applications were QA roles.',
      fit_score: 87,
      support_strategy: 'Quiet work environment; written instructions preferred',
      assessments_used: ['assess_1', 'assess_2'],
      client_fields_used: ['vocational_facts_profile', 'target_role', 'barriers'],
      status: 'suggested',
      generated_by: 'agent@base44.com'
    },
    // ... 4-6 more recommendations
  ],
  reasoning: 'Based on [data], this client's profile suggests...'
}
```

### 2. `progress_summary`

Analyzes 30-day progress and generates a comprehensive summary.

**Data Used:**
- Time entry count and categories
- Recent activities
- Assessment completions
- Goal progress
- Application status changes
- Task completion rate

**Output:**
- Saves to `ClientDocument`
- Includes:
  - `situation_snapshot` - current state
  - `recent_progress` - specific achievements
  - `achievements` - wins
  - `barriers` - blockers
  - `engagement_level` - High/Medium/Low
  - `next_steps` - actionable recommendations

**Example:**

```javascript
const result = await base44.functions.invoke('dataAwareAgent', {
  action: 'progress_summary',
  clientId: 'client_123'
});

// Returns:
{
  success: true,
  action: 'progress_summary',
  document_id: 'doc_xyz',
  data: {
    situation_snapshot: 'John has been actively job searching for 6 weeks with 4 applications and 2 interviews completed.',
    recent_progress: [
      'Completed 2 assessment modules (career goals, skills audit)',
      'Logged 12 hours of job coaching and interview prep',
      'Applied to 4 positions in target industry'
    ],
    achievements: [
      'Advanced to second-round interview at TechCorp',
      'Completed resume workshop and updated profile'
    ],
    barriers: [
      'Limited transportation (causing 2 missed meetings)',
      'Interview anxiety (identified in assessment)'
    ],
    engagement_level: 'High',
    next_steps: [
      'Schedule follow-up with TechCorp hiring manager',
      'Book interview coaching for anxiety management',
      'Address transportation barrier with job coach'
    ]
  }
}
```

### 3. `service_suggestions`

Recommends additional services to accelerate progress.

**Data Used:**
- Time entry gaps (which services are underutilized)
- Identified skill gaps from assessments
- Job application barriers
- Current pending tasks

**Output:**
- Returns suggested services
- Creates `Task` records for each suggestion (auto-assigned to client)
- Includes urgency level and expected outcomes

**Example:**

```javascript
const result = await base44.functions.invoke('dataAwareAgent', {
  action: 'service_suggestions',
  clientId: 'client_123'
});

// Returns:
{
  success: true,
  action: 'service_suggestions',
  suggested_services: [
    {
      service_type: 'Interview Coaching',
      description: 'Personalized coaching to address interview anxiety',
      justification: 'Assessment identified moderate anxiety; 1 of 2 interviews resulted in no offer',
      urgency: 'Immediate',
      expected_outcome: 'Improved interview performance and job offer rate'
    },
    {
      service_type: 'Transportation Support',
      description: 'Explore transit options or job placement near residence',
      justification: 'Missed 2 meetings due to transportation barrier',
      urgency: 'Immediate',
      expected_outcome: 'Perfect attendance rate'
    },
    // ... more services
  ],
  created_tasks: [
    // Task records automatically created
  ],
  overall_strategy: 'Address immediate barriers (interview anxiety, transportation) first, then focus on skill development...'
}
```

### 4. `coaching_plan`

Designs a detailed 4-week coaching plan.

**Data Used:**
- Client barriers and goals
- Assessment results
- Work history and experience
- Current job search status
- Identified skill gaps

**Output:**
- Saves to `ClientDocument`
- Creates 4 weekly `Task` records
- Includes:
  - Week-by-week focus areas
  - Coaching goals with success criteria
  - Skills to develop
  - Job search strategy
  - Barrier mitigation plan

**Example:**

```javascript
const result = await base44.functions.invoke('dataAwareAgent', {
  action: 'coaching_plan',
  clientId: 'client_123'
});

// Returns:
{
  success: true,
  action: 'coaching_plan',
  document_id: 'doc_plan_xyz',
  plan_data: {
    week_1_focus: 'Foundation: Address interview anxiety through skill-building. 2 coaching sessions focused on mock interviews.',
    week_2_focus: 'Strategy: Develop targeted job search plan for QA roles. Research 5 target employers.',
    week_3_focus: 'Execution: Submit 3 applications. Practice interview responses specific to target companies.',
    week_4_focus: 'Momentum: Follow up on applications. Prepare for any scheduled interviews.',
    coaching_goals: [
      'Complete 8 coaching sessions',
      'Submit 3 quality applications',
      'Conduct 2 informational interviews',
      'Demonstrate interview readiness in mock session'
    ],
    skills_to_develop: [
      'Interview storytelling (STAR method)',
      'Salary negotiation',
      'Technical skill for QA roles'
    ],
    job_search_strategy: 'Target 5 mid-size tech companies in Denver metro. Focus on QA technician and quality analyst roles. Leverage LinkedIn and direct outreach.',
    barrier_mitigation: {
      'Interview anxiety': 'Weekly mock interviews with coach. Breathing techniques. Recorded feedback.',
      'Transportation': 'Prioritize remote-friendly roles. Map transit routes to top employer locations.',
      'Technical knowledge': '2 online courses in QA testing tools'
    },
    success_metrics: [
      '3+ applications submitted with personalized cover letters',
      'At least 1 second-round interview scheduled',
      'Improved confidence in mock interview scores',
      'Weekly meeting attendance 100%'
    ]
  },
  created_tasks: [
    // 4 weekly tasks created
  ]
}
```

## Data Validation

Before generating any AI response, the agent validates sufficient data exists:

```javascript
validateSufficientData(context)
// Returns:
{
  isValid: true/false,
  gaps: ['missing field names'],
  message: 'Insufficient data: [list]'
}
```

**Required Data Thresholds:**
- Client profile: Required
- Time entries: ≥1 record
- Assessments: ≥1 completed
- Structured answers: ≥1 ReportFieldAnswer record

**If data is insufficient:**
- Returns `422 Unprocessable Entity`
- Lists specific data gaps
- Instructs what data to collect

**To force processing:** Pass `force: true` (use with caution)

## Architecture: Three-Layer Design

### Layer 1: Data Loading

```javascript
loadClientContext(base44, clientId)
```

Loads ALL related data in parallel:
- Client profile
- Time entries (enriched with ReportFieldAnswers)
- Assessments (with full response data)
- Job applications
- Recommendations history
- Tasks
- Goals
- Documents
- Activities

### Layer 2: Context Building

```javascript
buildContextString(context)
```

Converts raw data into a comprehensive narrative:
- Client summary (profile, goals, barriers)
- Vocational facts (extracted from assessments)
- Time entry activity (last 10 entries)
- Structured report data (field answers by entry type)
- Job application history
- Pending tasks

### Layer 3: LLM Processing

```javascript
await base44.integrations.Core.InvokeLLM({
  prompt: contextStr + action-specific instructions,
  response_json_schema: action-specific schema
})
```

LLM receives:
- Full client context
- Action-specific instructions
- JSON schema for structured output

## Data Storage Pattern

All AI outputs follow this pattern:

**JobRecommendation:**
```javascript
{
  client_id,
  job_title,
  employer,
  fit_reason,        // Always includes "Based on..."
  fit_score,
  support_strategy,
  status: 'suggested',
  generated_by: user.email,
  batch_id,          // Links related recommendations
  assessments_used,  // Which assessments informed this
  client_fields_used // Which client data fields
}
```

**ClientDocument:**
```javascript
{
  client_id,
  title: 'AI-Generated [Type] - [Date]',
  file_url,          // Base64-encoded JSON
  category: 'reference',
  tags: ['ai-generated', '...'],
  notes: 'Based on [N] time entries, [N] assessments...'
}
```

**Task:**
```javascript
{
  client_ids: [clientId],
  title: 'From AI suggestion or coaching plan',
  description: 'Includes rationale and expected outcome',
  status: 'pending',
  priority: 'high' | 'medium',
  due_date: calculated based on urgency
}
```

## Usage Example: Complete Flow

```javascript
import { base44 } from '@/api/base44Client';

// 1. Client requests job recommendations
const result = await base44.functions.invoke('dataAwareAgent', {
  action: 'job_recommendations',
  clientId: 'client_123'
});

// 2. Agent loads all context
// 3. Agent validates sufficient data
// 4. Agent builds narrative context
// 5. Agent calls LLM with instructions: "Generate 5-7 recommendations based on ONLY this data"
// 6. LLM returns structured recommendations
// 7. Agent saves each recommendation to JobRecommendation table
// 8. Returns array of saved JobRecommendation records

// 9. Client can view recommendations in UI
// 10. Client can mark as 'saved' or 'applied'
// 11. Agent can later generate service suggestions based on what happened
```

## Best Practices

### 1. Data-First Prompting

ALWAYS include the context string in the prompt:

```javascript
const prompt = `Based on the following client data:

${contextStr}

[Your specific instruction]

CRITICAL: Every recommendation must be justified by specific data above.`;
```

### 2. Schema Enforcement

Use JSON schemas to force structured output:

```javascript
const schema = {
  type: 'object',
  properties: {
    recommendations: {
      type: 'array',
      items: {
        properties: {
          job_title: { type: 'string' },
          why_fit: { type: 'string', description: 'Specific reasons from data' }
        }
      }
    }
  }
};
```

### 3. Store Everything

Never generate and discard:

```javascript
// Create a JobRecommendation record for EVERY recommendation
for (const rec of (llmResult.recommendations || [])) {
  await base44.asServiceRole.entities.JobRecommendation.create({...});
}
```

### 4. Audit Trail

Always include:
- `generated_by: user.email`
- `batch_id` (for grouping)
- `assessments_used` (which data sources)
- `client_fields_used` (what was referenced)

### 5. Document Notes

When saving documents, include data provenance:

```javascript
notes: `Based on ${timeEntries.length} time entries, ${assessments.length} assessments, and ${goals.length} goals. Generated by ${user.email}.`
```

## Error Handling

### Insufficient Data (422)

```json
{
  "error": "Insufficient data",
  "message": "Unable to generate recommendations without required data.",
  "gaps": [
    "No time entries logged",
    "No structured report answers"
  ]
}
```

**Resolution:** Collect data, then retry.

### Client Not Found (404)

```json
{
  "error": "Client not found"
}
```

**Resolution:** Verify clientId is correct.

### LLM Error (500)

```json
{
  "error": "LLM service error",
  "message": "[Error details]"
}
```

**Resolution:** Check prompt formatting and schema validity.

## Testing

### Unit Test: Data Validation

```javascript
const context = {
  client: {...},
  timeEntries: [],  // Empty!
  assessments: [...],
  fieldAnswers: [...]
};

const validation = validateSufficientData(context);
assert.isFalse(validation.isValid);
assert.includes(validation.gaps, 'No time entries logged');
```

### Integration Test: Full Flow

```javascript
const result = await base44.functions.invoke('dataAwareAgent', {
  action: 'job_recommendations',
  clientId: 'client_test_123'
});

assert(result.success);
assert(result.recommendations.length > 0);
assert(result.batch_id);
assert.all(result.recommendations, r => r.fit_reason.includes('Based on'));
```

## Roadmap

- [ ] Batch recommendation generation (multiple clients)
- [ ] Real-time recommendation updates (as new data arrives)
- [ ] Confidence scoring based on data quality
- [ ] Multi-language support for diverse client populations
- [ ] Integration with labor market data APIs