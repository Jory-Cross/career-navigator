import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * manageCohortMembership — Phase 6A
 *
 * Server-side authority for assigning / removing CE training cohort
 * membership (CETrainingCohortMember rows). Frontends MUST NOT write
 * CETrainingCohortMember directly — they call this function so enrollment
 * authority is enforced in one place.
 *
 * Authority:
 *   - Platform admin            → any cohort in their org
 *   - Cohort manager            → only cohorts this user manages
 *                                 (active CETrainingCohortMember row with
 *                                 cohort_role='manager' on that cohort)
 *   - Everyone else             → denied (403)
 *
 * Operations:
 *   - action: 'add'      add a member/manager to a cohort (idempotent:
 *                       re-activates an inactive existing row rather than
 *                       creating a duplicate)
 *   - action: 'remove'   soft-delete a membership row (is_active=false).
 *                       Removing a manager is blocked if it would leave the
 *                       cohort with zero active managers (last-manager guard).
 *
 * Payload:
 *   {
 *     action: 'add' | 'remove',
 *     cohort_id: string,
 *     user_id: string,            // target user being enrolled/removed
 *     cohort_role: 'manager' | 'member',
 *     membership_id?: string      // for 'remove' — the CETrainingCohortMember row id
 *                                 // (preferred). If omitted, lookup by
 *                                 // (cohort_id, user_id, cohort_role).
 *   }
 *
 * Returns 200 with { ok: true, ... } on success, 403 when unauthorized,
 * 400 on invalid input, 409 when operation is blocked (last-manager).
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me();
    if (!caller) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { action, cohort_id, user_id, cohort_role, membership_id } = body || {};

    // ── Input validation ──────────────────────────────────────────────────
    if (!['add', 'remove'].includes(action)) {
      return Response.json({ error: 'action must be "add" or "remove"' }, { status: 400 });
    }
    if (!cohort_id) {
      return Response.json({ error: 'cohort_id is required' }, { status: 400 });
    }
    if (!['manager', 'member'].includes(cohort_role)) {
      return Response.json({ error: 'cohort_role must be "manager" or "member"' }, { status: 400 });
    }
    if (action === 'add' && !user_id) {
      return Response.json({ error: 'user_id is required for action "add"' }, { status: 400 });
    }

    // ── Resolve org_id (same pattern as inviteEmployee/getClientsForUser) ──
    let orgId = caller.org_id || null;
    if (!orgId) {
      const orgs = await base44.asServiceRole.entities.Organization.filter({ owner_email: caller.email });
      orgId = orgs[0]?.id || null;
    }

    // ── Authority check ───────────────────────────────────────────────────
    const isAdmin = caller.role === 'admin';
    let authorized = isAdmin;

    if (!authorized) {
      const managerRows = await base44.asServiceRole.entities.CETrainingCohortMember.filter({
        user_id: caller.id,
        cohort_role: 'manager',
        is_active: true,
        cohort_id,
      });
      authorized = Array.isArray(managerRows) && managerRows.length > 0;
    }

    if (!authorized) {
      return Response.json({
        error: 'Forbidden — only admins or the cohort manager may manage membership',
      }, { status: 403 });
    }

    // ── Validate cohort exists & caller org matches ──────────────────────
    const cohort = await base44.asServiceRole.entities.CETrainingCohort.get(cohort_id);
    if (!cohort) {
      return Response.json({ error: 'Cohort not found' }, { status: 404 });
    }
    if (orgId && cohort.org_id && cohort.org_id !== orgId) {
      return Response.json({ error: 'Cohort does not belong to caller org' }, { status: 403 });
    }

    const now = new Date().toISOString();

    // ── ADD ───────────────────────────────────────────────────────────────
    if (action === 'add') {
          if (cohort_role === 'member') {
        const matchingTargetUsers =
          await base44.asServiceRole.entities.User.filter({
            id: user_id,
          });

        const targetUser = Array.isArray(matchingTargetUsers)
          ? matchingTargetUsers[0]
          : null;

        if (!targetUser) {
          return Response.json({ error: 'User not found' }, { status: 404 });
        }

        if (targetUser.is_active === false) {
          return Response.json(
            { error: 'Only active registered CE students may be assigned to a cohort' },
            { status: 400 }
          );
        }

        if (targetUser.role !== 'ce_student') {
          return Response.json(
            { error: 'Only registered CE students may be assigned to a cohort' },
            { status: 400 }
          );
        }

        if (orgId && targetUser.org_id && targetUser.org_id !== orgId) {
          return Response.json(
            { error: 'Student does not belong to caller org' },
            { status: 403 }
          );
        }
      }

      // Idempotent: find existing membership row (any is_active) for this
      // (cohort, user, role) and re-activate it; otherwise create one.
      const existing = await base44.asServiceRole.entities.CETrainingCohortMember.filter({
        cohort_id,
        user_id,
        cohort_role,
      });
      const row = Array.isArray(existing) ? existing[0] : null;

      if (row) {
        if (row.is_active) {
          return Response.json({ ok: true, message: 'Already a member', membership_id: row.id });
        }

        await base44.asServiceRole.entities.CETrainingCohortMember.update(row.id, {
          is_active: true,
          joined_at: row.joined_at || now,
          added_by: caller.id,
        });

        return Response.json({ ok: true, message: 'Re-activated', membership_id: row.id });
      }

      const created = await base44.asServiceRole.entities.CETrainingCohortMember.create({
        org_id: orgId,
        cohort_id,
        user_id,
        cohort_role,
        is_active: true,
        joined_at: now,
        added_by: caller.id,
      });

      return Response.json({ ok: true, message: 'Added', membership_id: created.id });
    }

    // ── REMOVE ────────────────────────────────────────────────────────────
    // Resolve the target membership row.
    let targetRow = null;
    if (membership_id) {
      const allRows = await base44.asServiceRole.entities.CETrainingCohortMember.filter({
        cohort_id,
      });
      targetRow = (allRows || []).find((r) => r.id === membership_id && r.is_active);
    } else if (user_id) {
      const rows = await base44.asServiceRole.entities.CETrainingCohortMember.filter({
        cohort_id,
        user_id,
        cohort_role,
        is_active: true,
      });
      targetRow = (rows || [])[0];
    }

    if (!targetRow) {
      return Response.json({ error: 'Active membership not found' }, { status: 404 });
    }

    // Last-manager guard: never allow removing the last active manager.
    if (targetRow.cohort_role === 'manager') {
      const allManagers = await base44.asServiceRole.entities.CETrainingCohortMember.filter({
        cohort_id,
        cohort_role: 'manager',
        is_active: true,
      });
      const activeManagers = (allManagers || []).filter((m) => m.is_active);
      if (activeManagers.length <= 1) {
        return Response.json({
          error: 'Cannot remove the last active manager — a cohort must retain at least one active manager',
        }, { status: 409 });
      }
    }

    await base44.asServiceRole.entities.CETrainingCohortMember.update(targetRow.id, {
      is_active: false,
    });
    return Response.json({ ok: true, message: 'Removed', membership_id: targetRow.id });
  } catch (error) {
    console.error('manageCohortMembership error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
