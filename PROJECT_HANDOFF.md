CRM / Career Navigator Handoff — Current Build State
Critical instruction for next chat

The user needs exact, one-step-at-a-time instructions.

Do not say:

“replace the block”
“find something like”
“add this somewhere”
“update the function”

Unless the exact file and exact start/end block are known.

For code changes:

Ask for the current file first unless the file was just pasted.
Give exact file path.
Give exact block to find.
Give exact replacement.
Move one step at a time.
Use Base44 AI only for complex/backend/multi-file tasks. For small UI/code changes, give the user direct code instructions.

Stability matters more than speed.

What has been learned from previous chats
Project direction

The app is a multi-phase vocational CRM / career navigation system currently built in Base44.

Long-term direction:

Move out of Base44 when the platform is stable enough.
Reduce direct Base44 coupling where practical.
Use adapter/data-layer patterns where possible.
Payload CMS is the preferred future CMS direction unless the user changes direction.
O*NET is the future source of truth for Interest Profiler/RIASEC, occupation recommendations, job details, job zones, skills, work context, related occupations, and career intelligence.
User’s build preferences

The user does not code comfortably and needs very specific code instructions.

They prefer:

minimal explanation
exact code
no guessing file structure
no vague replacements
no unnecessary redesign
preserve working features
avoid changing unrelated systems
put side ideas into backlog instead of derailing current work
Recommendation system direction

The user wants one of the most powerful job recommendation tools possible.

Core concept:

O*NET / Interest Profiler gives a broad interest-based occupational universe.
VFP/FACTS narrows and refines based on real client facts.
Assessments, WSA, resume, documents, intake, staff notes, and O*NET all feed FACTS.
Recommendations later score jobs based on:
interests
skills
preferences
barriers
accommodations
transportation
schedule
stamina
sensory/environment needs
social tolerance
physical limitations
support needs
employer/environment fit

Important: do not hard-code recommendations around one person. Rules must generalize.

FACTS / VFP direction

FACTS/VFP must be multi-source.

It should synthesize the most accurate client facts from:

intake/onboarding
resume
WSA
assessments
documents
O*NET Interest Profiler
staff notes
future uploaded reports

Intake is one layer, not the source of truth.

Do not make the system intake-heavy.

Source tracking, confidence, conflicts, and data provenance matter.

What was learned in this chat
Access/security lifecycle

A major security and access lifecycle system was built/debugged.

Critical access rules now established:

role=user + blank access_level = denied
blank access_level = denied
client portal access requires:
role/client-type role
access_level = client_portal
valid linked_client_id
staff/admin CRM access requires staff/admin/management/employee role and proper staff/admin access
client portal users must never see the staff sidebar
Pre-ETS Employer role must be preserved and must not be downgraded by client portal cleanup
Important role/access types

Current important roles/access levels:

Staff/admin side:

admin
management
employee
staff/admin access levels as applicable

Client portal side:

client
pre_ets
dspd
access_level = client_portal

Pre-ETS employer side:

role = pre_ets_employer
access_level = pre_ets_employer_portal

Pre-ETS Employer is not the same as client portal. It must only access assigned Pre-ETS form/workflow later. Do not let repair/cleanup functions modify pre_ets_employer users.

Invite/access issue root cause

Several invite problems were debugged.

Root causes found:

autoAssignClientRole automation was creating incomplete PendingRoleAssignment records with only email/role and no access_level, org_id, or client_id.
That bad record was newer than the good invite record and caused wrong/blank access.
onUserRegistered was not enough because some users already existed or Base44 timing prevented upgrade.
A repair function was needed on login.
Some User records had data fields updated but top-level role still stayed user.
Client deletion versus archive behavior caused stale portal users.

Fixes made:

inviteClient creates valid assignments only.
applyPendingRoleIfNeeded handles existing users.
onUserRegistered and repair logic use valid assignments only.
incomplete pending assignments are ignored.
accepted assignments are preserved for audit instead of deleted.
PortalAccessPanel shows active/pending/revoked/stale states inside the app.
users can be invited, resent, revoked, repaired from app UI.
client portal flicker fixed by gating before staff layout/sidebar renders.
In-app access management requirement

All customer-facing admin/access work must be possible from inside the app.

Users should not need Base44 backend to:

approve users
assign roles
assign access
resend invite
revoke access
repair stale access
delete/deactivate portal user
view invite status
clean up stale pending assignments

This is now a product rule.

What was built in this chat
1. Client portal access management

Built/updated:

PortalAccessPanel
backend revoke/repair functions
invite resend handling
active portal user detection by linked_client_id
stale access detection
access lifecycle controls inside client record

Confirmed working:

