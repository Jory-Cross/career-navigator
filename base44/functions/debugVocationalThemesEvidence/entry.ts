import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { client_id } = await req.json();
    const assessments = await base44.entities.Assessment.filter({ client_id, status: 'completed' });

    // Collect from possible_vocational_themes field
    const vocThemesEvidence = [];

    const discoveryInterviews = assessments.filter(r => r.assessment_type === 'discovery_interview');
    discoveryInterviews.forEach(record => {
      const value = record.responses?.possible_vocational_themes;
      if (value && typeof value === 'string') {
        const items = splitEvidence(value);
        items.forEach(text => vocThemesEvidence.push({ text, source: 'Discovery Interview' }));
      }
    });

    const discoveryActivities = assessments.filter(r => r.assessment_type === 'discovery_activity');
    discoveryActivities.forEach(record => {
      const value = record.responses?.customized_employment_possibilities;
      if (value && typeof value === 'string') {
        const items = splitEvidence(value);
        items.forEach(text => vocThemesEvidence.push({ text, source: 'Discovery Activity' }));
      }
    });

    // Show what raw evidence matches "Library"
    const libraryEvidence = vocThemesEvidence.filter(e => 
      e.text.toLowerCase().includes('library') || 
      e.text.toLowerCase().includes('books') ||
      e.text.toLowerCase().includes('information')
    );

    return Response.json({
      ok: true,
      total_evidence_items: vocThemesEvidence.length,
      sample_items: vocThemesEvidence.slice(0, 10),
      library_matching_items: libraryEvidence,
      all_items: vocThemesEvidence
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function splitEvidence(value) {
  if (!value || typeof value !== 'string') return [];
  const cleaned = value.trim();
  if (!cleaned) return [];
  return cleaned
    .split(/\n|•|;/)
    .flatMap((part) => {
      const trimmed = part.trim();
      const count = (trimmed.match(/[.!?]/g) || []).length;
      if (count > 1) return [trimmed];
      return trimmed.split(",");
    })
    .map((part) => part.trim().replace(/^and\s+/i, "").replace(/\.$/, ""))
    .filter((part) => part.length > 2);
}