## Phase Status: Recommendation Engine + AI Job Coach (COMPLETE BASELINE)

### Completed
- Recommendation generation, saving, and persistence
- WSA + assessment integration into recommendation inputs
- Weighted scoring model (resume vs WSA vs goals)
- Structured recommendation output (fit_strengths, fit_concerns, fit_level)
- AI Job Coach guidance generation
- AI guidance saved to JobRecommendationBatch.ai_coach_summary
- UI rendering of strengths/concerns with highlighting
- Recommendation persistence behavior (only updates on regenerate)

### Current Capabilities
- Uses resume + WSA + assessments to generate recommendations
- Produces explainable reasoning for each job
- Flags potential conflicts (basic keyword logic)
- Generates AI coaching summary per recommendation batch

### Known Gaps / Next Phase
- Constraint-aware reasoning (environment, social tolerance, pace)
- RIASEC integration into scoring
- Replace static JOB_PROFILES with O*NET or DB-driven roles
- Improve explainability with source attribution
- Activate staff review workflow (requires_staff_review, violations)
- Ensure documents generated in assessments appear in Documents tab

### Backlog
- Tailwind production setup
- React Router warnings
- Debug log cleanup
- Builder performance / latency
