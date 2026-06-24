import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const org_id = user.org_id;

    // Get the first CE Training Cohort with members
    const cohorts = await base44.asServiceRole.entities.CETrainingCohort.filter({ org_id }, '-created_date', 1);
    if (!cohorts || cohorts.length === 0) {
      return Response.json({ error: 'No cohorts found' }, { status: 404 });
    }
    const cohort = cohorts[0];

    // Get all members for this cohort
    const members = await base44.asServiceRole.entities.CETrainingCohortMember.filter({
      cohort_id: cohort.id,
    });

    const results = {
      cohort_id: cohort.id,
      cohort_name: cohort.name,
      members_total: members.length,
      members: [],
      managers: [],
    };

    for (const member of members) {
      const memberRecord = {
        member_id: member.id,
        member_user_id: member.user_id,
        member_cohort_role: member.cohort_role,
        user_get_result: null,
        user_get_error: null,
      };

      // Attempt to get the user
      try {
        const userRecord = await base44.asServiceRole.entities.User.get(member.user_id);
        memberRecord.user_get_result = userRecord ? {
          id: userRecord.id,
          full_name: userRecord.full_name,
          email: userRecord.email,
          role: userRecord.role,
        } : null;
      } catch (err) {
        memberRecord.user_get_error = err.message;
      }

      if (member.cohort_role === 'manager') {
        results.managers.push(memberRecord);
      } else {
        results.members.push(memberRecord);
      }
    }

    return Response.json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error('Debug error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});