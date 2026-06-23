import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { client_id, candidate_theme_name } = body;

    if (!client_id || !candidate_theme_name) {
      return Response.json(
        { error: "client_id and candidate_theme_name are required" },
        { status: 400 }
      );
    }

    // Normalize the theme name for comparison (lowercase, trim)
    const normalizedThemeName = candidate_theme_name.toLowerCase().trim();

    // Fetch all feedback records for this client and candidate theme
    const allFeedback = await base44.asServiceRole.entities.VocationalThemeCandidateFeedback.filter({
      client_id,
      is_active: true,
    });

    // Filter by normalized theme name (case-insensitive)
    const candidateFeedback = allFeedback.filter(
      (fb) => fb.candidate_theme_name?.toLowerCase().trim() === normalizedThemeName
    );

    if (candidateFeedback.length === 0) {
      return Response.json({
        ok: true,
        candidate_theme_name,
        consensus_status: "No Feedback",
        feedback_count: 0,
        reviewer_count: 0,
        stats: {
          supported: 0,
          needs_more_discovery: 0,
          not_relevant: 0,
          sufficient_evidence: 0,
          more_evidence_needed: 0,
          weak_evidence_base: 0,
          future_discovery_yes: 0,
          future_discovery_no: 0,
        },
      });
    }

    // Calculate counts
    const stats = {
      supported: 0,
      needs_more_discovery: 0,
      not_relevant: 0,
      sufficient_evidence: 0,
      more_evidence_needed: 0,
      weak_evidence_base: 0,
      future_discovery_yes: 0,
      future_discovery_no: 0,
    };

    candidateFeedback.forEach((fb) => {
      // Staff validation counts
      if (fb.staff_validation === "supported") stats.supported++;
      else if (fb.staff_validation === "needs_more_discovery") stats.needs_more_discovery++;
      else if (fb.staff_validation === "not_relevant") stats.not_relevant++;

      // Evidence quality counts
      if (fb.evidence_quality === "sufficient_evidence") stats.sufficient_evidence++;
      else if (fb.evidence_quality === "more_evidence_needed") stats.more_evidence_needed++;
      else if (fb.evidence_quality === "weak_evidence_base") stats.weak_evidence_base++;

      // Future discovery counts
      if (fb.use_for_future_discovery === "yes") stats.future_discovery_yes++;
      else if (fb.use_for_future_discovery === "no") stats.future_discovery_no++;
    });

    const reviewerCount = candidateFeedback.length;
    const supportedPercent = reviewerCount > 0 ? (stats.supported / reviewerCount) * 100 : 0;
    const needsMorePercent = reviewerCount > 0 ? (stats.needs_more_discovery / reviewerCount) * 100 : 0;
    const notRelevantPercent = reviewerCount > 0 ? (stats.not_relevant / reviewerCount) * 100 : 0;

    // Deterministic consensus rules
    let consensusStatus = "Mixed Feedback";

    // Rule 1: Strongly Supported — supported >= 75% AND reviewer count >= 2
    if (supportedPercent >= 75 && reviewerCount >= 2) {
      consensusStatus = "Strongly Supported";
    } else if (
      // Rule 2: Emerging Support — supported > not_relevant AND no dominance by needs_more
      stats.supported > stats.not_relevant &&
      needsMorePercent < 50 &&
      supportedPercent > 0
    ) {
      consensusStatus = "Emerging Support";
    } else if (notRelevantPercent > 50) {
      // Rule 3: Weak Support — not_relevant is dominant (> 50%)
      consensusStatus = "Weak Support";
    } else if (needsMorePercent >= 50) {
      // Rule 4: Needs More Discovery — needs_more_discovery >= 50%
      consensusStatus = "Needs More Discovery";
    }
    // Rule 5: Mixed Feedback — no clear consensus (default)

    return Response.json({
      ok: true,
      candidate_theme_name,
      consensus_status: consensusStatus,
      feedback_count: candidateFeedback.length,
      reviewer_count: reviewerCount,
      stats,
      percentages: {
        supported: parseFloat(supportedPercent.toFixed(1)),
        needs_more_discovery: parseFloat(needsMorePercent.toFixed(1)),
        not_relevant: parseFloat(notRelevantPercent.toFixed(1)),
      },
    });
  } catch (error) {
    console.error("getVocationalThemeCandidateConsensus error:", error);
    return Response.json(
      { error: error.message, ok: false },
      { status: 500 }
    );
  }
});