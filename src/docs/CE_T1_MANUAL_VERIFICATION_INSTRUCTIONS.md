# CE-T1 MANUAL VERIFICATION INSTRUCTIONS

**Status:** Test users created and pending activation  
**Next Step:** Invite users via platform admin dashboard

---

## TEST USERS TO ACTIVATE

### Pending CE Instructor
```
Email:         ce-instructor-test@example.com
Role:          ce_instructor
Access Level:  ce_training_portal
Pending ID:    6a3b1ddcda12ef4b9e250f44
Status:        PENDING INVITATION
```

### Pending CE Student
```
Email:         ce-student-test@example.com
Role:          ce_student
Access Level:  ce_training_portal
Pending ID:    6a3b1ddca2086107fa39ff24
Status:        PENDING INVITATION
```

---

## STEP 1: INVITE TEST USERS (Admin Dashboard)

**To activate test users for login:**

1. Log in to app as **Admin** (current user)
2. Navigate to **Employees** page (or invite flow)
3. Send invitations to:
   - `ce-instructor-test@example.com`
   - `ce-student-test@example.com`
4. Users receive email invitations
5. Users click link, register, and create password

---

## STEP 2: VERIFICATION TEST SUITE

### TEST 2.1: CE INSTRUCTOR LOGIN & NAVIGATION

**Steps:**
1. Open app in **new incognito/private window**
2. Log out of current admin session (if needed)
3. Log in with: `ce-instructor-test@example.com` / (password from registration)
4. Capture screenshot of landing page

**Expected Results - Screenshot 1: CE Instructor Portal**
```
✅ URL: /CETrainingPortal (or /)
✅ Header text: "🎓 CE Training Portal"
✅ Badge: "👨‍🏫 Instructor"
✅ Sidebar shows:
   - Dashboard
   - My Cohorts ← INSTRUCTOR ONLY
   - Log Out
✅ Main content shows:
   - Card 1: "👥 My Cohorts" with [View Cohorts] button
   - Card 2: "📖 Student Discovery Work" (Coming Soon)
✅ Bottom info card: "This is a dedicated CE (Customized Employment)..."
```

---

### TEST 2.2: CE INSTRUCTOR - STAFF ROUTE BLOCKING

**Steps (after logged in as CE Instructor):**
1. In browser address bar, navigate to: `/Dashboard`
2. Capture screenshot of result
3. Repeat for:
   - `/Clients`
   - `/TimeTracking`
   - `/EmployeePortal`

**Expected Results - Screenshots 2-5: Route Blocking**
```
✅ /Dashboard → Page stays on CETrainingPortal (NOT redirected to staff dashboard)
✅ /Clients → Page stays on CETrainingPortal (NOT showing Clients list)
✅ /TimeTracking → Page stays on CETrainingPortal (NOT showing time entry form)
✅ /EmployeePortal → Page stays on CETrainingPortal (NOT showing employee list)

All attempts default to CE portal (via wildcard catch-all route).
No access to staff pages.
```

---

### TEST 2.3: CE INSTRUCTOR - COHORTS LINK

**Steps (while logged in as CE Instructor):**
1. On CETrainingPortal, click [View Cohorts] button
2. Capture screenshot of Cohorts page

**Expected Results - Screenshot 6: Cohorts Access**
```
✅ URL: /Cohorts
✅ Page: Cohorts management page loads
✅ Content: Cohort list, instructor controls visible
✅ Can navigate back to dashboard
```

---

### TEST 3.1: CE STUDENT LOGIN & NAVIGATION

**Steps:**
1. Open **new incognito/private window**
2. Log out (if previous session active)
3. Log in with: `ce-student-test@example.com` / (password from registration)
4. Capture screenshot of landing page

**Expected Results - Screenshot 7: CE Student Portal**
```
✅ URL: /CETrainingPortal (or /)
✅ Header text: "🎓 CE Training Portal"
✅ Badge: "👨‍🎓 Student"
✅ Sidebar shows:
   - Dashboard
   - Log Out
   ❌ My Cohorts NOT SHOWN ← KEY DIFFERENCE FROM INSTRUCTOR
✅ Main content shows:
   - Card 1: "👥 My CE Training Clients" (Coming Soon)
   - Card 2: "📖 Discovery & DSR Work" (Coming Soon)
✅ Bottom info card: "This is a dedicated CE (Customized Employment)..."
```

---

### TEST 3.2: CE STUDENT - STAFF & INSTRUCTOR ROUTE BLOCKING

**Steps (after logged in as CE Student):**
1. In browser address bar, navigate to: `/Dashboard`
2. Capture screenshot of result
3. Repeat for:
   - `/Clients`
   - `/TimeTracking`
   - `/EmployeePortal`
   - `/Cohorts` (instructor-only)

**Expected Results - Screenshots 8-12: Route Blocking**
```
✅ /Dashboard → Page stays on CETrainingPortal
✅ /Clients → Page stays on CETrainingPortal
✅ /TimeTracking → Page stays on CETrainingPortal
✅ /EmployeePortal → Page stays on CETrainingPortal
✅ /Cohorts → Page stays on CETrainingPortal (student cannot access)

All attempts default to CE portal.
No access to staff pages.
No access to instructor pages.
```

---

### TEST 4.1: ADMIN/STAFF REGRESSION

**Steps:**
1. Log out of CE student account
2. Log back in with **admin account** (original user)
3. Capture screenshot of landing page

