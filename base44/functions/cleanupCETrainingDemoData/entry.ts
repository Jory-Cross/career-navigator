import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admins can run cleanup
    if (user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const org_id = user.org_id;
    const seed_id = 'ce_training_demo_seed_v1';

    // Delete demo cohorts
    const demoCohorts = await base44.asServiceRole.entities.CETrainingCohort.filter({
      org_id,
      demo_seed_id: seed_id,
    });
    for (const cohort of demoCohorts) {
      await base44.asServiceRole.entities.CETrainingCohort.delete(cohort.id);
    }

    // Delete demo cohort members
    const demoMembers = await base44.asServiceRole.entities.CETrainingCohortMember.filter({
      org_id,
      is_demo: true,
      demo_seed_id: seed_id,
    });
    for (const member of demoMembers) {
      await base44.asServiceRole.entities.CETrainingCohortMember.delete(member.id);
    }

    // Delete demo pending role assignments
    const demoPending = await base44.asServiceRole.entities.PendingRoleAssignment.filter({
      org_id,
      is_demo: true,
      demo_seed_id: seed_id,
    });
    for (const pending of demoPending) {
      await base44.asServiceRole.entities.PendingRoleAssignment.delete(pending.id);
    }

    // Delete demo clients
    const demoClients = await base44.asServiceRole.entities.Client.filter({
      org_id,
      is_demo: true,
      demo_seed_id: seed_id,
    });
    for (const client of demoClients) {
      await base44.asServiceRole.entities.Client.delete(client.id);
    }

    const deletedCount = {
      cohorts: demoCohorts.length,
      members: demoMembers.length,
      pending: demoPending.length,
      clients: demoClients.length,
    };

    return Response.json({
      success: true,
      message: 'CE Training demo data cleaned up successfully',
      deleted: deletedCount,
      total: Object.values(deletedCount).reduce((a, b) => a + b, 0),
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});