invite email received
client logs into portal
Portal Access panel shows Active Portal User
Revoke/Resend controls available in app
client portal no longer flashes staff sidebar on login
2. Delete/archive/restore lifecycle

Built/updated:

archived clients now have separate:
Restore
Permanently Delete
active “Delete” still archives
archived “Restore” restores client but does not automatically restore portal access unless staff chooses access behavior
restore modal changed from useless status dropdown to portal access options:
do not restore portal access
restore as client portal user
restore as Pre-ETS client portal user
restore as DSPD client portal user
permanent delete removes/revokes related data where supported

Important behavior:

restoring client sets client active but does not automatically grant access unless staff selects that option
archive revokes client portal access
delete should clean all remnants
Pre-ETS employer users must not be touched by client portal cleanup
3. Intake/onboarding module

The user asked to convert intake packet into fillable onboarding forms.

Built by Base44 AI:

IntakeSection entity
section definitions in intake config
staff-facing IntakePacketPanel
client-facing intake section UI
per-section assignment to client
section progress
save-on-exit behavior instead of flashing autosave
fixed scroll behavior so left section list and right form scroll independently
medications repeatable list
release of information form
services agreement form
barriers AI clarify panel

Important intake sections mentioned:

basic info
VR/referral
employment goals
transportation
documents available
barriers/support
benefits
emergency contact
medications
release of information
services agreement
social supports
previous employment
education/training
references
interview prep
job keeping
vocational theme
application/employment
media release
4. Release of Information

Built as custom form.

Includes:

Community Options release statement
client name auto-fill
Yes/No toggles for:
name
disability/barriers
previous employment
skills/abilities/preferences
accommodations
resumes
emails
verbal communication
social media profiles
text messages
other social media
expiration date current date + 1 year
VR counselor progress/info language
additional individuals field
signature/date

Fixed issue:

client portal was not passing client prop, so name did not auto-fill on client side.
client prop now passes to forms.
5. Services Agreement

Built custom Community Options services agreement with:

client name blank auto-filled
missed appointments clause
reasonable employment refusal clause
termination by employer clause
signature/date section
6. Medications UI

Changed from one text box to repeatable medication cards.

Fields:

Medication Name
Dosage
Frequency / Time Taken
Used For / Purpose
Possible Side Effects
Work-related Impact or Concerns
Additional Notes

Medication mismatch logic:

there is a Yes/No field for “Currently Takes Medications?”
warning logic is being tuned
current direction:
No + real medication info should warn live
Yes + no real medication info should warn only on save, not immediately when Add Medication is clicked
empty medication card should not be treated as real medication info unless saving validation requires it

Important future direction:

medications themselves should not become a major VFP category
only confirmed employment-impacting side effects should feed VFP
no AI guessing side effects
later: medication lookup should show possible side effects from reliable medical source as checkboxes, and client/staff confirms which are actually experienced before those side effects feed FACTS/VFP

Backlog saved:

medication side-effect intelligence enhancement for later phase
7. New Client dialog scroll

Fixed directly in code:

dialog changed to sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col
form body made scrollable with overflow-y-auto pr-2 flex-1
footer buttons remain visible
8. Intake → VFP extraction pipeline

Built/debugged:

extractVFPFromIntake
onIntakeSectionCompleted
automation: Intake Completion → VFP Extraction
debugIntakeVFPPipeline
auditIntakeExtractionCoverage
auditBarriersAIClarifyPipeline

Major bugs fixed:

Client.read not available; changed to list/filter/find
completedSections undefined after rename to processableSections
extraction initially only processed completed sections; changed to process in_progress and completed
metadata fields were not saving; fixed metadata persistence
function wrapper missing/not deployed confusion
VFP display aliases expanded
extraction merge bug: fields from later sections overwrote earlier arrays; changed to merge arrays/dedupe instead of overwrite

Current pipeline works technically:

intake sections are found
in_progress sections are processed
VFP metadata saves
VFP fields increase
VFP panel displays more fields
9. VFP field display

Expanded VocationalFactsPanel display aliases to include intake-derived fields.

Now VFP categories can show:

barriers
accommodation_needs
support_needs
sensory_limitations
communication_style
social_tolerance
transportation_reliability
transportation_limitations
schedule_constraints
medication_side_effect_flags
stamina_endurance_concerns
safety_risk_flags
goals / work_goal_themes
preferred_tasks
work_environment_preferences
employer_preferences
social_supports
benefits_considerations
job_readiness_level
10. Extraction accuracy fixes

Several over-assumption problems were identified and corrected.

Transportation

Bad behavior:

client had Bus/Public transit + no license + no vehicle + paratransit
extractor incorrectly produced reliable_personal_vehicle

Fixed:

only set reliable personal vehicle if license and vehicle are both Yes
public transit/paratransit becomes transportation context
no license/no vehicle become transportation limitations
no transportation training/support unless explicitly stated

Correct direction:

relies_on_public_transit
no_driver_license
no_personal_vehicle
requires_scheduled_transportation
do not infer she needs transportation training/planning help
Benefits

Bad behavior:

all benefit questions were No
extractor treated field presence as truthy and added:
ssi_recipient
ssdi_recipient
medicare_coverage
medicaid_coverage
snap_recipient
ticket_to_work_enrolled

Fixed:

only create positive benefit facts when value is actually yes/true/enrolled/active
No/false/empty should not create benefit facts
optional no_current_benefits can be used
Barriers/Support

Leah’s barriers intake:

power wheelchair mobility
vision problems / near-sightedness
difficulty adjusting to major changes in routine independently
needs wheelchair accessibility at work/restroom
needs additional time/training to learn routines
communication can be slow when thinking
communicates well with customers at times
job coaching needed
moderate support
computer/job search/social media/email use

Extraction improved from generic social to:

mobility_limitations
visual_impairment
routine_change_difficulty
wheelchair_accessibility
extended_training_time
capable_customer_interaction
prefers_written_communication
structured / independent
moderate_support_needs
job_coaching_required
routine_learning_support
slower_processing_support
communication_support
extended_training_support
accessibility_support
open-ended support phrases

Current VFP Support Needs looked like:

moderate_support_needs
job_coaching_required
routine_learning_support
slower_processing_support
communication_support
extended_training_support
accessibility_support
ensure wheelchair accessibility to the workplace and restroom facilities
provide additional time and training for learning job task routines
offer job coaching to assist in adapting to work tasks and communication scenarios

This is much better but now needs UI cleanup.

Current state at end of chat
Access system

Mostly stable:

invite works
client portal login works
active portal status displays
archive/delete/restore behaviors mostly fixed
staff sidebar flicker fixed
Pre-ETS Employer role restored/protected

Still verify later:

permanent delete removes all related records cleanly
archive automation fires consistently
no stale portal users remain
restore access behavior works across client/pre_ets/dspd
Pre-ETS Employer users are never touched by repair/cleanup
Intake system

Mostly stable:

staff/client intake forms exist
save-on-exit works
section assignment works
custom ROI/services/medications work
medications warning logic currently being tuned

Immediate small item if continuing:

finish medication save-time validation behavior:
remove live Yes + empty card warning
only alert on Save if Yes and no real medication data
keep No + medication info live mismatch warning
Intake → VFP

Technically working:

extraction runs
fields save
metadata saves
display shows fields

Now in quality/audit phase:

avoid over-assumptions
avoid intake dominance
preserve facts from multiple sources
normalize intelligently
display readable facts

Current concern:

VFP UI is showing both internal tags and verbose phrases together.
Next cleanup should separate internal canonical tags from user-facing readable summaries.
What still needs to be built / fixed by phase
Current phase: VFP/FACTS extraction quality and display normalization

This is the next right focus.

1. Clean Support Needs display

Problem:
Support Needs currently shows internal tags and raw phrases mixed together.

Example current:

job_coaching_required
offer job coaching to assist in adapting to work tasks and communication scenarios
extended_training_support
provide additional time and training for learning job task routines

Desired:
User-facing VFP should show readable summaries:

Job coaching support
Additional training time for learning routines
Wheelchair-accessible workplace and restroom access
Communication/task adaptation support

Keep internal tags for scoring/recommendation logic, but do not show them raw in the staff-facing VFP unless using a debug/details view.

Task:

add display formatting layer to VocationalFactsPanel
convert internal snake_case tags to readable labels
dedupe canonical tag + phrase duplicates
group support needs by type if helpful:
Accessibility
Training/Routine
Communication
Transportation
Environmental/Sensory
Job Coaching
2. Continue section-by-section extraction accuracy audit

Audit in this order:

Barriers & Support
Medications
Employment Goals
Transportation
Benefits
Social Supports
Basic Info
Documents Available
Previous Employment
Education/Training

For each:

compare actual intake answer
compare extracted VFP facts
remove assumptions
add missed vocational implications
preserve raw/source metadata
3. Add conflict detection

Examples:

medications = No but medication list exists
medications = Yes but no medication details on save
transportation method public transit but vehicle/license marked yes/no inconsistently
benefits no/yes contradictions
resume vs intake conflict
WSA vs intake conflict
prefers independent but has strong customer-facing history
says no accommodations but barrier text implies accommodations

Current medication mismatch warning is a local UI start, but a broader VFP conflict engine should come later.

4. Make VFP multi-source

Do not let intake dominate.

FACTS should merge:

resume structured fields
documents
WSA
assessments
intake
O*NET
staff notes

Need:

