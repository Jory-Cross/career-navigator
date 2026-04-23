# Career Navigator — Project Handoff (UPDATED)

## Core Product Direction

- This is a **Career Intelligence Platform**, not a basic job matcher
- The system combines:
  - O*NET data (primary source of truth)
  - Client assessments (WSA, ADL, barriers, etc.)
  - Resume data
  - AI reasoning (Job Coach)

---

## Source of Truth Rules

- **O*NET is the source of truth** for:
  - Interest assessment (Interest Profiler)
  - Baseline career recommendations
  - Occupation data

- Do NOT build custom RIASEC scoring systems beyond temporary placeholders

---

## Critical Architecture Decision (NEW)

### ❗ O*NET CANNOT be called from frontend

- Browser blocks O*NET requests due to CORS + Authorization header
- This is expected and correct behavior

### ✅ Required pattern


All assessments feed into a **unified client profile**

---

## Recommendation System

Current flow:
