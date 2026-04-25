# CRM Build Handoff — AI Job Search Recommendation Engine

## Completed

### Recommendation generation
- Generate Recommendations button works.
- Recommendation engine runs from AI Job Search only.
- Documents tab remains storage/viewing only.
- Recommendations now generate structured job cards with:
  - title
  - O*NET/temp code
  - score
  - matched keywords
  - match reason

### Persistence
- Recommendations now save to `JobRecommendationBatch`.
- Saved recommendations reload after refresh.
- Button regeneration updates the displayed recommendations.
- Refresh reloads latest saved batch correctly.

### Data flow fixed
- Resume skills are being pulled into the recommendation engine.
- Changing/deleting/uploading a resume changes `resume_skills`.
- WSA assessment detection was fixed:
  - actual stored type is `work_strategy_assessment`
  - detection now normalizes underscores to spaces
  - `WSA ASSESSMENTS FOUND` now returns the WSA record

## Current Issue

WSA is detected but its fields are not yet mapped into recommendation inputs.

Current `summarizeWsa` only uses:
- `strengths`
- `work_strengths`
- `best_work_tasks`
- `themes`
- `work_preferences`
- `preferred_tasks`

Those do not match the real WSA fields.

## User-confirmed WSA fields AI should consider

Use these for intelligent recommendations:

- Current work skills
- Work Skill Development Needs
- Interpersonal/social skills
- Identified assistive technology needs
- Communication needs
- Behavioral/self-regulation
- Family issues/supports
- Criminal Background
- School Academic
- Worksite simulation observations
- Natural support assessment
- Computer skill assessment
- Other observations

Do NOT use:
- Recommended target occupations
- Life skills needed
- Worksite simulation location itself

Important note:
- Worksite simulation **observations/notes** matter.
- Worksite simulation **location** does not.

## Required direction

AI recommendations should combine:

- resume skills
- WSA fields above
- O*NET Interest Profiler / RIASEC
- other saved assessments

Each recommendation should include specific reasons tied back to the available data.

## Current best next step

Open:

src/lib/recommendations/buildRecommendationInputs.js

Update:

summarizeWsa()

Goal:
Map real WSA response keys into:
- strengths / positive fit signals
- barriers / support needs
- themes / work preferences
- assessment keywords

Do this one step at a time.

## Development rules

- Do not break working generation/persistence.
- One file at a time.
- Exact code only.
- If a question/idea comes up, decide if it is the right time.
- If not right time, add to backlog and keep build focused.
