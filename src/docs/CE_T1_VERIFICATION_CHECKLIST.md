# CE-T1 VERIFICATION CHECKLIST

**Date:** 2026-06-23  
**Status:** Ready for Verification Testing  
**Purpose:** Confirm route isolation and user experience for CE Training pathway

---

## SETUP INSTRUCTIONS

### Step 1: Prepare Test Users

Call the backend function to set up test user records:

```bash
POST /functions/createCETestUsers
```

This creates pending role assignments for:
- `ce-instructor-test@example.com` → `ce_instructor` role, `ce_training_portal` access
- `ce-student-test@example.com` → `ce_student` role, `ce_training_portal` access

### Step 2: Invite Test Users

Via your platform's user invitation system, send invitations to both test emails with the prepared roles and access levels.

### Step 3: Accept Invitations & Register

Each test user will:
1. Receive invitation email
2. Click the registration link
3. Set their password
4. Log in to the application

---

## VERIFICATION TEST CASES

### TEST 1: CE INSTRUCTOR LOGIN

**User:** ce-instructor-test@example.com  
**Role:** ce_instructor  
**Access Level:** ce_training_portal

**Expected Behavior:**

```
✅ SHOULD SEE:
  - CE Training Portal landing page
  - "CE Training Portal" header/branding
  - Role badge: "👨‍🏫 Instructor"
  - Sidebar navigation:
    * Dashboard
    * My Cohorts
    * [Log Out]
  - Main content:
    * Welcome card with cohort info
    * "My Cohorts" card → links to /Cohorts
    * "Student Discovery Work" card (placeholder)

❌ SHOULD NOT SEE:
  - Time Tracking (/TimeTracking)
  - Employee Portal (/EmployeePortal)
  - Standard Clients page (/Clients)
  - Reports (/Reports)
  - Calendar (/Calendar)
  - Dashboard (/Dashboard)
  - Any non-CE features in sidebar
```

**Verification Steps:**

1. Log in as ce-instructor-test@example.com
2. Confirm landing on `/CETrainingPortal`
3. Check URL bar shows CE Training Portal
4. Verify sidebar shows ONLY: Dashboard, My Cohorts, Logout
5. Try to navigate to `/TimeTracking` → should stay on CE portal or redirect
6. Try to navigate to `/EmployeePortal` → should stay on CE portal or redirect
7. Try to navigate to `/Clients` → should stay on CE portal or redirect
8. Confirm role badge shows "Instructor"

**Pass Criteria:** ✅ All confirmations pass

---

### TEST 2: CE STUDENT LOGIN

**User:** ce-student-test@example.com  
**Role:** ce_student  
**Access Level:** ce_training_portal

**Expected Behavior:**

```
✅ SHOULD SEE:
  - CE Training Portal landing page
  - "CE Training Portal" header/branding
  - Role badge: "👨‍🎓 Student"
  - Sidebar navigation:
    * Dashboard
    * [Log Out]
  - Main content:
    * Welcome card with cohort info
    * "My CE Training Clients" card (placeholder)
    * "Discovery & DSR Work" card (placeholder)

❌ SHOULD NOT SEE:
  - Time Tracking (/TimeTracking)
  - Employee Portal (/EmployeePortal)
  - Standard Clients page (/Clients)
  - Reports (/Reports)
  - Calendar (/Calendar)
  - Dashboard (/Dashboard)
  - "My Cohorts" option (management feature)
  - Any staff features
```

**Verification Steps:**

1. Log in as ce-student-test@example.com
2. Confirm landing on `/CETrainingPortal`
3. Check URL bar shows CE Training Portal
4. Verify sidebar shows ONLY: Dashboard, Logout
5. Confirm there is NO "My Cohorts" navigation item
6. Try to navigate to `/Cohorts` → should stay on CE portal or redirect (no cohort management for students)
7. Try to navigate to `/TimeTracking` → should stay on CE portal or redirect
8. Try to navigate to `/EmployeePortal` → should stay on CE portal or redirect
9. Confirm role badge shows "Student"

**Pass Criteria:** ✅ All confirmations pass

---

### TEST 3: ADMIN/STAFF LOGIN (REGRESSION TEST)

**User:** Existing admin or staff user  
**Role:** admin OR employee/management  
**Access Level:** staff OR admin

**Expected Behavior:**

```
✅ SHOULD WORK:
  - Landing on standard staff dashboard (/Dashboard)
  - Sidebar shows normal staff navigation:
    * Dashboard
    * Clients
    * Time Tracking
    * Reports
    * Calendar
    * Email Templates
    * Tasks
    * AI Agents
    * Employees (if management+)
    * Organization (if admin)
    * Permissions (if admin)
  - All staff features fully accessible
  - Time Tracking works
  - Clients page works
  - Employment Services workflows intact
  - Customized Employment features available
  - Reports generation works
```

