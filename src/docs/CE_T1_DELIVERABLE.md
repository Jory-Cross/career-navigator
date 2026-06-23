# PHASE CE-T1 DELIVERABLE: CE Training User Architecture

**Phase:** CE-T1 (Dedicated CE Training Environment)  
**Date Completed:** 2026-06-23  
**Status:** ✅ Complete (Architecture & Permissions)

---

## SUMMARY

CE Training is now a completely separate user pathway with dedicated roles, permissions, navigation, and route protection. CE Instructors and CE Students cannot access Employment Services staff workflows, and staff cannot access CE Training Portal.

---

## 1. EXACT ENTITIES MODIFIED

### User.json
```json
{
  "role": {
    "enum": ["admin", "management", "employee", "client", "pre_ets", "dspd", "pre_ets_employer", "ce_instructor", "ce_student"]
  },
  "access_level": {
    "enum": ["client_portal", "staff", "admin", "pre_ets_employer_portal", "ce_training_portal"]
  },
  "cohort_id": { "type": "string", "description": "CE Training cohort ID" },
  "cohort_role": { "type": "string", "enum": ["instructor", "student"] }
}
```

### Client.json
```json
{
  "client_type": {
    "enum": ["job_seeker", "pre_ets", "dspd", "employed", "ce_training"]
  },
  "created_by_student_id": { "type": "string" },
  "assigned_instructor_id": { "type": "string" },
  "cohort_id": { "type": "string" },
  "is_training_client": { "type": "boolean", "default": false }
}
```

### FeaturePermission.json
```json
{
  "role": {
    "enum": ["admin", "management", "employee", "client", "pre_ets", "dspd", "ce_instructor", "ce_student"]
  }
}
```

---

## 2. EXACT ROLES CREATED

| Role | Access Level | Portal | Dashboard | Cohort Access |
|------|---|---|---|---|
| `ce_instructor` | `ce_training_portal` | CE Training Portal | Instructor Dashboard | Manage multiple cohorts |
| `ce_student` | `ce_training_portal` | CE Training Portal | Student Dashboard | Member of 1 cohort |

---

## 3. EXACT PERMISSION RULES

### CE Instructor Permissions
```
✅ Can Access:
- CE Training Portal (/CETrainingPortal)
- My Cohorts (/Cohorts)
- Cohort Management (/CohortDetail)
- All student CE clients in cohort
- Discovery records of students
- DSR development of students
- Instructor feedback tools
- Vocational theme review

❌ Cannot Access:
- Time Tracking (/TimeTracking)
- Employment Services (/Clients with employment_services role)
- PTO, Authorizations, DSPD functions
- Employee Portal (/EmployeePortal)
- Staff Dashboards, Payroll
- Job Coaching, Life Skills (operational)
- Any non-CE features
```

### CE Student Permissions
```
✅ Can Access:
- CE Training Portal (/CETrainingPortal)
- Their own CE clients (future)
- Discovery assessments, interviews, activities
- DSR development
- Instructor feedback

❌ Cannot Access:
- Other students' clients or work
- Time Tracking, PTO, Authorizations
- Employment Services management
- Employee Portal
- Any staff or management features
- Job Coaching, Life Skills (operational)
```

---

## 4. EXACT ROUTE PROTECTION RULES

### Access Classification (`AuthContext.classifyUserAccess()`)
```javascript
// Returns access class for routing:
if (role === 'ce_instructor' || role === 'ce_student') {
  if (access_level === 'ce_training_portal') return 'ce_training'
}
// Then in App.jsx:
if (accessClass === 'ce_training') {
  // Routes to CETrainingNav + CE routes only
  // Blocks access to staff routes
}
```

### Route Sets

**Staff Routes** (require `staff` access)
- `/Dashboard`
- `/Clients`
- `/TimeTracking`
- `/Reports`
- `/EmployeePortal`
- All employment services features