source priority/confidence
conflict display
source-by-source evidence
“staff review needed” flags
avoid overwriting stronger facts with weaker intake data
Next phase: Recommendation engine integration

Only after VFP quality is stable.

Tasks:

recommendation generator should consume normalized FACTS/VFP
use O*NET/Interest Profiler as backbone
apply VFP constraints and preferences
avoid hard-coded client-specific rules
use configurable scoring/penalty/boost logic

Examples:

independent-work preference → lower score for constant customer-facing roles
animal interest → boost animal-related work
sensory limitation → flag loud/fast-paced environments
mobility limitation → flag physical/accessibility mismatches
transportation constraints → prefer accessible/reachable jobs
schedule constraints → filter or flag incompatible jobs
Later phase: O*NET integration

Needed:

live O*NET API
Interest Profiler source of truth
occupation details in app
clickable job titles
O*NET tasks/skills/work context/job zone
O*NET + FACTS combined fit analysis
Later phase: Client portal guided task workspace

Future direction:

client tasks should become guided workspace/course-like flow
left sidebar of steps
main panel action/form/document
progress badges
automatic completion where possible
not just manual checklist
Later phase: Medication intelligence enhancement

Saved to backlog:

when client enters medication, system retrieves common side effects from reliable medical source
shows checkboxes
client/staff confirms experienced side effects
only confirmed side effects feed VFP/recommendations
AI must not infer/guess side effects from medication name
Later phase: Base44 detachment / migration

Move out of Base44 when:

core CRM workflows are stable
entity model is clear
permissions/access model is stable
O*NET/VFP/recommendation architecture is mature enough
app needs stronger backend, audit logs, roles, and secure APIs

Future architecture should likely use:

Payload CMS
real backend/API layer
database with proper relations
secure server-side credentials
adapter patterns to avoid UI coupling

Add this to the CRM backlog / handoff notes:

Recommendation engine architecture direction is now locked:
O*NET is the broad occupational discovery layer, NOT the final decision-maker.
The system is intended to become a layered vocational intelligence platform, not a static scoring engine.
Recommendation flow should evolve as:
O*NET Interest Profiler generates broad occupational possibility space
VFP aggregates structured client intelligence from all assessments/documents
Additional assessments progressively refine vocational fit
AI synthesizes strengths, limitations, support needs, environment tolerances, work style, transportation, schedule, sensory needs, social tolerance, behavioral patterns, goals, and longitudinal observations
Final recommendation confidence increases as profile completeness/data quality increases
Current recommendation tuning should largely PAUSE after the recent plumbing fixes.
Core plumbing now exists:
structured resume ingestion
VFP persistence
O*NET integration
VFP → recommendation engine wiring
dynamic weighting foundation
conflict/fit architecture
Further heavy tuning right now will have diminishing returns because the assessment ecosystem is still immature.
Future recommendation improvements should come primarily from richer assessments and richer structured intake — NOT hardcoded occupation logic.
Avoid hardcoding “good jobs/bad jobs.”
Jobs should rise/fall dynamically based on extracted traits/preferences/tolerances from assessments and VFP.
Example:
independent/sensory-sensitive clients → public-facing/social jobs penalized
clients who enjoy social/public interaction → those same jobs boosted
animal-interest profiles → animal-related occupations boosted
logistics/detail-oriented profiles → inventory/warehouse/data-oriented jobs boosted
Future weighting should be trait-driven, not occupation-driven.
Current system state should be considered:
“O*NET + light personalization”
NOT yet “deep vocational fit intelligence”
Long-term architecture target:
semantic/vector occupational matching
cross-assessment synthesis
longitudinal profiling
adaptive confidence scoring
AI reasoning layers
dynamic trait weighting
occupation/environment compatibility modeling
support/accommodation-aware recommendation ranking
staff-observation influence
longitudinal employment success tracking feeding future recommendations
Current recommendation limitations are expected because VFP data is still relatively thin:
limited WSA depth
limited support/accommodation detail
limited environment/sensory data
limited behavioral/job tolerance data
limited transportation/schedule constraints
limited staff observational data
limited longitudinal outcomes
Recommendation engine should continue using:
VFP as primary intelligence layer
WSA as refinement layer
resume/job history as grounding layer
O*NET as occupational universe layer
future assessments as progressive fit refinement layers
Strategic guidance:
pause deep recommendation tuning until assessment ecosystem matures
focus future build phases on:
richer assessments
structured extraction
normalized trait modeling
support/accommodation intelligence
environment tolerance modeling
stronger VFP synthesis
longitudinal client intelligence architecture
Stabilize O*NET integration
Clean duplicate profiler handling
Improve recommendation confidence scoring
Improve VFP normalization/extraction
Then systematically eliminate missing-data warnings through better intake architecture

That is the correct order.
