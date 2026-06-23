# PHASE CE-T1: CE Training User Architecture

**Date:** 2026-06-23  
**Status:** Architecture & Permissions Complete  
**Scope:** User types, roles, permissions, navigation, and visibility rules for CE Training Portal

---

## User Roles Created

### CE Instructor (`ce_instructor`)
- **Access Level:** `ce_training_portal`
- **Portal:** CE Training Portal (dedicated)
- **Navigation:** Dashboard → My Cohorts → Student Review Work
- **Permissions:**
  - ✅ CE Training Portal access
  - ✅ Manage CE cohorts
  - ✅ Review student CE clients
  - ✅ Review student discovery work
  - ✅ Provide feedback on vocational themes
  - ✅ View student DSR development
  - ❌ Time Tracking
  - ❌ Employment Services
  - ❌ Staff dashboards

### CE Student (`ce_student`)
- **Access Level:** `ce_training_portal`
- **Portal:** CE Training Portal (dedicated)
- **Navigation:** Dashboard → My CE Clients → Discovery Work
- **Permissions:**
  - ✅ CE Training Portal access
  - ✅ Create CE training clients (future)
  - ✅ Conduct discovery assessments
  - ✅ Complete discovery interviews
  - ✅ Conduct discovery activities
  - ✅ Develop DSR
  - ✅ View instructor feedback
  - ❌ Time Tracking
  - ❌ Employment Services
  - ❌ Staff dashboards

---

## Entity Modifications

### User Entity
**New Fields:**
- `cohort_id` (string): CE Training cohort ID
- `cohort_role` (enum): `instructor` | `student` (role within cohort, independent of platform role)

**Updated Enum:**
- `role`: Added `ce_instructor`, `ce_student`
- `access_level`: Added `ce_training_portal`

### Client Entity
**New Fields (for CE Training clients):**
- `client_type`: Added `ce_training` enum option
- `created_by_student_id` (string): CE Student user ID who created this training client
- `assigned_instructor_id` (string): CE Instructor user ID assigned to oversee
- `cohort_id` (string): CE Training cohort this client belongs to
- `is_training_client` (boolean): Flag distinguishing training clients from operational

### FeaturePermission Entity
**Updated Enum:**
- `role`: Added `ce_instructor`, `ce_student`

**New Permission Rules:**

| Role | Feature | Visible | Category |
|------|---------|---------|----------|
| `ce_instructor` | `ce_training_portal` | ✅ | ce_training |
| `ce_instructor` | `ce_cohorts` | ✅ | ce_training |
| `ce_instructor` | `ce_student_review` | ✅ | ce_training |
| `ce_student` | `ce_training_portal` | ✅ | ce_training |
| `ce_student` | `ce_discovery_work` | ✅ | ce_training |

---

## Access Classification

**AuthContext.classifyUserAccess()** returns:
- `'staff'` — admin, management, employee with staff/admin access
- `'client_portal'` — client, pre_ets, dspd with client_portal access
- `'pre_ets_employer_portal'` — pre_ets_employer with pre_ets_employer_portal access
- `'ce_training'` — ce_instructor, ce_student with ce_training_portal access (**NEW**)
- `'denied'` — no valid role/access combination

---

## Route Protection

### Staff Routes (Require `staff` access)
- `/Dashboard`
- `/Clients`
- `/TimeTracking`
- `/Reports`
- `/EmployeePortal`
- All job coaching and life skills workflows
- All VR/DSPD management

### CE Training Routes (Require `ce_training` access)
- `/CETrainingPortal` (landing)
- `/Cohorts` (instructor: manage; student: view own)
- `/CohortDetail` (visibility scoped by cohort membership)

**Route Protection:** App.jsx checks `accessClass` and renders appropriate layout/navigation:
```javascript
if (accessClass === 'ce_training') {
  // Render CETrainingNav + CE routes only
  // Prevent access to staff routes
}
```

---

## Navigation

