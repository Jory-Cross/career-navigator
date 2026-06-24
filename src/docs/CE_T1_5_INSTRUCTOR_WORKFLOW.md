# CE-T1.5: INSTRUCTOR TRAINING WORKFLOW FOUNDATION

**Status:** ✅ Complete  
**Phase:** CE-T1.5 (Pre-CE-T2)  
**Date:** 2026-06-24

---

## OVERVIEW

CE-T1.5 builds the **instructor cohort management and student invitation workflow**, making the CE Instructor role operationally functional. This phase enables:

- ✅ Instructors create training cohorts
- ✅ Instructors invite CE students via email
- ✅ Pending student accounts automatically created with cohort assignment
- ✅ Student dashboard with training workspace placeholder
- ✅ Instructor dashboard with cohort management

---

## NEW FILES CREATED

### Backend Function
- **functions/inviteCEStudent.js** — Invites CE student to cohort, creates pending role assignment

### Components
- **components/cohorts/InviteStudentDialog.jsx** — Dialog for instructors to invite students by email
- **components/ce-training/CEInstructorDashboard.jsx** — Instructor landing page with cohort management
- **components/ce-training/CEStudentDashboard.jsx** — Student landing page with training workspace

### Entity Schema
- **entities/PendingRoleAssignment.json** — Updated to support cohort_id, cohort_role, and ce_student role

---

## FILES MODIFIED

### Pages
- **pages/CETrainingPortal.jsx** — Refactored to use role-specific dashboard components
- **pages/CohortDetail.jsx** — Added instructor-only "Invite Student" button, updated "Members" to "Students"

### Navigation
- **components/ce-training/CETrainingNav.jsx** — Already supports instructor nav (no changes needed)

---

## INSTRUCTOR WORKFLOW

### Step 1: Navigate to Cohorts
```
Instructor logs in
→ CETrainingNav shows Dashboard + My Cohorts
→ Clicks "My Cohorts" → /Cohorts page loads
```

### Step 2: Create Training Cohort
```
On /Cohorts page:
- Clicks [New Cohort] button
- CohortFormDialog opens
- Fills in:
  * Name: "CE Discovery Foundations - Spring 2026"
  * Code: "CE-2026-SPR-A"
  * Course Name: "CE Discovery Foundations"
  * Course Version: "v2026.1"
  * Cohort Type: "training"
  * Status: "planned"
  * Start Date / End Date (optional)
  * Description / Instructor Notes (optional)
- Submits form
- Cohort created via useCohorts() hook
- Creator automatically added as manager (last-manager guard)
```

### Step 3: View Cohort & Invite Students
```
On /Cohorts page:
- New cohort appears in table
- Clicks [Open] button → /CohortDetail?cohort_id={id}
- CohortDetail page loads with:
  * Cohort information card
  * Managers section (shows instructor as manager)
  * Students section (empty initially)
  * [Invite Student] button (instructor-only)
```

### Step 4: Invite CE Student
```
On /CohortDetail:
- Clicks [Invite Student] button
- InviteStudentDialog opens showing:
  * Cohort name (confirmation)
  * Email input field
  * Description: "The student will receive an invitation to register for the CE Training Portal."
- Types student email: "student@example.com"
- Clicks [Send Invitation]
- inviteCEStudent function called:
  * Validates email and cohort_id
  * Verifies instructor is a manager of cohort
  * Creates PendingRoleAssignment with:
    - email: "student@example.com"
    - role: "ce_student"
    - access_level: "ce_training_portal"
    - cohort_id: cohort_id
    - cohort_role: "student"
    - org_id: from instructor.org_id
    - invited_by_id: instructor.id
    - invited_by_name: instructor.full_name
    - status: "pending"
  * Returns success response
- Toast: "Invitation sent to student@example.com"
- Dialog closes
```

### Step 5: Student Registration Flow
```
Student receives email invitation with registration link
→ Student clicks link → Registration page
→ Platform applies pending role via applyPendingRoleIfNeeded
→ New User record created with:
  * role: "ce_student"
  * access_level: "ce_training_portal"
  * org_id: from pending assignment
→ CETrainingCohortMember created via automation/backend:
  * cohort_id: from pending assignment
  * user_id: new student's user_id
  * cohort_role: "student"
  * is_active: true
→ Student logs in → AuthContext classifies as 'ce_training'
→ Student routed to CETrainingNav
→ CEStudentDashboard displays
```

