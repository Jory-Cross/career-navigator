# Career Navigator — Project Handoff

## Core Product Direction

- This is a **Career Intelligence Platform**, not a basic job matcher
- The system combines:
  - O*NET data
  - Client assessments
  - Resume data
  - AI reasoning

---

## Source of Truth Rules

- **O*NET is the source of truth** for:
  - Interest assessment (Interest Profiler)
  - Baseline career recommendations
  - Occupation data

- Do NOT build custom RIASEC scoring systems beyond temporary placeholders

---

## Architecture Rules

- Use **adapter pattern** for all external integrations
- Never couple UI directly to external APIs
- All external services must go through:
  - `/src/lib/adapters/`

Current adapters:
- `onetAdapter.js`
- `recommendationAdapter.js`

---

## Security Rules (Future)

- O*NET credentials MUST move to backend (server-side)
- Never expose credentials in frontend long-term
- Current hardcoded credentials are TEMPORARY for Base44 testing

---

## Assessment Strategy

The system will support multiple assessments:

- O*NET Interest Profiler (primary)
- Picture Profiler (existing tool)
- WSA
- Other assessments (ADL, communication, barriers, etc.)

All assessments feed into a **unified client profile**

---

## Recommendation System

Current flow:
