# Normalized Job Search Tool

## Overview

The refactored `searchJobs` function provides a reusable, normalized job search interface for recommendation workflows. It focuses on **search and data normalization only**—no recommendation scoring, filtering, or AI logic.

## Architecture

```
Frontend/Backend
      ↓
[Normalized Search Input]
      ↓
searchJobs Function
      ├─ Input Validation
      ├─ Search Query Building
      ├─ JSearch API Call
      └─ Result Normalization
      ↓
[Normalized Results]
      ↓
jobSearchAssistant / Recommendation Workflows
      ├─ Grounding Analysis
      ├─ Fit Scoring
      ├─ Constraint Checking
      └─ Staff Review
```

## Input Format

```javascript
{
  // Required
  searchTerms: ["job title", "role", "keyword"],  // Array of search terms to combine
  location: "Denver, CO",                         // City, state, or region

  // Optional - with sensible defaults
  locationRadius: 50,                             // Miles radius (default: 50)
  workType: "any",                                // 'remote' | 'hybrid' | 'onsite' | 'any' (default: 'any')
  industries: ["healthcare", "tech"],             // Preferred industries for context (optional)
  payMin: 18,                                     // Minimum hourly rate (optional)
  payMax: 35,                                     // Maximum hourly rate (optional)
  schedule: "any",                                // 'part-time' | 'full-time' | 'any' (default: 'any')
  page: 1                                         // Pagination (default: 1)
}
```

## Output Format

```javascript
{
  success: true,
  search_params: {
    terms: ["Software Engineer"],
    location: "Denver, CO",
    location_radius: 50,
    work_type: "remote",
    industries: null,
    schedule: "full-time",
    pay_range: { min: 18, max: 35 }
  },
  results: [
    {
      // Identification
      id: "job_xyz123",
      title: "Senior Software Engineer",
      employer: "TechCorp Inc",

      // Location & Work Arrangement
      location: "Denver, CO",
      work_type: "remote",
      schedule: "full-time",

      // Compensation (normalized to hourly)
      pay: "$35-$50/hr",
      pay_min: 35,
      pay_max: 50,
      pay_period: "hourly",

      // Source Information
      source_url: "https://indeed.com/viewjob?jk=...",
      source_platform: "Indeed",
      posted_date: "2024-01-15T10:00:00Z",

      // Context for Analysis
      raw_description: "Full job description (first 500 chars)...",
      employer_logo: "https://...",
      job_type: "permanent"
    },
    // ... more jobs
  ],
  total: 8,
  page: 1
}
```

## Key Design Principles

### 1. **Minimal, Focused Responsibility**

- **Does**: Search job APIs, normalize field names, convert data formats
- **Does NOT**: Score jobs, filter by constraints, apply AI recommendations, grounding analysis

### 2. **Normalized Data Format**

All jobs returned with consistent field names and types, regardless of source:

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Platform-specific job ID |
| `title` | string | Job title from posting |
| `employer` | string | Company name |
| `location` | string | Formatted as "City, State" |
| `work_type` | 'remote'\|'onsite' | Inferred from job data |
| `schedule` | 'full-time'\|'part-time'\|null | Parsed from description |
| `pay` | string\|null | Readable format: "$35-$50/hr" |
| `pay_min` | number\|null | Hourly (converted from annual if needed) |
| `pay_max` | number\|null | Hourly (converted from annual if needed) |
| `source_url` | string | Direct link to apply |
| `source_platform` | string | Indeed, LinkedIn, Glassdoor, etc. |
| `posted_date` | string | ISO datetime |
| `raw_description` | string | First 500 characters |
| `employer_logo` | string\|null | Logo URL from source |

### 3. **No Input Filtering or Validation at Output**

Jobs are returned **exactly as normalized**, regardless of whether they match filter criteria. This allows downstream workflows to:
- Apply their own constraints
- Score based on grounding data
- Flag violations for review
- Make nuanced decisions

**Example**: A job might have `pay_min: 15` while request specified `payMin: 20`. The job is returned anyway—let the recommendation engine decide if it should be excluded.

### 4. **Pay Normalization**