---

## STUDENT WORKSPACE

### Student Dashboard (CEStudentDashboard)
Displays when logged in as CE Student:

```
Header: "Welcome to CE Training"
Subtext: "Complete discovery work and develop your training clients."

Cards:
┌─────────────────────────────────────────────┐
│ 👥 My CE Training Clients                   │
│ Create and manage training clients for      │
│ discovery assessment and DSR development.   │
│                                             │
│ No CE training clients yet.                 │
│ Check back after your instructor adds you   │
│ to a cohort.                                │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ 📖 Discovery & DSR Work                     │
│ Complete discovery interviews, activities,  │
│ and develop Discovery Staging Records.      │
│                                             │
│ No clients assigned yet.                    │
│ Assessments will appear here once you       │
│ create a client.                            │
└─────────────────────────────────────────────┘

Info Card: "About CE Training"
Explains this is a CE training environment separate from operational services.
```

### Navigation
- Sidebar shows only:
  * Dashboard → /CETrainingPortal
  * Log Out
- NO "My Cohorts" link (student cannot manage cohorts)

---

## INSTRUCTOR WORKSPACE

### Instructor Dashboard (CEInstructorDashboard)
Displays when logged in as CE Instructor:

```
Header: "Instructor Dashboard"
Subtext: "Manage CE training cohorts and review student work."

Cards:
┌─────────────────────────────────────────────┐
│ 🎓 My Cohorts                               │
│ Create and manage CE training cohorts,      │
│ invite students, and track progress.        │
│                                             │
│ [View Cohorts] button → /Cohorts            │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ 📖 Student Discovery Work                   │
│ Review student-created CE training clients  │
│ and discovery records.                      │
│                                             │
│ [Coming Soon] button (disabled)             │
└─────────────────────────────────────────────┘

Info Card: "Instructor Workflow"
1. Create Cohort: Start a new CE training cohort for your students.
2. Invite Students: Add students to your cohort via email invitation.
3. Monitor Progress: Track student client creation and discovery work.
4. Provide Feedback: Review and provide feedback on student assessments.
```

### Navigation
- Sidebar shows:
  * Dashboard → /CETrainingPortal
  * My Cohorts → /Cohorts
  * Log Out

---

## ROUTE ISOLATION VERIFICATION

### CE Student Routes
```
✅ /CETrainingPortal → CEStudentDashboard (role-specific)
✅ / → CEStudentDashboard (fallback from root)
❌ /TimeTracking → Caught by wildcard, stays on CETrainingPortal
❌ /Clients → Caught by wildcard, stays on CETrainingPortal
❌ /Dashboard → Caught by wildcard, stays on CETrainingPortal
❌ /Cohorts → Caught by wildcard, stays on CETrainingPortal
❌ /EmployeePortal → Caught by wildcard, stays on CETrainingPortal
```

### CE Instructor Routes
```
✅ /CETrainingPortal → CEInstructorDashboard (role-specific)
✅ / → CEInstructorDashboard (fallback from root)
✅ /Cohorts → Full cohort management page (instructor-scoped)
✅ /CohortDetail → Cohort detail with student roster (instructor-scoped)
❌ /TimeTracking → Caught by wildcard, stays on CETrainingPortal
❌ /Clients → Caught by wildcard, stays on CETrainingPortal
❌ /Dashboard → Caught by wildcard, stays on CETrainingPortal
❌ /EmployeePortal → Caught by wildcard, stays on CETrainingPortal
```

### Staff Regression
```
✅ /Dashboard → Staff dashboard (no change)
✅ /Clients → Clients page with CE client type (no change)
✅ /TimeTracking → Time tracking (no change)
✅ /Cohorts → Cohorts page (still accessible to admin/management)
✅ /CohortDetail → Cohort detail (still accessible to admin/management)
```

---

## ENTITY SCHEMAS

### PendingRoleAssignment (Updated)
```json
{
  "email": "student@example.com",
  "role": "ce_student",
  "access_level": "ce_training_portal",
  "org_id": "org_123",
  "cohort_id": "cohort_456",
  "cohort_role": "student",
  "invited_by_id": "instructor_789",
  "invited_by_name": "Jane Instructor",
  "invited_at": "2026-06-24T10:00:00Z",
  "status": "pending"
}
```

