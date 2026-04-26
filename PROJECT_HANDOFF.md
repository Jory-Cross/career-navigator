## 2026-04-26 — Interest Profiler / Documents Follow-up

### Completed
- Renamed assessment dropdown display from `riasec` to `Interest Profiler`.
- Replaced old `riasec` assessment key with `interest_profiler`.
- Interest Profiler now opens correctly from Assessments.
- Interest Profiler saves to the Assessment entity.
- New Interest Profiler records now appear in Documents.
- Fixed RIASEC score saving:
  - Scoring model outputs `R`, `I`, `A`, `S`, `E`, `C`
  - `saveInterestProfilerResult.js` now maps those into:
    - Realistic
    - Investigative
    - Artistic
    - Social
    - Enterprising
    - Conventional
- Documents viewer now shows structured Interest Profiler results.

### Still Open
- Documents delete/archive still fails for mapped Assessment records.
- Error happens because mapped assessment document IDs are prefixed with `assessment-`, but delete/archive calls still go through Document API.
- Need DocumentsSection to detect `assessment-*` IDs and delete from Assessment entity instead.

### Next Exact Task
File:
`src/components/client-detail/DocumentsSection.jsx`

1. Add:
`import { base44 } from "@/api/base44Client";`

2. Replace the full local `deleteDocument` function so:
- if `docId` starts with `assessment-`, remove prefix and call:
  `base44.entities.Assessment.delete(assessmentId)`
- otherwise call:
  `deleteClientDocument(docId)`

3. Test:
- Delete Interest Profiler from Documents
- Confirm it disappears from Documents
- Confirm it disappears from Assessments
- Confirm no console 404 error

### Important Chat Instruction Learned
Do not guess code shape.
Do not say “look for something like.”
If the exact code is not known, ask for the current file.
Use the latest pasted file as source of truth.
Do not revert to old zip state after the user has already made changes.
Give exact file path, exact block, and exact replacement only.
