import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const JOB_COACHING_CODES = [
  { code: "JC01", description: "Attend employer training (client and job coach)" },
  { code: "JC02", description: "Meet with worksite sups and natural supports" },
  { code: "JC03", description: "Review, train, teach essential job duties with client" },
  { code: "JC04", description: "Provide individualized training for learning job tasks" },
  { code: "JC05", description: "Perform onsite follow-up checks with client" },
  { code: "JC06", description: "Provide direct interventions on the job" },
  { code: "JC07", description: "Identify and set up accommodations (employer & VR)" },
  { code: "JC08", description: "Build and coordinate natural supports for continued work success" },
  { code: "JC09", description: "Shadow and observe client while on worksite" },
  { code: "JC10", description: "Develop and implement support plan after job coach fades" },
  { code: "JC11", description: "Develop work culture skills (breaks, sick days, etc.)" },
  { code: "JC12", description: "Develop work conditioning and hardening" },
  { code: "JC13", description: "Provide support and encouragement" },
  { code: "JC14", description: "Provide *Other Support. *(Approved in advance by VR)" },
  { code: "JC15", description: "Provide transportation training" }
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if codes already exist
    const existing = await base44.entities.ServiceCode.filter({
      service_type: "job_coaching",
      program_type: "vr"
    });

    if (existing.length > 0) {
      console.log(`[seedJobCoachingServiceCodes] Found ${existing.length} existing codes. Skipping creation.`);
      return Response.json({ 
        message: `${existing.length} service codes already exist`, 
        codes: existing 
      });
    }

    // Create all codes
    const codesToCreate = JOB_COACHING_CODES.map(item => ({
      code: item.code,
      program_type: "vr",
      service_type: "job_coaching",
      short_description: item.description.substring(0, 50),
      full_description: item.description,
      display_label: `${item.code} - ${item.description}`,
      category: "Direct Service",
      is_primary: true,
      is_secondary: true,
      is_active: true
    }));

    await base44.entities.ServiceCode.bulkCreate(codesToCreate);

    console.log(`[seedJobCoachingServiceCodes] Successfully created ${codesToCreate.length} job coaching service codes`);

    return Response.json({
      message: `Created ${codesToCreate.length} job coaching service codes`,
      count: codesToCreate.length,
      codes: codesToCreate.map(c => ({ code: c.code, label: c.display_label }))
    });
  } catch (error) {
    console.error("[seedJobCoachingServiceCodes] Error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});