**Verification Steps:**

1. Log in as existing admin or staff user
2. Confirm landing on `/Dashboard` (staff dashboard, NOT CE portal)
3. Verify standard staff navigation shows in sidebar
4. Click Time Tracking → page loads normally
5. Click Clients → standard clients view loads
6. Try accessing `/CETrainingPortal` → should redirect back to staff dashboard or 404 (not accessible to staff)
7. Verify "My Organization" or "Permissions" visible if admin
8. Confirm all staff features work as before

**Pass Criteria:** ✅ All confirmations pass; NO regression

---

### TEST 4: ROUTE ISOLATION VERIFICATION

**Purpose:** Confirm Auth context and App.jsx route protection works correctly

**Test Steps:**

```
1. CE Instructor:
   - Navigate to /TimeTracking → Should stay on CE Portal (/CETrainingPortal)
   - Navigate to /EmployeePortal → Should stay on CE Portal
   - Navigate to /Clients → Should stay on CE Portal
   - Navigate to /Dashboard (staff) → Should stay on CE Portal
   - Navigation to /Cohorts → SHOULD WORK (instructor management)
   - Navigation to /CohortDetail → SHOULD WORK (instructor view)

2. CE Student:
   - Navigate to /Cohorts → Should stay on CE Portal (no cohort management for students)
   - Navigate to /TimeTracking → Should stay on CE Portal
   - Navigate to /EmployeePortal → Should stay on CE Portal
   - Navigate to /Dashboard (staff) → Should stay on CE Portal
   - Any non-CE route → Should stay on CE Portal

3. Admin/Staff:
   - Navigate to /TimeTracking → SHOULD WORK
   - Navigate to /EmployeePortal → SHOULD WORK
   - Navigate to /Clients → SHOULD WORK
   - Navigate to /Dashboard → SHOULD WORK
   - Navigate to /CETrainingPortal → Should redirect or not accessible
```

**Pass Criteria:** ✅ All route isolation rules enforced

---

## SCREENSHOT REQUIREMENTS

Capture and include:

1. **CE Instructor Portal Landing**
   - URL: `/CETrainingPortal` or `/`
   - Shows: Portal header, role badge, sidebar with Dashboard + My Cohorts
   - Main content: Welcome cards

2. **CE Instructor Navigation**
   - Screenshot of sidebar showing ONLY Dashboard, My Cohorts, Logout

3. **CE Student Portal Landing**
   - URL: `/CETrainingPortal` or `/`
   - Shows: Portal header, role badge, sidebar with Dashboard only
   - Main content: Welcome cards

4. **CE Student Navigation**
   - Screenshot of sidebar showing ONLY Dashboard, Logout (no Cohorts option)

5. **Admin/Staff Dashboard (NO CHANGE)**
   - URL: `/Dashboard`
   - Shows: Standard staff dashboard
   - Sidebar shows full staff navigation (Time Tracking, Clients, Reports, etc.)

6. **Route Isolation Test (Attempted CE Student to /Cohorts)**
   - CE Student attempts navigation to /Cohorts
   - Result: Stays on CE Portal or shows restricted access

---

## PASS/FAIL CRITERIA

### MUST PASS (Critical):

- ✅ CE Instructor lands on CE Training Portal (not staff dashboard)
- ✅ CE Student lands on CE Training Portal (not staff dashboard)
- ✅ CE Instructor sidebar shows: Dashboard, My Cohorts, Logout only
- ✅ CE Student sidebar shows: Dashboard, Logout only (no Cohorts)
- ✅ CE Instructor CAN navigate to /Cohorts (instructor feature)
- ✅ CE Student CANNOT navigate to /Cohorts (management feature)
- ✅ CE users blocked from: /TimeTracking, /EmployeePortal, /Dashboard (staff), /Reports, /Calendar
- ✅ Admin/Staff still lands on /Dashboard
- ✅ Admin/Staff still sees full staff navigation
- ✅ Admin/Staff Time Tracking still works
- ✅ Admin/Staff Clients still works
- ✅ Admin/Staff Customized Employment features still available
- ✅ NO regression in staff workflows

### SHOULD PASS (High Priority):

- ✅ Role badges display correctly (Instructor/Student)
- ✅ Portal branding/header correct
- ✅ Info card displays about CE Training environment

---

## SIGN-OFF

**Verification Date:** _________________

**Tested By:** _________________

**Test Environment:** ☐ Local ☐ Staging ☐ Production

**Result:**
- ☐ PASS - All critical criteria met, CE-T1 verified
- ☐ FAIL - Issues found (document below)

**Issues Found (if any):**
```
[Document any failures here]
```

**Approved for Phase T2:** ☐ Yes ☐ No

**Next Steps:** [Phase T2 student client creation, discovery workflows, instructor dashboards]