import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const instructor = await base44.auth.me();
    
    if (!instructor) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const org_id = instructor.org_id;
    const seed_id = 'ce_training_demo_seed_v1';

    // 0. Cleanup old demo data first to avoid duplicates
    const oldDemoCohorts = await base44.asServiceRole.entities.CETrainingCohort.filter({
      org_id,
      demo_seed_id: seed_id,
    });
    for (const oldCohort of oldDemoCohorts) {
      const oldMembers = await base44.asServiceRole.entities.CETrainingCohortMember.filter({
        cohort_id: oldCohort.id,
      });
      for (const member of oldMembers) {
        await base44.asServiceRole.entities.CETrainingCohortMember.delete(member.id);
      }
      const oldClients = await base44.asServiceRole.entities.Client.filter({
        cohort_id: oldCohort.id,
        is_demo: true,
      });
      for (const client of oldClients) {
        await base44.asServiceRole.entities.Client.delete(client.id);
      }
      const oldPending = await base44.asServiceRole.entities.PendingRoleAssignment.filter({
        demo_seed_id: seed_id,
      });
      for (const pending of oldPending) {
        await base44.asServiceRole.entities.PendingRoleAssignment.delete(pending.id);
      }
      await base44.asServiceRole.entities.CETrainingCohort.delete(oldCohort.id);
    }

    // 1. Create demo cohort
    const cohort = await base44.asServiceRole.entities.CETrainingCohort.create({
      org_id,
      name: 'CE Training Demo Cohort',
      code: 'DEMO-CE-001',
      cohort_type: 'testing',
      status: 'active',
      created_by: instructor.id,
      is_demo: true,
      demo_seed_id: seed_id,
    });

    const cohortId = cohort.id;

    // 2. Create actual demo User records
    const demoStudentData = [
      { email: 'alex.ce.student.demo@example.com', first_name: 'Alex', last_name: 'Rivera' },
      { email: 'morgan.ce.student.demo@example.com', first_name: 'Morgan', last_name: 'Lee' },
      { email: 'taylor.ce.student.demo@example.com', first_name: 'Taylor', last_name: 'Brooks' },
    ];

    const studentIds = [];
    for (const studentData of demoStudentData) {
      // Create actual User record
      const user = await base44.asServiceRole.entities.User.create({
        email: studentData.email,
        full_name: `${studentData.first_name} ${studentData.last_name}`,
        first_name: studentData.first_name,
        last_name: studentData.last_name,
        role: 'ce_student',
        access_level: 'ce_training_portal',
        org_id,
        is_demo: true,
        demo_seed_id: seed_id,
      });

      studentIds.push(user.id);

      // Create cohort member record with real user ID
      await base44.asServiceRole.entities.CETrainingCohortMember.create({
        org_id,
        cohort_id: cohortId,
        user_id: user.id,
        cohort_role: 'member',
        is_active: true,
        joined_at: new Date().toISOString(),
        added_by: instructor.id,
        is_demo: true,
        demo_seed_id: seed_id,
      });
    }

    // 3. Create demo training clients
    const clientsData = [
      // Alex Rivera's clients
      {
        first_name: 'Sarah',
        last_name: 'Martinez',
        suffix: 'Demo',
        student_id: studentIds[0],
      },
      {
        first_name: 'Jordan',
        last_name: 'Fields',
        suffix: 'Demo',
        student_id: studentIds[0],
      },
      // Morgan Lee's clients
      {
        first_name: 'Casey',
        last_name: 'Nguyen',
        suffix: 'Demo',
        student_id: studentIds[1],
      },
      // Taylor Brooks' clients
      {
        first_name: 'Riley',
        last_name: 'Thompson',
        suffix: 'Demo',
        student_id: studentIds[2],
      },
    ];

    const createdClients = [];
    for (const clientData of clientsData) {
      const client = await base44.asServiceRole.entities.Client.create({
        org_id,
        first_name: clientData.first_name,
        last_name: `${clientData.last_name} ${clientData.suffix}`,
        email: `${clientData.first_name.toLowerCase()}.${clientData.last_name.toLowerCase()}.demo@example.com`,
        client_type: 'ce_training',
        is_training_client: true,
        created_by_student_id: clientData.student_id,
        assigned_instructor_id: instructor.id,
        cohort_id: cohortId,
        status: 'active',
        is_demo: true,
        demo_seed_id: seed_id,
      });
      createdClients.push(client);
    }

    // Also auto-add instructor as cohort manager
    await base44.asServiceRole.entities.CETrainingCohortMember.create({
      org_id,
      cohort_id: cohortId,
      user_id: instructor.id,
      cohort_role: 'manager',
      is_active: true,
      joined_at: new Date().toISOString(),
      added_by: instructor.id,
      is_demo: false, // Don't mark instructor as demo
    });

    // 4. Create some pending invites to test the Pending Invitations section
    const pendingEmails = [
      'future.student.1.demo@example.com',
      'future.student.2.demo@example.com',
    ];
    for (const email of pendingEmails) {
      await base44.asServiceRole.entities.PendingRoleAssignment.create({
        email,
        role: 'ce_student',
        access_level: 'ce_training_portal',
        org_id,
        cohort_id: cohortId,
        cohort_role: 'member',
        invited_by_id: instructor.id,
        invited_by_name: instructor.full_name,
        invited_at: new Date().toISOString(),
        status: 'pending',
        is_demo: true,
        demo_seed_id: seed_id,
      });
    }

    return Response.json({
      success: true,
      message: 'CE Training demo data seeded successfully',
      students_created: studentIds.length,
      data: {
        cohort: { id: cohortId, name: cohort.name },
        students: demoStudentData.map((s, i) => ({
          email: s.email,
          full_name: `${s.first_name} ${s.last_name}`,
          user_id: studentIds[i],
        })),
        clients: createdClients.map(c => ({
          id: c.id,
          name: `${c.first_name} ${c.last_name}`,
          created_by_student_id: c.created_by_student_id,
        })),
        seed_id,
      },
    });
  } catch (error) {
    console.error('Seed error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});