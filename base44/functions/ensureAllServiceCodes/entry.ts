import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get existing codes
    const existing = await base44.asServiceRole.entities.ServiceCode.filter({
      service_type: "job_coaching",
      is_active: true
    });

    const existingCodes = new Set(existing.map(e => e.code));

    // Full set of codes needed
    const requiredCodes = [
      {
        code: "JC01",
        service_type: "job_coaching",
        service_type_enum: "job_coaching",
        short_description: "Direct On-Site Support",
        full_description: "Job Coaching: Direct On-Site Support",
        display_label: "JC01 - Job Coaching: Direct On-Site Support",
        category: "Direct Service",
        is_primary: true,
        is_secondary: true
      },
      {
        code: "JC02",
        service_type: "job_coaching",
        service_type_enum: "job_coaching",
        short_description: "Job Task Analysis",
        full_description: "Job Coaching: Job Task Analysis",
        display_label: "JC02 - Job Coaching: Job Task Analysis",
        category: "Direct Service",
        is_primary: true,
        is_secondary: true
      },
      {
        code: "JC03",
        service_type: "job_coaching",
        service_type_enum: "job_coaching",
        short_description: "Employer Consultation",
        full_description: "Job Coaching: Employer Consultation",
        display_label: "JC03 - Job Coaching: Employer Consultation",
        category: "Indirect Service",
        is_primary: true,
        is_secondary: true
      },
      {
        code: "JC04",
        service_type: "job_coaching",
        service_type_enum: "job_coaching",
        short_description: "Follow-Up Support",
        full_description: "Job Coaching: Follow-Up Support",
        display_label: "JC04 - Job Coaching: Follow-Up Support",
        category: "Direct Service",
        is_primary: true,
        is_secondary: true
      }
    ];

    // Create missing codes
    const toCreate = [];
    for (const codeData of requiredCodes) {
      if (!existingCodes.has(codeData.code)) {
        toCreate.push(codeData);
      }
    }

    let created = 0;
    if (toCreate.length > 0) {
      const result = await base44.asServiceRole.entities.ServiceCode.bulkCreate(toCreate);
      created = result.length;
    }

    // Verify final state
    const final = await base44.asServiceRole.entities.ServiceCode.filter({
      service_type: "job_coaching",
      is_active: true
    });

    return Response.json({
      status: 'success',
      existing_codes: existing.length,
      created_codes: created,
      final_codes: final.length,
      final_list: final.map(c => c.code).sort()
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});