
- `recommendationAdapter.js` controls orchestration
- `onetAdapter.js` defines external data contract
- Local recommendation logic = fallback only

---

## AI Job Coach

Reads:
- Resume data
- WSA data
- Other assessments
- O*NET recommendations

Outputs:
- Narrative explanation
- Job fit reasoning
- Suggested directions
- Future: job application guidance

---

## Data Model (Recommendation Batch)

Key fields:

- `client_id`
- `active_sources`
- `source_resume_ids`
- `source_wsa_ids`
- `source_other_assessment_ids`
- `wsa_summary`
- `combined_profile`
- `recommendations`
- `onet_summary`
- `ai_coach_summary`
- `status`
- `reviewed_by`
- `approved_recommendation`

---

## Assessments Strategy

System supports multiple assessment types:

- O*NET Interest Profiler (future primary)
- Picture Profiler (existing tool)
- WSA
- ADL / barriers / communication / travel

### Key rule:

- NOT all assessments map to RIASEC
- All assessments contribute to a **unified client profile**

---

## Current Completed Work

- Removed custom RIASEC dependency from logic
- Built recommendation adapter
- Built O*NET adapter (frontend stub)
- Wired AI Job Coach
- Added recommendation batch system
- Added review/approval workflow
- Report modal shows:
  - O*NET Summary
  - Assessment Summary
  - AI Job Coach Summary
  - Recommendations

---

## Current Limitation (IMPORTANT)

- O*NET API call fails in frontend due to CORS
- This is NOT a bug
- This is an architectural boundary

---

## Next Phase (HIGH PRIORITY)

1. Create Base44 backend function for O*NET
2. Route adapter → backend function
3. Enable real O*NET data
4. Replace placeholder responses

---

## Upcoming Features

- O*NET Interest Profiler integration
- Job links (live job openings)
- AI-assisted job application guidance
- Unified client profile engine
- Multi-source job intelligence (future)

---

## Long-Term Vision

- AI-driven career intelligence platform
- Disability-aware job matching
- Multi-tenant system for providers
- Full career lifecycle support (assessment → placement → retention)

---

## Developer Instructions (ChatGPT)

- Give ONE step at a time
- Provide EXACT file paths
- Provide FULL code blocks (no fragments)
- Keep explanations minimal
- Do NOT reintroduce RIASEC logic
- Favor adapter + backend architecture
- Do NOT suggest frontend API calls to O*NET


All assessments feed into a **unified client profile**

---

## Recommendation System

Current flow:
