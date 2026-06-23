import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const org_id = user.org_id;
    if (!org_id) {
      return Response.json({ error: 'No organization context' }, { status: 400 });
    }

    // CE Instructor permissions
    const ceInstructorFeatures = [
      { feature_key: 'ce_training_portal', label: 'CE Training Portal', category: 'ce_training', visible: true },
      { feature_key: 'ce_cohorts', label: 'CE Cohorts Management', category: 'ce_training', visible: true },
      { feature_key: 'ce_student_review', label: 'Review Student Work', category: 'ce_training', visible: true },
    ];

    // CE Student permissions
    const ceStudentFeatures = [
      { feature_key: 'ce_training_portal', label: 'CE Training Portal', category: 'ce_training', visible: true },
      { feature_key: 'ce_discovery_work', label: 'Discovery & DSR Work', category: 'ce_training', visible: true },
    ];

    // Seed instructor permissions
    for (const feature of ceInstructorFeatures) {
      try {
        await base44.entities.FeaturePermission.create({
          org_id,
          role: 'ce_instructor',
          ...feature,
        });
      } catch (err) {
        // Ignore duplicates
      }
    }

    // Seed student permissions
    for (const feature of ceStudentFeatures) {
      try {
        await base44.entities.FeaturePermission.create({
          org_id,
          role: 'ce_student',
          ...feature,
        });
      } catch (err) {
        // Ignore duplicates
      }
    }

    return Response.json({
      ok: true,
      message: 'CE Training permissions seeded',
      instructor_features: ceInstructorFeatures.length,
      student_features: ceStudentFeatures.length,
    });
  } catch (error) {
    console.error('[seedCETrainingPermissions] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});