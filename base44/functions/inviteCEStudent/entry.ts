import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { email, cohort_id } = await req.json();
    
    // Validate inputs
    if (!email || !cohort_id) {
      return Response.json({ error: 'Missing email or cohort_id' }, { status: 400 });
    }

    // Verify user is an instructor
    if (user.role !== 'ce_instructor') {
      return Response.json({ error: 'Only instructors can invite students' }, { status: 403 });
    }

    // Verify cohort exists and user is a manager
    const cohort = await base44.entities.CETrainingCohort.get(cohort_id);
    if (!cohort) {
      return Response.json({ error: 'Cohort not found' }, { status: 404 });
    }

    const membership = await base44.entities.CETrainingCohortMember.filter({
      cohort_id,
      user_id: user.id,
      cohort_role: 'manager',
    });
    
    if (!membership || membership.length === 0) {
      return Response.json({ error: 'You are not a manager of this cohort' }, { status: 403 });
    }

    // Create pending role assignment for ce_student
    const pending = await base44.entities.PendingRoleAssignment.create({
      email: email.toLowerCase().trim(),
      role: 'ce_student',
      access_level: 'ce_training_portal',
      org_id: user.org_id,
      invited_by_id: user.id,
      invited_by_name: user.full_name || user.email,
      invited_at: new Date().toISOString(),
      client_id: null, // Not a client portal invite
      status: 'pending',
    });

    // Store cohort_id and cohort_role as metadata for the pending invite
    // (Will be applied when user registers via the invite flow)
    const pendingWithCohort = await base44.entities.PendingRoleAssignment.update(pending.id, {
      cohort_id,
      cohort_role: 'student',
    });

    return Response.json({
      ok: true,
      message: 'CE Student invitation created',
      pending_id: pending.id,
      email,
      cohort_id,
      status: 'pending',
    });
  } catch (error) {
    console.error('[inviteCEStudent] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});