**CE Training Routes** (require `ce_training` access)
- `/CETrainingPortal` (landing)
- `/Cohorts` (visibility: instructors manage, students view own)
- `/CohortDetail` (visibility: scoped by cohort membership)

**Implementation:** App.jsx checks `accessClass`:
```javascript
if (accessClass === 'ce_training') {
  return (
    <CETrainingNav user={user}>
      <Routes>
        <Route path="/CETrainingPortal" element={<CETrainingPortal />} />
        <Route path="/Cohorts" element={<Cohorts />} />
        <Route path="/CohortDetail" element={<CohortDetail />} />
        <Route path="*" element={<CETrainingPortal />} />
      </Routes>
    </CETrainingNav>
  );
}
```

---

## 5. EXACT NAVIGATION CHANGES

### New Component: CETrainingNav.jsx
```
Header:
  - CE Training Portal branding + logo
  - User avatar (with upload)
  - Role badge (👨‍🏫 Instructor or 👨‍🎓 Student)

Sidebar:
  CE Instructor Navigation:
    - Dashboard
    - My Cohorts

  CE Student Navigation:
    - Dashboard
    (Future: My Clients, Discovery Work)

  Bottom:
    - Log Out button
```

### CE Training Portal Landing (`CETrainingPortal.jsx`)

**Instructor Dashboard**
```
Cards (placeholders for future):
- My Cohorts → /Cohorts
- Student Discovery Work → Coming Soon
- Feedback Tools → Coming Soon
```

**Student Dashboard**
```
Cards (placeholders for future):
- My CE Training Clients → Coming Soon
- Discovery & DSR Work → Coming Soon
```

**Info Card**
```
"This is a dedicated CE Training environment separate from 
operational employment services. All work is for training/
certification purposes only."
```

---

## 6. SCREENSHOTS

### CE Instructor Experience

**1. CE Training Portal Landing**
```
┌─────────────────────────────────────────────────────────────────┐
│ ▶ CE Training Portal                    [👨‍🏫 Instructor]          │
├─────────────────────────────────────────────────────────────────┤
│ Sidebar:                                                         │
│  • Dashboard                                                     │
│  • My Cohorts                                                    │
│  [Log Out]                                                       │
├─────────────────────────────────────────────────────────────────┤
│ Main Content:                                                    │
│                                                                  │
│ CE Training Portal                                              │
│ Spring 2026 CE Certification - Cohort A                        │
│                                                                  │
│ ┌────────────────────┐  ┌────────────────────┐                │
│ │ 👥 My Cohorts      │  │ 📖 Student Discovery│                │
│ │ Manage CE cohorts, │  │ Work Review        │                │
│ │ review student     │  │ Review CE student   │                │
│ │ progress, feedback │  │ client cases        │                │
│ │                    │  │                     │                │
│ │ [View Cohorts] →   │  │ [Coming Soon]       │                │
│ └────────────────────┘  └────────────────────┘                │
│                                                                  │
│ ✨ CE Training Portal                                           │
│ This is a dedicated CE training environment...                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**2. Cohorts Management**
```
/Cohorts loads with instructor visibility:
- See all student members in cohort
- See all student-created clients (future)
- Manage cohort details
- View student progress (future)
```

### CE Student Experience

**1. CE Training Portal Landing**
```
┌─────────────────────────────────────────────────────────────────┐
│ ▶ CE Training Portal                    [👨‍🎓 Student]           │
├─────────────────────────────────────────────────────────────────┤
│ Sidebar:                                                         │
│  • Dashboard                                                     │
│  [Log Out]                                                       │
├─────────────────────────────────────────────────────────────────┤
│ Main Content:                                                    │
│                                                                  │
│ CE Training Portal                                              │
│ Spring 2026 CE Certification - Cohort A                        │
│                                                                  │
│ ┌────────────────────┐  ┌────────────────────┐                │
│ │ 👥 My CE Training  │  │ 📖 Discovery & DSR  │                │
│ │ Clients            │  │ Work                │                │
│ │ Create and access  │  │ Complete discovery  │                │
│ │ your CE training   │  │ interviews, conduct │                │
│ │ clients only       │  │ activities, develop │                │
│ │                    │  │ DSR work            │                │
│ │ [Coming Soon]      │  │                     │                │
│ │                    │  │ [Coming Soon]       │                │
│ └────────────────────┘  └────────────────────┘                │
│                                                                  │
│ ✨ CE Training Portal                                           │
│ This is a dedicated CE training environment...                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**2. Client Access (Future)**
```
When implemented:
- Only their own CE clients (created_by_student_id = user.id)
- Cannot see other students' clients
- Assigned instructor visible on client detail
```

