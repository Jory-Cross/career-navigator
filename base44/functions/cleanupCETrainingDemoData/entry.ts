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
    const demoEmails = [
      'alex.ce.student.demo@example.com',
      'morgan.ce.student.demo@example.com',
      'taylor.ce.student.demo@example.com',
    ];

    // Delete demo cohorts (by seed_id, code, or name)
    const allCohorts = await base44.asServiceRole.entities.CETrainingCohort.filter({ org_id });
    const demoCohorts = allCohorts.filter(c =>
      c.demo_seed_id === seed_id ||
      c.code === 'DEMO-CE-001' ||
      c.name === 'CE Training Demo Cohort'
    );
    for (const cohort of demoCohorts) {
      // Delete members linked to this cohort first
      const cohortMembers = await base44.asServiceRole.entities.CETrainingCohortMember.filter({
        cohort_id: cohort.id,
      });
      for (const member of cohortMembers) {
        await base44.asServiceRole.entities.CETrainingCohortMember.delete(member.id);
      }
      // Delete clients linked to this cohort
      const cohortClients = await base44.asServiceRole.entities.Client.filter({
        cohort_id: cohort.id,
      });
      for (const client of cohortClients) {
        await base44.asServiceRole.entities.Client.delete(client.id);
      }
      await base44.asServiceRole.entities.CETrainingCohort.delete(cohort.id);
    }

    // Delete demo cohort members (by seed_id)
    const demoMembers = await base44.asServiceRole.entities.CETrainingCohortMember.filter({
      org_id,
      is_demo: true,
      demo_seed_id: seed_id,
    });
    for (const member of demoMembers) {
      await base44.asServiceRole.entities.CETrainingCohortMember.delete(member.id);
    }

    // Delete demo pending role assignments (by seed_id or email)
    const allPending = await base44.asServiceRole.entities.PendingRoleAssignment.filter({ org_id });
    const demoPending = allPending.filter(p =>
      p.demo_seed_id === seed_id || demoEmails.includes(p.email)
    );
    for (const pending of demoPending) {
      await base44.asServiceRole.entities.PendingRoleAssignment.delete(pending.id);
    }

    // Delete demo clients (by seed_id or name pattern)
    const allClients = await base44.asServiceRole.entities.Client.filter({ org_id });
    const demoClients = allClients.filter(c =>
      c.demo_seed_id === seed_id ||
      c.is_demo === true ||
      c.last_name?.endsWith(' Demo')
    );
    for (const client of demoClients) {
      await base44.asServiceRole.entities.Client.delete(client.id);
    }

    // Delete demo user records (by seed_id or email)
    let demoUsers = [];
    try {
      const allUsers = await base44.asServiceRole.entities.User.filter({ org_id });
      demoUsers = allUsers.filter(u =>
        u.is_demo === true ||
        u.demo_seed_id === seed_id ||
        demoEmails.includes(u.email)
      );
      for (const demoUser of demoUsers) {
        try {
          await base44.asServiceRole.entities.User.delete(demoUser.id);
        } catch {
          // Skip if User deletion not supported
        }
      }
    } catch {
      // User entity may not support listing; skip
    }

    const deletedCount = {
      cohorts: demoCohorts.length,
      members: demoMembers.length,
      pending: demoPending.length,
      clients: demoClients.length,
      users: demoUsers.length,
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