### CE Training Navigation (`CETrainingNav.jsx`)
- **Header:** CE Training Portal logo, user avatar, role badge
- **Sidebar:** Navigation varies by role
  - **Instructor:** Dashboard, My Cohorts
  - **Student:** Dashboard (future: My Clients, Discovery Work)
- **Logout:** Always available

### Landing Pages
- **CE Instructor:** `/CETrainingPortal` → Dashboard with cohort tiles
- **CE Student:** `/CETrainingPortal` → Dashboard with client tiles (future)

---

## Cohort Architecture (Prepared)

### CETrainingCohort Support
- ✅ Instructor ownership (via CETrainingCohortMember with cohort_role='manager')
- ✅ Student membership (via CETrainingCohortMember with cohort_role='member')
- 🔄 Future: Automatic student-created CE client association

### CETrainingCohortMember
- Maps users to cohorts with local cohort_role
- `cohort_role = 'instructor'` or `'member'` (independent of platform role)
- Instructors see all cohort members' clients
- Students see only their own clients

---

## Client Creation Architecture (Prepared)

### Future Student-Created Clients
When implemented, student client creation will:
1. Set `client_type = 'ce_training'`
2. Set `created_by_student_id = current_user.id`
3. Set `assigned_instructor_id = cohort_instructor_id`
4. Set `cohort_id = student_cohort_id`
5. Set `is_training_client = true`
6. Use distinct visibility rules (NOT operational client access)

### RLS Rules (Future)
- Students see only their own created clients
- Instructors see all student-created clients in their cohort
- Admins see all training clients

---

## Features NOT Included in T1

- Student client creation UI
- Instructor dashboards/analytics
- Student progress tracking
- Reports or analytics
- Additional vocational theme functionality
- Assessment assignment workflows

These are Phase T2+ deliverables.

---

## Seed Data

### Permissions
Run `seedCETrainingPermissions.js` to create feature permissions:
```bash
POST /functions/seedCETrainingPermissions
```

Creates:
- `ce_instructor` permissions: portal, cohort management, student review
- `ce_student` permissions: portal, discovery work

---

## Testing Scenarios

### Scenario 1: CE Instructor Login
1. User with role `ce_instructor`, access_level `ce_training_portal`
2. → Classified as `ce_training`
3. → Routes to `CETrainingNav`
4. → Dashboard shows cohorts
5. → Access to `/Cohorts` for management
6. → NO access to `/TimeTracking`, `/EmployeePortal`, `/Clients` (staff routes)

### Scenario 2: CE Student Login
1. User with role `ce_student`, access_level `ce_training_portal`
2. → Classified as `ce_training`
3. → Routes to `CETrainingNav`
4. → Dashboard shows placeholder for clients (future)
5. → NO access to staff routes or other portals

### Scenario 3: Staff Cannot Access CE Training
1. User with role `employee`, access_level `staff`
2. → Classified as `staff`
3. → Routes to normal staff layout
4. → `/CETrainingPortal` redirects to `/Dashboard` (not in their route set)

---

## Files Modified

1. **entities/User.json** — Added ce_instructor, ce_student roles; ce_training_portal access; cohort fields
2. **entities/Client.json** — Added ce_training client_type; training client fields
3. **entities/FeaturePermission.json** — Added ce_instructor, ce_student roles
4. **lib/AuthContext.jsx** — Updated classifyUserAccess to recognize ce_training
5. **App.jsx** — Added ce_training route handler with CETrainingNav wrapper
6. **pages/CETrainingPortal.jsx** — New CE Training landing page (NEW)
7. **components/ce-training/CETrainingNav.jsx** — New CE Training navigation (NEW)
8. **functions/seedCETrainingPermissions.js** — New permission seeder (NEW)
9. **docs/PHASE_CE_T1_ARCHITECTURE.md** — This documentation (NEW)

---

## Next Steps (Phase T2+)

- Build student client creation UI
- Implement discovery assessment workflows
- Implement DSR development interface
- Build instructor review dashboard
- Add instructor feedback mechanisms
- Create student progress tracking
- Implement CE Training analytics