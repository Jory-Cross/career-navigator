import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const org_id = user.org_id;

    // Get the demo cohort
    const cohorts = await base44.asServiceRole.entities.CETrainingCohort.filter({
      org_id,
      name: 'CE Training Demo Cohort',
    });

    if (cohorts.length === 0) {
      return Response.json({ error: 'Demo cohort not found' }, { status: 404 });
    }

    const cohort = cohorts[0];
    const cohort_id = cohort.id;

    // Get all members for this cohort
    const members = await base44.asServiceRole.entities.CETrainingCohortMember.filter({
      org_id,
      cohort_id,
    });

    // Find manager members
    const managers = members.filter(m => m.cohort_role === 'manager');

    console.log('=== CURRENT LOGGED-IN USER ===');
    console.log('currentUser.id:', user.id);
    console.log('currentUser.email:', user.email);
    console.log('currentUser.full_name:', user.full_name);
    console.log('currentUser.role:', user.role);
    console.log('currentUser.access_level:', user.access_level);

    console.log('\n=== DEMO COHORT ===');
    console.log('cohort.id:', cohort.id);
    console.log('cohort.name:', cohort.name);

    console.log('\n=== MANAGER RECORDS IN COHORT ===');
    console.log('Total managers:', managers.length);

    const managerDetails = [];
    for (const manager of managers) {
      console.log('\n--- Manager Record ---');
      console.log('member_id:', manager.id);
      console.log('user_id:', manager.user_id);
      console.log('cohort_id:', manager.cohort_id);
      console.log('cohort_role:', manager.cohort_role);
      console.log('is_active:', manager.is_active);
      console.log('joined_at:', manager.joined_at);
      console.log('added_by:', manager.added_by);

      // Try to resolve the user_id
      let resolvedUser = null;
      let resolveError = null;
      try {
        resolvedUser = await base44.asServiceRole.entities.User.get(manager.user_id);
      } catch (e) {
        resolveError = e.message;
      }

      if (resolvedUser) {
        console.log('Resolved User:');
        console.log('  id:', resolvedUser.id);
        console.log('  email:', resolvedUser.email);
        console.log('  full_name:', resolvedUser.full_name);
        console.log('  role:', resolvedUser.role);
      } else {
        console.log('Resolution error:', resolveError);
      }

      managerDetails.push({
        manager_id: manager.id,
        user_id: manager.user_id,
        resolved: resolvedUser ? { id: resolvedUser.id, email: resolvedUser.email, full_name: resolvedUser.full_name } : null,
        error: resolveError,
      });
    }

    return Response.json({
      success: true,
      current_user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
      },
      cohort: { id: cohort.id, name: cohort.name },
      managers: managerDetails,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});