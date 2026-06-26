import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me();

    if (!caller) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['admin', 'management', 'ce_instructor'].includes(caller.role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const cohort_id = String(body?.cohort_id || '').trim();

    if (!cohort_id) {
      return Response.json({ error: 'cohort_id is required' }, { status: 400 });
    }

    let orgId = caller.org_id || null;

    if (!orgId) {
      const organizations =
        await base44.asServiceRole.entities.Organization.filter({
          owner_email: caller.email,
        });

      orgId = organizations[0]?.id || null;
    }

    const cohort =
      await base44.asServiceRole.entities.CETrainingCohort.get(cohort_id);

    if (!cohort) {
      return Response.json({ error: 'Cohort not found' }, { status: 404 });
    }

    if (orgId && cohort.org_id && cohort.org_id !== orgId) {
      return Response.json(
        { error: 'Cohort does not belong to caller organization' },
        { status: 403 }
      );
    }

    let authorized = ['admin', 'management'].includes(caller.role);

    if (!authorized && caller.role === 'ce_instructor') {
      const managerRows =
        await base44.asServiceRole.entities.CETrainingCohortMember.filter({
          cohort_id,
          user_id: caller.id,
          cohort_role: 'manager',
          is_active: true,
        });

      authorized =
        Array.isArray(managerRows) && managerRows.length > 0;
    }

    if (!authorized) {
      return Response.json(
        { error: 'Only cohort managers may view this cohort roster' },
        { status: 403 }
      );
    }

    const allMemberships =
      await base44.asServiceRole.entities.CETrainingCohortMember.filter({
        cohort_id,
      });

    const memberships = (Array.isArray(allMemberships) ? allMemberships : [])
      .filter((membership) => membership.is_active !== false);

    const memberUserIds = new Set(
      memberships
        .map((membership) => membership.user_id)
        .filter(Boolean)
    );

    const allUsers =
      await base44.asServiceRole.entities.User.list();

    const users = (Array.isArray(allUsers) ? allUsers : [])
      .filter((candidate) => memberUserIds.has(candidate.id));

    return Response.json({
      ok: true,
      memberships,
      users,
    });
  } catch (error) {
    console.error('getCohortMemberships error:', error.message);

    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});
