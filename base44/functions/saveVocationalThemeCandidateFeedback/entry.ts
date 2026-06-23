import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await req.json();
    const {
      client_id,
      candidate_theme_name,
      category_label,
      cohort_id,
      staff_validation,
      evidence_quality,
      use_for_future_discovery,
      notes,
    } = payload;

    // Validate required fields
    if (!client_id || !candidate_theme_name || !category_label) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // ── HARDENED VALIDATION: Client must exist ──────────────────────────────────
    // Verify client_id is valid and user has access (no admin bypass)
    let client;
    try {
      client = await base44.entities.Client.get(client_id);
    } catch (err) {
      console.error(`[saveVocationalThemeCandidateFeedback] Client lookup failed for ID: ${client_id}`, err);
      return Response.json({ error: 'Client not found' }, { status: 404 });
    }

    if (!client) {
      return Response.json({ error: 'Client not found' }, { status: 404 });
    }

    // ── VALIDATE cohort early if provided (even if platform access grants permission) ──
    if (cohort_id) {
      try {
        const cohort = await base44.entities.CETrainingCohort.get(cohort_id);
        if (!cohort) {
          return Response.json({ error: 'Cohort not found' }, { status: 404 });
        }
      } catch (err) {
        console.error(`[saveVocationalThemeCandidateFeedback] Cohort lookup failed for cohort_id: ${cohort_id}`, err);
        return Response.json({ error: 'Cohort not found' }, { status: 404 });
      }
    }

    // ── Access check: platform hierarchy OR cohort membership ─────────────────────
    let hasAccess = false;

    // Platform access: admin, management, or assigned employee
    if (user.role === 'admin' || user.role === 'management') {
      hasAccess = true;
    } else if (client.assigned_employee_id === user.id) {
      hasAccess = true;
    }

    // Cohort access: user is manager or member of cohort + client is assigned to member
    if (!hasAccess && cohort_id) {
      try {
        // Check if user is manager or member of this cohort
        const userCohortMembership = await base44.asServiceRole.entities.CETrainingCohortMember.filter({
          cohort_id,
          user_id: user.id,
          is_active: true,
        });

        if (userCohortMembership && userCohortMembership.length > 0) {
          // User is in cohort; now verify if they can access this client
          // Cohort manager: can access all clients assigned to cohort members
          // Cohort member: can only access their own clients
          const userRole = userCohortMembership[0].cohort_role;

          if (userRole === 'manager') {
            // Manager: check if client is assigned to any active cohort member
            const cohortMembers = await base44.asServiceRole.entities.CETrainingCohortMember.filter({
              cohort_id,
              is_active: true,
            });
            const memberUserIds = cohortMembers.map(m => m.user_id);
            if (memberUserIds.includes(client.assigned_employee_id)) {
              hasAccess = true;
            }
          } else if (userRole === 'member') {
            // Member: can only access their own clients
            if (client.assigned_employee_id === user.id) {
              hasAccess = true;
            }
          }
        }
      } catch (err) {
        console.error(`[saveVocationalThemeCandidateFeedback] Cohort validation failed for cohort_id: ${cohort_id}`, err);
        return Response.json({ error: 'Cohort validation failed' }, { status: 500 });
      }
    }

    if (!hasAccess) {
      return Response.json({ error: 'Access denied to this client' }, { status: 403 });
    }

    // ── Upsert: find existing feedback by (client_id, candidate_theme_name, reviewer_user_id) ──
    let existingFeedback;
    try {
      const results = await base44.entities.VocationalThemeCandidateFeedback.filter({
        client_id,
        candidate_theme_name,
        reviewer_user_id: user.id,
        is_active: true,
      });
      existingFeedback = results && results.length > 0 ? results[0] : null;
    } catch (err) {
      console.error('Feedback lookup error:', err);
      return Response.json({ error: 'Feedback lookup failed' }, { status: 500 });
    }

    const feedbackData = {
      org_id: user.org_id,
      client_id,
      candidate_theme_name,
      category_label,
      reviewer_user_id: user.id,
      reviewer_role: user.role,
      cohort_id: cohort_id || null,
      staff_validation: staff_validation || null,
      evidence_quality: evidence_quality || null,
      use_for_future_discovery: use_for_future_discovery || null,
      notes: notes || null,
      is_active: true,
      feedback_date: new Date().toISOString().split('T')[0],
    };

    let feedback;
    if (existingFeedback) {
      // Update existing
      feedback = await base44.entities.VocationalThemeCandidateFeedback.update(
        existingFeedback.id,
        feedbackData
      );
    } else {
      // Create new
      feedback = await base44.entities.VocationalThemeCandidateFeedback.create(feedbackData);
    }

    return Response.json({
      ok: true,
      feedback_id: feedback.id,
      message: existingFeedback ? 'Feedback updated' : 'Feedback created',
    });
  } catch (error) {
    console.error('saveVocationalThemeCandidateFeedback error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});