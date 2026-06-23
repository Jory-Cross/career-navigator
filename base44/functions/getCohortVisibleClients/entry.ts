import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Cohort Visibility Engine — Phase 2
 *
 * Determines which clients a given user may see through their CE certification
 * cohort membership. This is SEPARATE from platform management hierarchy
 * (getClientsForUser). A cohort manager does NOT have platform management
 * rights — they only get cohort-scoped visibility.
 *
 * Resolution rules:
 *  - Platform Admin     → returns ALL clients in the org (true scoping is the
 *                         caller's responsibility; we surface an isAdmin flag so
 *                         the UI can choose to call getClientsForUser instead).
 *                         We still return the full set so this function is a
 *                         complete visibility oracle on its own.
 *  - Cohort Manager      → active members of cohorts they manage, plus all
 *                         clients assigned to those members.
 *  - Cohort Member       → only their own assigned clients (cohort membership
 *                         does NOT grant access to peers' clients).
 *  - User in both roles  → manager permissions win (manager is a strict
 *                         superset of member for that cohort). If the same
 *                         user is a member of one cohort and manager of
 *                         another, manager visibility applies to the
 *                         manager-cohort's members' clients only — membership
 *                         in the member-cohort never exposes peers there.
 *  - User in no cohort   → returns their own assigned clients only (mirrors
 *                         straight-employee behavior; keeps the function a
 *                         complete oracle and avoids surprising UI emptiness).
 *
 * Server-side enforcement only. Frontend must NOT rely on hiding rows.
 *
 * Payload: { user_id } — user being queried. The caller's own session is also
 * validated (must be authenticated) to prevent anonymous probing, but no
 * caller-vs-user_id equality is enforced here; that's the UI's job when it
 * decides what to display. Server-side RLS / feedback visibility functions
 * will re-derive this membership themselves.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Validate the caller's session — no anonymous access to this oracle.
    const caller = await base44.auth.me();
    if (!caller) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { user_id } = body;

    if (!user_id) {
      return Response.json({ error: 'user_id is required' }, { status: 400 });
    }

    // Resolve the user being queried. Use service role — we need cross-user lookup.
    const allUsers = await base44.asServiceRole.entities.User.list();
    const targetUser = allUsers.find(u => u.id === user_id);

    if (!targetUser) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    const orgId = targetUser.org_id;
    const isAdmin = targetUser.role === 'admin';

    // ── Admin → everything in their org ───────────────────────────────────
    if (isAdmin) {
      const allClients = orgId
        ? await base44.asServiceRole.entities.Client.filter({ org_id: orgId, is_archived: false })
        : await base44.asServiceRole.entities.Client.filter({ is_archived: false });
      return Response.json({
        isAdmin: true,
        cohortIds: [],
        memberUserIds: [],
        clientIds: allClients.map(c => c.id),
        clients: allClients,
      });
    }

    // ── Cohort lookups via CETrainingCohortMember ────────────────────────
    const managerMemberships = await base44.asServiceRole.entities.CETrainingCohortMember.filter({
      user_id,
      cohort_role: 'manager',
      is_active: true,
    });

    // If this user manages any cohorts, expand to members of those cohorts.
    let managerCohortIds = [];
    let visibleMemberUserIds = new Set();

    if (Array.isArray(managerMemberships) && managerMemberships.length > 0) {
      managerCohortIds = managerMemberships.map(m => m.cohort_id);
      // Active members of the cohorts this user manages (any cohort_role).
      const cohortMembers = await base44.asServiceRole.entities.CETrainingCohortMember.filter({
        is_active: true,
      });
      const ids = new Set([user_id]); // a manager sees their own clients too
      for (const cm of cohortMembers) {
        if (managerCohortIds.includes(cm.cohort_id)) {
          ids.add(cm.user_id);
        }
      }
      visibleMemberUserIds = ids;
    } else {
      // Cohort member (or no cohort at all) → only see own clients.
      visibleMemberUserIds = new Set([user_id]);
    }

    // ── Resolve clients assigned to the visible member set ──────────────
    // Filter by org first to keep the in-memory set small, then intersect.
    const orgClients = orgId
      ? await base44.asServiceRole.entities.Client.filter({ org_id: orgId, is_archived: false })
      : await base44.asServiceRole.entities.Client.filter({ is_archived: false });

    const visibleClients = orgClients.filter(c => visibleMemberUserIds.has(c.assigned_employee_id));

    return Response.json({
      isAdmin: false,
      cohortIds: managerCohortIds,
      memberUserIds: Array.from(visibleMemberUserIds),
      clientIds: visibleClients.map(c => c.id),
      clients: visibleClients,
    });
  } catch (error) {
    console.error('getCohortVisibleClients error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});