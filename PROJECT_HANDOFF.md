🧠 WHAT I’VE LEARNED (CARRY FORWARD — CRITICAL)
🔴 How you need instructions
Exact file path
Exact line or block to find
Exact replacement
Clear start/end boundaries
No “find something like…”
No partial snippets when replacing logic
One step at a time
Never assume file structure — always use your current file
🔴 Build discipline

Always decide:

✅ Fix Now
📋 Backlog

Do NOT mix them
Do NOT derail current phase

🔴 Product direction (locked)

Recommendations are:

❌ NOT job applications
✅ Job fields / career paths

System must:

Guide workflow
NOT enforce rigid transitions

Staff must:

Have full flexibility
🔴 Phase 5 direction (important)
❌ No rigid workflow enforcement
✅ Task-driven client participation (later phase)
Client interaction drives system state
🧠 WHAT WAS LEARNED IN THIS CHAT
🔴 Key technical lessons
UI must never override data

Status must come ONLY from:

job.status
Any fallback logic breaks system behavior
Batch vs Recommendation state
Jobs have status ✅
Batch has status ❌ (was not updating)
These must be kept in sync
Client → Staff data flow
Client response must:
Save in batch JSON
Flow into staff mapping
Render in UI
Duplicate issues source
Not just batch duplication
Also UI mapping + merge behavior
Refresh vs real-time
Polling added (10s)
Works for now
No need for real-time infra yet
🔴 Strategic decision (VERY IMPORTANT)

👉 Stop deep testing until O*NET is integrated

Reason:

Current recommendations = partial / simulated
Status workflows depend on real recommendation structure
Testing now = false positives / wasted effort
✅ WHAT WAS ACCOMPLISHED (THIS CHAT)
🔧 Client Portal
✔ Shared recommendations display
✔ Removed duplicates (latest batch + dedupe)
✔ Fixed tab reset issue
✔ Client buttons:
Interested
Not Interested
✔ Immediate UI feedback (button state)
✔ Query invalidation instead of reload
🔧 Data Layer
✔ Added:
client_response
client_responded_at
✔ Status auto-update:
Interested → job_search_target
Not Interested → archived
🔧 Staff Side
✔ Client response now visible in recommendation card
✔ Fixed missing mapping (critical)
✔ Auto-refresh (polling every 10s)
🔧 Bugs Fixed
✔ Duplicate recommendations
✔ Tab switching on click
✔ Missing client response display
✔ Broken useEffect (syntax error)
✔ UI overriding status logic
⚠️ CURRENT STATE (IMPORTANT)
Working
Recommendation system stable
Client → staff interaction loop works
Status updates working at job level
UI reflects client interaction
No duplicates
No forced refresh
Not fully validated (INTENTIONAL)
Batch status updates (paused)
Full workflow logic validation
Job search target pipeline
AI job search integration

👉 These are waiting on O*NET

📋 WHAT STILL NEEDS TO BE DONE (BY PHASE)
🔵 Phase: O*NET Integration (BLOCKER)
Interest Profiler (RIASEC) live
O*NET job recommendations
MyNextMove integration
Replace fallback recommendation logic
🟣 Phase: Client Portal
Ensure:
Shared jobs reliably appear
Documents (client/both visibility) FIX
Add:
O*NET job detail view (later)
🟡 Phase: AI Job Search

Use:

status === "job_search_target"
Generate real job opportunities
Connect to O*NET occupation data
🟢 Phase: Task System (CORE FEATURE)
Client Task Assignment System
Replace workflow reliance on statuses
Tasks drive engagement
🟠 Phase: Market Research
When job_search_target:
Generate ~20 businesses
Not job postings
Outreach workflow
🔴 Phase: Data Quality
Resume parsing reliability
Missing data detection
Reprocessing tools
🧱 UPDATED HANDOFF DOC (DROP INTO NEXT CHAT)
Continue CRM build.
