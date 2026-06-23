import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const org_id = user.org_id;

    // Create test users via invitations
    const testUsers = [
      { email: 'ce-instructor-test@example.com', role: 'ce_instructor' },
      { email: 'ce-student-test@example.com', role: 'ce_student' },
    ];

    const results = [];

    for (const testUser of testUsers) {
      try {
        // Create pending role assignment for CE users
        const pending = await base44.entities.PendingRoleAssignment.create({
          email: testUser.email,
          role: testUser.role,
          access_level: 'ce_training_portal',
          org_id,
          invited_by_id: user.id,
          invited_by_name: user.full_name || 'Admin',
          status: 'pending',
        });

        results.push({
          email: testUser.email,
          role: testUser.role,
          access_level: 'ce_training_portal',
          status: 'created',
          pending_id: pending.id,
        });
      } catch (err) {
        results.push({
          email: testUser.email,
          role: testUser.role,
          error: err.message,
        });
      }
    }

    return Response.json({
      ok: true,
      message: 'CE test users prepared',
      test_users: results,
      instructions: [
        '1. Invite the test email addresses via your platform invitations',
        '2. Use test cards: 4242 4242 4242 4242 for any payment',
        '3. CE Instructor should see: CE Training Portal, My Cohorts',
        '4. CE Student should see: CE Training Portal only',
        '5. Both should NOT see: Time Tracking, Employee Portal, Clients (staff version)',
      ],
    });
  } catch (error) {
    console.error('[createCETestUsers] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});