**Expected Results - Screenshot 13: Admin Dashboard**
```
✅ URL: /Dashboard
✅ Header: User name + "Admin" role selector
✅ Sidebar shows full staff navigation:
   - Dashboard
   - Clients
   - Job Seeker
   - Employed
   - Pre-ETS
   - DSPD
   - Customized Employment ← SHOULD STILL BE HERE
   - Employees
   - Calendar
   - Reports
   - Time Tracking
   - Tasks
   - Email Templates
   - AI Agents
   - CE Cohorts
   - My Organization
   - Permissions
   - Log Out
✅ Main content: Staff dashboard displays normally
```

---

### TEST 4.2: ADMIN - CLIENTS PAGE (Customized Employment)

**Steps (while logged in as Admin):**
1. Click **Clients** in sidebar
2. Filter to **Customized Employment** client type
3. Capture screenshot showing CE clients

**Expected Results - Screenshot 14: CE Clients Visible**
```
✅ Clients page loads
✅ Client type filter shows: Job Seeker, Employed, Pre-ETS, DSPD, Customized Employment
✅ Can select Customized Employment type
✅ CE clients list displays
✅ No regression in staff functionality
```

---

### TEST 4.3: ADMIN - TIME TRACKING

**Steps (while logged in as Admin):**
1. Click **Time Tracking** in sidebar
2. Capture screenshot

**Expected Results - Screenshot 15: Time Tracking Works**
```
✅ TimeTracking page loads
✅ Can access time entry forms
✅ No regression
```

---

### TEST 4.4: ADMIN - CLIENT DETAIL WITH CE PANEL

**Steps (while logged in as Admin):**
1. Click any CE client to open ClientDetail page
2. Scroll to find Customized Employment panel
3. Capture screenshot showing CE panel

**Expected Results - Screenshot 16: CE Panel in ClientDetail**
```
✅ ClientDetail page loads
✅ All tabs visible (Overview, Assessments, Time Log, etc.)
✅ Customized Employment panel visible
✅ Discovery Evidence section accessible
✅ No regression in existing CE features
```

---

## SUMMARY CHECKLIST

| Test | Screenshot | Expected | Result |
|------|-----------|----------|--------|
| CE Instructor Portal | 1 | Instructor nav, Cohorts visible | ☐ PASS / ☐ FAIL |
| CE Instructor /Dashboard | 2 | Stays on CETrainingPortal | ☐ PASS / ☐ FAIL |
| CE Instructor /Clients | 3 | Stays on CETrainingPortal | ☐ PASS / ☐ FAIL |
| CE Instructor /TimeTracking | 4 | Stays on CETrainingPortal | ☐ PASS / ☐ FAIL |
| CE Instructor /EmployeePortal | 5 | Stays on CETrainingPortal | ☐ PASS / ☐ FAIL |
| CE Instructor /Cohorts | 6 | Cohorts page loads | ☐ PASS / ☐ FAIL |
| CE Student Portal | 7 | Student nav, NO Cohorts link | ☐ PASS / ☐ FAIL |
| CE Student /Dashboard | 8 | Stays on CETrainingPortal | ☐ PASS / ☐ FAIL |
| CE Student /Clients | 9 | Stays on CETrainingPortal | ☐ PASS / ☐ FAIL |
| CE Student /TimeTracking | 10 | Stays on CETrainingPortal | ☐ PASS / ☐ FAIL |
| CE Student /EmployeePortal | 11 | Stays on CETrainingPortal | ☐ PASS / ☐ FAIL |
| CE Student /Cohorts | 12 | Stays on CETrainingPortal | ☐ PASS / ☐ FAIL |
| Admin Dashboard | 13 | Full staff nav visible | ☐ PASS / ☐ FAIL |
| Admin Clients (CE filter) | 14 | CE clients visible | ☐ PASS / ☐ FAIL |
| Admin TimeTracking | 15 | Page loads normally | ☐ PASS / ☐ FAIL |
| Admin ClientDetail + CE Panel | 16 | CE panel visible | ☐ PASS / ☐ FAIL |

---

## SIGN-OFF TEMPLATE

```
CE-T1 MANUAL VERIFICATION SIGN-OFF
===================================

Test Date:              _________________
Verified By:            _________________
Test Environment:       ☐ Preview ☐ Staging ☐ Production

Test Results:
  ☐ All 16 tests PASSED
  ☐ Some tests failed (see notes below)

Screenshots Captured:   ☐ Yes (all 16)    ☐ Partial    ☐ None

Critical Issues:
  ☐ None found
  ☐ Issues found:
    _________________________________________________________________

Overall Verdict:
  ☐ CE-T1 VERIFIED ✅ — Ready to proceed to CE-T2
  ☐ CE-T1 FAILED ❌ — Issues need resolution before CE-T2

Notes:
_________________________________________________________________
_________________________________________________________________

Approved:               _________________
Date:                   _________________
```

---

## NOTES FOR VERIFICATION

1. **Test user emails must be invited first** — pending users cannot log in
2. **Incognito/private windows** recommended to avoid cached sessions
3. **Screenshots** should show URL bar (to confirm route blocking)
4. **Sidebar visibility** is key — CE users should NOT see staff nav
5. **Wildcard catch-all** (route `/*` → CETrainingPortal) proves isolation
6. **Admin regression** confirms existing features unchanged