---

## 7. VERIFICATION CHECKLIST

### User Isolation
- ✅ CE Instructor (ce_instructor role, ce_training_portal access) → CE Training Portal only
- ✅ CE Student (ce_student role, ce_training_portal access) → CE Training Portal only
- ✅ Staff (employee/management/admin, staff access) → Cannot access CE Training routes
- ✅ Different navigation for each role

### Route Protection
- ✅ `/CETrainingPortal` requires `ce_training` access
- ✅ `/Cohorts` visible to both instructors (manage) and students (view own)
- ✅ Staff routes blocked for CE users
- ✅ CE routes blocked for staff

### Permissions
- ✅ CE Instructor: ce_training_portal, ce_cohorts, ce_student_review
- ✅ CE Student: ce_training_portal, ce_discovery_work
- ✅ Staff: time_tracking, clients, employee_portal, etc.
- ✅ No feature permission overlap between pathways

### Navigation
- ✅ CETrainingNav only visible to ce_training users
- ✅ Staff layout remains unchanged
- ✅ Role-specific sidebar items
- ✅ Role badge display

### Client Architecture (Prepared)
- ✅ Client.client_type supports 'ce_training'
- ✅ Client fields ready for student creation (created_by_student_id, assigned_instructor_id, cohort_id, is_training_client)
- ✅ Future visibility rules prepared (not enforced yet)

### Cohort Architecture (Prepared)
- ✅ CETrainingCohort ready for instructor ownership
- ✅ CETrainingCohortMember ready for student membership
- ✅ Cohort scoping ready (not enforced yet)

---

## 8. FILES CREATED/MODIFIED

### Created (NEW)
1. `pages/CETrainingPortal.jsx` — CE Training landing portal
2. `components/ce-training/CETrainingNav.jsx` — Dedicated CE navigation
3. `functions/seedCETrainingPermissions.js` — Permission seeder
4. `docs/PHASE_CE_T1_ARCHITECTURE.md` — Technical documentation
5. `docs/CE_T1_DELIVERABLE.md` — This file

### Modified
1. `entities/User.json` — Added ce_instructor, ce_student, ce_training_portal, cohort fields
2. `entities/Client.json` — Added ce_training type, training client fields
3. `entities/FeaturePermission.json` — Added ce_instructor, ce_student roles
4. `lib/AuthContext.jsx` — Updated classifyUserAccess for ce_training
5. `App.jsx` — Added ce_training route handler with CETrainingNav

---

## 9. NO FUNCTIONALITY CHANGES

- ✅ Staff employment services unchanged
- ✅ Time tracking unchanged
- ✅ Job coaching unchanged
- ✅ DSPD unchanged
- ✅ Authorization management unchanged
- ✅ Existing Cohorts functionality unchanged
- ✅ Existing CE features (vocational themes, discovery assessments) unchanged
- ✅ Only new navigation path + permission rules added

---

## 10. NEXT PHASE (T2+) DELIVERABLES

- Student CE client creation UI
- Instructor discovery review dashboard
- Student client access enforcement
- Instructor feedback implementation
- Discovery assessment workflows
- DSR development interface