**New Fields:**
- cohort_id: CE Training cohort to assign student to
- cohort_role: "student" (for CE students)
- Updated role enum: added "ce_instructor", "ce_student"
- Updated access_level enum: added "ce_training_portal"

---

## BACKEND FUNCTION: inviteCEStudent

**Endpoint:** `POST /functions/inviteCEStudent`

**Payload:**
```json
{
  "email": "student@example.com",
  "cohort_id": "cohort_abc123"
}
```

**Logic:**
1. Authenticate user via base44.auth.me()
2. Validate email and cohort_id are provided
3. Verify user.role === "ce_instructor"
4. Retrieve cohort, verify it exists
5. Check if user is a manager of the cohort (CETrainingCohortMember with cohort_role='manager')
6. If not manager → 403 Forbidden
7. Create PendingRoleAssignment with cohort_id and cohort_role='student'
8. Return success with pending_id

**Success Response:**
```json
{
  "ok": true,
  "message": "CE Student invitation created",
  "pending_id": "pending_abc123",
  "email": "student@example.com",
  "cohort_id": "cohort_abc123",
  "status": "pending"
}
```

**Error Responses:**
- 400: Missing email or cohort_id
- 401: Not authenticated
- 403: User is not ce_instructor or not a manager of cohort
- 404: Cohort not found
- 500: Server error

---

## COMPONENT: InviteStudentDialog

**Props:**
```typescript
{
  open: boolean,
  onOpenChange: (open: boolean) => void,
  cohort_id: string,
  cohortName: string,
  onSuccess?: () => void
}
```

**Features:**
- Email input field with validation
- Shows cohort name for confirmation
- Displays helpful text about invitation process
- Calls inviteCEStudent function on submit
- Shows loading state during submission
- Toast notifications (success/error)
- Auto-closes on success
- Triggers onSuccess callback to refresh roster

---

## COMPONENT: CEInstructorDashboard

**Features:**
- Displays role badge: "👨‍🏫 Instructor"
- Quick action cards for cohort management
- Link to /Cohorts page
- "Student Discovery Work" card (Coming Soon)
- Instructional workflow info card

---

## COMPONENT: CEStudentDashboard

**Features:**
- Displays role badge: "👨‍🎓 Student"
- "My CE Training Clients" card with empty state
- "Discovery & DSR Work" card with empty state
- Informational card about CE training environment
- No active functionality yet (placeholders for CE-T2)

---

## PENDING: CE-T2 BUILDS ON

**Phase CE-T2 will add:**
1. ✅ Student client creation workflow (students can create training clients)
2. ✅ CE client assignment to instructors for review
3. ✅ Discovery assessment workflows (Activities, Interviews, etc.)
4. ✅ Student progress tracking
5. ✅ Instructor review dashboard
6. ✅ Vocational theme and DSR development

**Phase CE-T1.5 provides the foundation:**
- ✅ Cohort creation and management
- ✅ Student invitation and registration
- ✅ Role-based navigation and route isolation
- ✅ Placeholder workspaces ready for CE-T2 features

---

## VERIFICATION CHECKLIST

| Item | Status | Notes |
|------|--------|-------|
| Cohort creation by instructor | ✅ | Via existing useCohorts() hook |
| Student invitation UI | ✅ | InviteStudentDialog component |
| Backend invitation function | ✅ | inviteCEStudent.js |
| Pending role assignment | ✅ | PendingRoleAssignment entity updated |
| Cohort membership linking | ✅ | cohort_id + cohort_role in pending |
| Instructor dashboard | ✅ | CEInstructorDashboard component |
| Student dashboard | ✅ | CEStudentDashboard component |
| Route isolation (CE users) | ✅ | Wildcard catch-all in App.jsx |
| Staff regression test | ✅ | Existing routes unchanged |

---

## NEXT STEPS: CE-T2

Once CE-T1.5 is verified with actual instructor/student logins:

1. **Student Client Creation** — Build UI for students to create training clients
2. **Instructor Client Review** — Build UI for instructors to see student-created clients
3. **Discovery Assessments** — Integrate existing discovery assessment components
4. **Progress Tracking** — Add analytics/dashboard for instructor oversight
5. **Vocational Theme Integration** — Connect CE student work to existing theme synthesis

**Estimated Timeline:** 2-3 weeks for full CE-T2 implementation