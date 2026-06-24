import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Get the CE Training Demo Cohort
    const cohorts = await base44.asServiceRole.entities.CETrainingCohort.filter(
      { name: 'CE Training Demo Cohort' }
    );
    const cohort = cohorts[0];
    if (!cohort) {
      return Response.json({ error: 'Cohort not found' }, { status: 404 });
    }

    // Get all manager memberships for this cohort
    const memberships = await base44.asServiceRole.entities.CETrainingCohortMember.filter(
      { cohort_id: cohort.id, cohort_role: 'manager' }
    );

    console.log(`[DEBUG] Found ${memberships.length} manager memberships`);

    // For each membership, try to resolve the user
    const resolutionResults = [];
    for (const m of memberships) {
      console.log(`[DEBUG] Checking membership ${m.id}: user_id=${m.user_id}, is_active=${m.is_active}`);
      
      let userRecord = null;
      let userError = null;
      try {
        userRecord = await base44.asServiceRole.entities.User.get(m.user_id);
        console.log(`[DEBUG] User resolved: ${userRecord.full_name} (${userRecord.email})`);
      } catch (err) {
        userError = err.message;
        console.log(`[ERROR] Failed to resolve user ${m.user_id}: ${err.message}`);
      }

      resolutionResults.push({
        membership_id: m.id,
        user_id: m.user_id,
        is_active: m.is_active,
        cohort_role: m.cohort_role,
        created_date: m.created_date,
        user_found: !!userRecord,
        user_error: userError,
        user_details: userRecord ? {
          id: userRecord.id,
          full_name: userRecord.full_name,
          email: userRecord.email,
          role: userRecord.role
        } : null
      });
    }

    return Response.json({
      success: true,
      cohort: {
        id: cohort.id,
        name: cohort.name
      },
      memberships_count: memberships.length,
      manager_memberships: resolutionResults
    });
  } catch (error) {
    console.error('[ERROR]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});