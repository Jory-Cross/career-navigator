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

    // 2. Create demo students as PendingRoleAssignment (for UI testing without real invites)
    const demoStudents = [
      { email: 'alex.ce.student.demo@example.com', name: 'Alex Rivera' },
      { email: 'morgan.ce.student.demo@example.com', name: 'Morgan Lee' },
      { email: 'taylor.ce.student.demo@example.com', name: 'Taylor Brooks' },
    ];

    const studentIds = [];
    for (const student of demoStudents) {
      // Generate a demo user ID (prefixed with demo_ for clarity)
      const demoUserId = `demo_student_${Math.random().toString(36).substring(7)}`;
      studentIds.push(demoUserId);

      // Create pending assignment for cohort membership
      await base44.asServiceRole.entities.PendingRoleAssignment.create({
        email: student.email,
        role: 'ce_student',
        access_level: 'ce_training_portal',
        org_id,
        cohort_id: cohortId,
        cohort_role: 'student',
        status: 'pending_demo', // Custom status to indicate demo
        is_demo: true,
        demo_seed_id: seed_id,
        invited_by_id: instructor.id,
        invited_by_name: instructor.full_name,
        invited_at: new Date().toISOString(),
      });

      // Create cohort member record with demo user ID
      await base44.asServiceRole.entities.CETrainingCohortMember.create({
        org_id,
        cohort_id: cohortId,
        user_id: demoUserId,
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

    return Response.json({
      success: true,
      message: 'CE Training demo data seeded successfully',
      data: {
        cohort: { id: cohortId, name: cohort.name },
        students: demoStudents.map((s, i) => ({
          email: s.email,
          name: s.name,
          demo_user_id: studentIds[i],
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