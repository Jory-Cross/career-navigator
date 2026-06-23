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
    let client;
    try {
      client = await base44.asServiceRole.entities.Client.get(client_id);
    } catch (err) {
      console.error(`[saveVocationalThemeCandidateFeedback] Client lookup failed for ID: ${client_id}`, err);
      return Response.json({ error: 'Client not found' }, { status: 404 });
    }

    if (!client) {
      return Response.json({ error: 'Client not found' }, { status: 404 });
    }

    // ── VALIDATE cohort early if provided ──
    if (cohort_id) {
      try {
        const cohort = await base44.asServiceRole.entities.CETrainingCohort.get(cohort_id);
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
        const userCohortMembership = await base44.asServiceRole.entities.CETrainingCohortMember.filter({
          cohort_id,
          user_id: user.id,
          is_active: true,
        });

        if (userCohortMembership && userCohortMembership.length > 0) {
          const userRole = userCohortMembership[0].cohort_role;

          if (userRole === 'manager') {
            const cohortMembers = await base44.asServiceRole.entities.CETrainingCohortMember.filter({
              cohort_id,
              is_active: true,
            });
            const memberUserIds = cohortMembers.map(m => m.user_id);
            if (memberUserIds.includes(client.assigned_employee_id)) {
              hasAccess = true;
            }
          } else if (userRole === 'member') {
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

    // ── DETERMINISTIC FEEDBACK KEY ──────────────────────────────────────────────
    // Normalization: lowercase, trim, collapse whitespace
    const normalizedThemeName = candidate_theme_name.trim().toLowerCase().replace(/\s+/g, ' ');
    const feedbackKey = `${client_id}::${normalizedThemeName}::${user.id}`;
    
    const feedbackData = {
      org_id: user.org_id,
      feedback_key: feedbackKey,
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
    let wasCreated = false;

    try {
      // Query for existing active record by feedback_key
      const existingRecords = await base44.asServiceRole.entities.VocationalThemeCandidateFeedback.filter({
        feedback_key: feedbackKey,
        is_active: true,
      });

      if (existingRecords && existingRecords.length > 0) {
        // Active record exists; update it
        feedback = await base44.asServiceRole.entities.VocationalThemeCandidateFeedback.update(
          existingRecords[0].id,
          feedbackData
        );
        wasCreated = false;

        // If multiple active records exist (orphaned duplicates), mark older ones inactive
        if (existingRecords.length > 1) {
          console.log(`[DUPLICATE_CLEANUP] Found ${existingRecords.length} active records for key ${feedbackKey}, marking older ones inactive`);
          for (const dup of existingRecords.slice(1)) {
            try {
              await base44.asServiceRole.entities.VocationalThemeCandidateFeedback.update(dup.id, {
                is_active: false,
              });
            } catch (dupErr) {
              console.error(`[DUPLICATE_CLEANUP] Failed to deactivate duplicate ${dup.id}:`, dupErr.message);
            }
          }
        }
      } else {
        // No active record exists; attempt to create
        try {
          feedback = await base44.asServiceRole.entities.VocationalThemeCandidateFeedback.create(feedbackData);
          wasCreated = true;
        } catch (createErr) {
          // Create failed; likely a concurrent request created the same record
          // Query again to get the record that another request created
          console.error('[DUPLICATE_PREVENTION] Create conflict detected, re-querying:', createErr.message);
          
          const retryRecords = await base44.asServiceRole.entities.VocationalThemeCandidateFeedback.filter({
            feedback_key: feedbackKey,
            is_active: true,
          });

          if (retryRecords && retryRecords.length > 0) {
            // Record now exists (created by concurrent request); update it
            feedback = await base44.asServiceRole.entities.VocationalThemeCandidateFeedback.update(
              retryRecords[0].id,
              feedbackData
            );
            wasCreated = false;
          } else {
            // Still no record; original create error must be something else
            throw createErr;
          }
        }
      }
    } catch (error) {
      console.error('[DUPLICATE_PREVENTION] Fatal error:', error.message);
      return Response.json({ error: 'Failed to save feedback' }, { status: 500 });
    }

    if (!feedback) {
      return Response.json({ error: 'Failed to save feedback' }, { status: 500 });
    }

    return Response.json({
      ok: true,
      feedback_id: feedback.id,
      feedback_key: feedbackKey,
      message: wasCreated ? 'Feedback created' : 'Feedback updated',
    });
  } catch (error) {
    console.error('saveVocationalThemeCandidateFeedback error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});