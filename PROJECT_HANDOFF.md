## 2026-04-26 — O*NET / RIASEC / Documents Integration Update

### Completed
- Continued Phase 4 O*NET/RIASEC integration.
- Confirmed RIASEC must come from the official O*NET Interest Profiler.
- O*NET remains the source of truth for:
  - Interest Profiler / RIASEC
  - Job recommendations
  - Job exploration
  - Career details
  - Occupation data

### Files Updated
- `src/lib/onet/interestProfiler.js`
- `src/lib/onet/onetClient.js`
- `src/lib/recommendations/buildRecommendationInputs.js`
- `src/components/client-detail/AssessmentSection.jsx`
- `src/components/client-detail/DocumentsSection.jsx`
- `src/lib/api/clientPortalApi.js`

### Working Now
- O*NET Interest Profiler appears inside the existing Assessments tab.
- Interest Profiler saves to the `Assessment` entity.
- RIASEC profile is now detected by recommendations.
- O*NET answer string is now generated from saved answers.
- Documents tab now includes both:
  - real `Document` records
  - mapped `Assessment` records
- Existing WSA and Interest Profiler records now appear in Documents.
- Assessment records without files open in an in-app viewer instead of broken download.
- Interest Profiler viewer displays:
  - RIASEC Code
  - RIASEC Scores by category
  - Answers Completed

### Blocked
- Real O*NET API recommendation fetch is blocked until a Base44 serverless function can be created.
- Browser code cannot access Base44 secrets directly.
- Need Base44 function later using:
  - `ONET_USERNAME`
  - `ONET_PASSWORD`
  - possibly `ONET_API_KEY`

### Next Priority
Create server-side O*NET function when builder credits are available.

Goal:
- Call O*NET Interest Profiler careers endpoint server-side.
- Use real O*NET/My Next Move recommendations.
- Layer resume skills, WSA constraints, accommodations, transportation, schedule, and staff notes on top.

### Backlog / Later Cleanup
- Clean up Documents refresh/reprocess button or remove it if unnecessary.
- Add DialogDescription/accessibility cleanup for shadcn/Radix warnings.
- Improve assessment viewer formatting beyond raw JSON for WSA.
- Generate real PDFs later for assessments where needed.
- Remove debug console logs after pipeline is stable.
