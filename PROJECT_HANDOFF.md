🧠 HANDOFF — CRM TASK SYSTEM (POST-STABILITY + CLEANUP)
🔴 HOW TO WORK WITH YOU (LOCKED RULES)

Always provide:

Exact file path
Exact block start (unique line)
Exact block end (unique line)
Full replacement OR exact delete instructions

Never:

Say “find something like…”
Use vague markers like </div> without context
Give partial snippets for full replacements
Assume file structure

Process:

One step at a time
Stability > new features
If anything breaks → stop and fix immediately
🧠 WHAT HAS BEEN LEARNED (ALL CHATS)
Product Direction (LOCKED)
Tasks = driver of workflow (not statuses)
Client participation is required
Staff must have full flexibility
Recommendations ≠ applications
Architecture Direction (LOCKED)
Backend (Base44) = source of truth
UI must NOT be source of truth
Use adapter layer (clientPortalApi.js)
Avoid direct Base44 calls in UI where possible
Data Model (CURRENT STATE)
Task
- title
- description (task instructions)
- status
- priority
- due_date
- category
- client_ids
- checklist []
- client_notes
- staff_notes
- client_completed_at
- completed_at
- is_archived
System Behavior (CURRENT)
Client completes task → adds note → saved to client_notes
Staff sees:
client note
timestamps
completion indicator
Polling updates both sides
No refresh required for sync
Tab persistence works
🧠 WHAT WAS LEARNED IN THIS CHAT
🔴 Critical Debug Lessons
JSX errors came from:
misplaced checklist UI
rendering outside .map()
“Adjacent JSX elements” = missing wrapper OR wrong placement
Never insert UI blocks into list rendering without full context
🔴 Major Fixes Completed
Removed duplicate buildTaskPayload
Fixed API mapping (client_notes)
Fixed payload builder (data was being dropped)
Fixed client → staff note visibility
Fixed tab persistence
Fixed task counts (active vs archived)
Removed legacy notes from UI
Cleaned task data model
🔴 Key Insight

Problem was NOT UI — it was data flow + incorrect placement

✅ WHAT HAS BEEN ACCOMPLISHED
TASK SYSTEM — STABLE
Data Layer
createTask ✅
updateTask ✅
archiveTask ✅
deleteTask ✅
client_notes persisted correctly ✅
Staff Side
Create/edit tasks ✅
See client notes ✅
See completion timestamps ✅
Active vs completed separation ✅
Counts fixed ✅
Client Side
Complete task ✅
Add note (prompt) ✅
Notes sync to staff ✅
Live updates (polling) ✅
System Behavior
No refresh required for updates ✅
Tab persistence works ✅
Clean data model ✅
⚠️ CURRENT STATE (IMPORTANT)

You are now:

OUT OF INSTABILITY
INTO CONTROLLED FEATURE BUILD
🚧 WHAT NEEDS TO BE BUILT NEXT
PHASE 5 — TASK EXPERIENCE
1. Checklist System (NEXT STEP)
Staff creates checklist steps
Stored in task.checklist

Client behavior:

Checkbox per step
Auto status:
0 complete → pending
some complete → in_progress
all complete → ready to complete
Cannot complete until all steps done
2. Replace Prompt UX

Current:

window.prompt()

Replace with:

Modal
Structured note entry
3. Task UI Cleanup (IN PROGRESS)
description = instructions ✅
client_notes = feedback ✅
staff_notes = future
notes = removed from UI ✅
🟡 PLANNED (DO NOT BUILD YET)
Payload CMS Integration

Use for:

Task Templates
Onboarding flows
Reusable instructions
Assessment tasks
Checklist templates

DO NOT use for:

Task progress
Client-specific data
Status tracking
Future Data Model
TaskTemplate
- title
- description
- checklist
- category
- priority
- audience

OnboardingPlan
- name
- task_template_ids
🚫 BLOCKED / DO NOT TOUCH
O*NET integration
Recommendation engine accuracy
AI job search
🎯 NEXT STEP FOR NEW CHAT

Start with:

We are continuing CRM Task System.

System is stable.

Next step:
Add checklist UI to task dialog (create/edit only).

File:
src/components/client-detail/TasksSection.jsx

We will insert checklist BELOW the "Assigned Client" block.

I need:
Exact block start
Exact block end
Full replacement
💡 FINAL STATE

You now have:

Stable task system
Clean data model
Working client → staff sync
Proper architecture direction

👉 Next phase = structured task execution (checklists)