All pay values converted to **hourly** for consistency:

```javascript
// Input: Annual salary $72,800
// Output: pay_min = 35 (assuming 2080 hours/year)

// Input: Hourly $25-$30
// Output: pay_min = 25, pay_max = 30

// Input: No pay data
// Output: pay = null, pay_min = null, pay_max = null
```

## Usage Examples

### Basic Search

```javascript
import { base44 } from '@/api/base44Client';

const results = await base44.functions.invoke('searchJobs', {
  searchTerms: ['Software Engineer', 'Developer'],
  location: 'Denver, CO'
});

console.log(`Found ${results.total} jobs`);
results.results.forEach(job => {
  console.log(`${job.title} at ${job.employer} (${job.location})`);
});
```

### Search with Filters

```javascript
const results = await base44.functions.invoke('searchJobs', {
  searchTerms: ['Marketing Manager'],
  location: 'Austin, TX',
  locationRadius: 25,
  workType: 'hybrid',
  schedule: 'full-time',
  payMin: 50,
  payMax: 80,
  page: 1
});
```

### Integration with Job Recommendation Workflow

```javascript
// Step 1: Perform raw search
const searchResults = await base44.functions.invoke('searchJobs', {
  searchTerms: clientProfile.target_roles,
  location: clientProfile.location,
  workType: filters.workType,
  payMin: filters.payMin,
  payMax: filters.payMax
});

// Step 2: Pass to recommendation engine (jobSearchAssistant)
const recommendations = await base44.functions.invoke('jobSearchAssistant', {
  action: 'save_recommendations',
  jobs: searchResults.results,  // Raw, unnormalized results
  profile: vocationalProfile,
  clientId: clientId
});
```

## Integration Points

### With `jobSearchAssistant`

The normalized results from `searchJobs` are designed to feed into `jobSearchAssistant.find_jobs`:

```javascript
// searchJobs returns: { results: [...], search_params: {...} }
// jobSearchAssistant expects: jobs array with these exact fields

// The normalized format ensures compatibility
```

### With Time Entry Forms

Use job data to pre-fill employer names in time entries:

```javascript
const job = searchResults.results[0];
timeEntryData.employer_name = job.employer;
timeEntryData.location = job.location;
```

### With VR Reports

Job search history can be tracked and included in client reports:

```javascript
// Store search results in client activity
await base44.entities.Activity.create({
  client_id: clientId,
  activity_type: 'job_search',
  data: {
    search_params: searchResults.search_params,
    results_count: searchResults.total
  }
});
```

## Error Handling

```javascript
try {
  const results = await base44.functions.invoke('searchJobs', {
    searchTerms: ['Engineer'],
    location: 'Denver, CO'
  });
  
  if (results.success) {
    console.log(`Found ${results.total} jobs`);
  }
} catch (error) {
  // Handle API errors, missing params, etc.
  console.error('Search failed:', error);
}
```

## Performance Considerations

- **Caching**: Consider caching results by search parameters for repeat queries
- **Pagination**: Default page=1 returns 1 page (~10-20 jobs). Use `page` param for more.
- **Rate Limiting**: JSearch API has rate limits. Implement backoff if needed.
- **Query Complexity**: Simpler searchTerms queries execute faster

## Future Enhancements

- [ ] Multi-source job APIs (LinkedIn, Glassdoor native APIs)
- [ ] Structured job classification (skill extraction, seniority level detection)
- [ ] Salary history trends
- [ ] Company reviews/ratings integration
- [ ] Saved search subscriptions

## Migration Guide

### From Old searchJobs to New

**Old function:**
```javascript
const result = await base44.functions.invoke('searchJobs', {
  query: 'Software Engineer in Denver',
  location: 'Denver, CO',
  page: 1
});
```

**New function:**
```javascript
const result = await base44.functions.invoke('searchJobs', {
  searchTerms: ['Software Engineer'],
  location: 'Denver, CO',
  workType: 'any',
  schedule: 'any',
  page: 1
});
```

**Key changes:**
- `query` → `searchTerms` (array)
- Input format now accepts separate parameters instead of a combined query string
- Output includes consistent field names and `search_params` metadata