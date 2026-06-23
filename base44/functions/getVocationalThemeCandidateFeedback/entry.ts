import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Client/portal users have no feedback access
    if (['client', 'pre_ets', 'dspd', 'pre_ets_employer'].includes(user.role)) {
      return Response.json({ error: 'Access denied' }, { status: 403 });
    }

    const payload = await req.json();
    const { client_id, candidate_theme_name, cohort_id } = payload;

    if (!client_id) {
      return Response.json({ error: 'client_id required' }, { status: 400 });
    }

    // ── Build filter ───────────────────────────────────────────────────────
    const filter = {
      client_id,
      is_active: true,
    };
    if (candidate_theme_name) {
      filter.candidate_theme_name = candidate_theme_name;
    }

    // ── Fetch all active feedback for this client ──────────────────────────
    let allFeedback;
    try {
      allFeedback = await base44.asServiceRole.entities.VocationalThemeCandidateFeedback.filter(filter);
      allFeedback = Array.isArray(allFeedback) ? allFeedback : [];
    } catch (err) {
      console.error('Feedback fetch error:', err);
      return Response.json({ error: 'Feedback fetch failed' }, { status: 500 });
    }

    // ── Apply visibility filtering ─────────────────────────────────────────
    let visibleFeedback = [];

    if (user.role === 'admin') {
      // Admin sees all feedback
      visibleFeedback = allFeedback;
    } else if (user.role === 'management') {
      // Management/Cohort Manager: own feedback + feedback from users in cohorts they manage
      try {
        // Get cohorts where current user is a manager
        const managedCohorts = await base44.asServiceRole.entities.CETrainingCohortMember.filter({
          user_id: user.id,
          cohort_role: 'manager',
          is_active: true,
        });
        const managedCohortIds = managedCohorts.map((m) => m.cohort_id);

        // Get users in managed cohorts
        const cohortMembers = await base44.asServiceRole.entities.CETrainingCohortMember.filter({
          is_active: true,
        });
        const memberUserIds = new Set();
        for (const m of cohortMembers) {
          if (managedCohortIds.includes(m.cohort_id)) {
            memberUserIds.add(m.user_id);
          }
        }

        // Filter feedback: own feedback or from cohort members
        visibleFeedback = allFeedback.filter((fb) => {
          // Own feedback always visible
          if (fb.reviewer_user_id === user.id) return true;
          // Feedback from cohort members (if cohort_id set)
          if (fb.cohort_id && memberUserIds.has(fb.reviewer_user_id)) return true;
          return false;
        });
      } catch (err) {
        console.error('Cohort manager visibility check error:', err);
        // Fallback: only own feedback
        visibleFeedback = allFeedback.filter((fb) => fb.reviewer_user_id === user.id);
      }
    } else {
      // Employee/other staff: only own feedback
      visibleFeedback = allFeedback.filter((fb) => fb.reviewer_user_id === user.id);
    }

    // ── Apply optional cohort_id filter ────────────────────────────────────
    if (cohort_id) {
      visibleFeedback = visibleFeedback.filter((fb) => fb.cohort_id === cohort_id);
    }

    return Response.json({
      ok: true,
      feedbackRecords: visibleFeedback,
    });
  } catch (error) {
    console.error('getVocationalThemeCandidateFeedback error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});