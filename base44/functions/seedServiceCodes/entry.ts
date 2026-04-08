import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Job Coaching service codes (15 USOR approved codes - exact descriptions)
     const jcCodes = [
       {
         code: "JC01",
         service_type: "job_coaching",
         program_type: "vr",
         short_description: "Attend employer training",
         full_description: "Attend employer training (client and job coach)",
         display_label: "JC01 - Attend employer training (client and job coach)",
         category: "Direct Service",
         is_primary: true,
         is_secondary: true
       },
       {
         code: "JC02",
         service_type: "job_coaching",
         program_type: "vr",
         short_description: "Meet with worksite sups",
         full_description: "Meet with worksite sups and natural supports",
         display_label: "JC02 - Meet with worksite sups and natural supports",
         category: "Direct Service",
         is_primary: true,
         is_secondary: true
       },
       {
         code: "JC03",
         service_type: "job_coaching",
         program_type: "vr",
         short_description: "Review and train job duties",
         full_description: "Review, train, teach essential job duties with client",
         display_label: "JC03 - Review, train, teach essential job duties with client",
         category: "Direct Service",
         is_primary: true,
         is_secondary: true
       },
       {
         code: "JC04",
         service_type: "job_coaching",
         program_type: "vr",
         short_description: "Provide individualized training",
         full_description: "Provide individualized training for learning job tasks",
         display_label: "JC04 - Provide individualized training for learning job tasks",
         category: "Direct Service",
         is_primary: true,
         is_secondary: true
       },
       {
         code: "JC05",
         service_type: "job_coaching",
         program_type: "vr",
         short_description: "Onsite follow-up checks",
         full_description: "Perform onsite follow-up checks with client",
         display_label: "JC05 - Perform onsite follow-up checks with client",
         category: "Direct Service",
         is_primary: true,
         is_secondary: true
       },
       {
         code: "JC06",
         service_type: "job_coaching",
         program_type: "vr",
         short_description: "Direct interventions on job",
         full_description: "Provide direct interventions on the job",
         display_label: "JC06 - Provide direct interventions on the job",
         category: "Direct Service",
         is_primary: true,
         is_secondary: true
       },
       {
         code: "JC07",
         service_type: "job_coaching",
         program_type: "vr",
         short_description: "Identify and set up accommodations",
         full_description: "Identify and set up accommodations (employer & VR)",
         display_label: "JC07 - Identify and set up accommodations (employer & VR)",
         category: "Indirect Service",
         is_primary: true,
         is_secondary: true
       },
       {
         code: "JC08",
         service_type: "job_coaching",
         program_type: "vr",
         short_description: "Build and coordinate natural supports",
         full_description: "Build and coordinate natural supports for continued work success",
         display_label: "JC08 - Build and coordinate natural supports for continued work success",
         category: "Indirect Service",
         is_primary: true,
         is_secondary: true
       },
       {
         code: "JC09",
         service_type: "job_coaching",
         program_type: "vr",
         short_description: "Shadow and observe client",
         full_description: "Shadow and observe client while on worksite",
         display_label: "JC09 - Shadow and observe client while on worksite",
         category: "Direct Service",
         is_primary: true,
         is_secondary: true
       },
       {
         code: "JC10",
         service_type: "job_coaching",
         program_type: "vr",
         short_description: "Develop support plan after fade",
         full_description: "Develop and implement support plan after job coach fades",
         display_label: "JC10 - Develop and implement support plan after job coach fades",
         category: "Indirect Service",
         is_primary: true,
         is_secondary: true
       },
       {
         code: "JC11",
         service_type: "job_coaching",
         program_type: "vr",
         short_description: "Develop work culture skills",
         full_description: "Develop work culture skills (breaks, sick days, etc.)",
         display_label: "JC11 - Develop work culture skills (breaks, sick days, etc.)",
         category: "Direct Service",
         is_primary: true,
         is_secondary: true
       },
       {
         code: "JC12",
         service_type: "job_coaching",
         program_type: "vr",
         short_description: "Work conditioning and hardening",
         full_description: "Develop work conditioning and hardening",
         display_label: "JC12 - Develop work conditioning and hardening",
         category: "Direct Service",
         is_primary: true,
         is_secondary: true
       },
       {
         code: "JC13",
         service_type: "job_coaching",
         program_type: "vr",
         short_description: "Support and encouragement",
         full_description: "Provide support and encouragement",
         display_label: "JC13 - Provide support and encouragement",
         category: "Direct Service",
         is_primary: true,
         is_secondary: true
       },
       {
         code: "JC14",
         service_type: "job_coaching",
         program_type: "vr",
         short_description: "Other support (VR approved)",
         full_description: "Provide Other Support (Approved in advance by VR)",
         display_label: "JC14 - Provide Other Support (Approved in advance by VR)",
         category: "Indirect Service",
         is_primary: true,
         is_secondary: true
       },
       {
         code: "JC15",
         service_type: "job_coaching",
         program_type: "vr",
         short_description: "Transportation training",
         full_description: "Provide transportation training",
         display_label: "JC15 - Provide transportation training",
         category: "Direct Service",
         is_primary: true,
         is_secondary: true
       }
     ];

    // Job Development codes
    const jdCodes = [
      {
        code: "JD01",
        service_type: "job_development",
        program_type: "vr",
        short_description: "Job Prospecting",
        full_description: "Job Development: Job Prospecting",
        display_label: "JD01 - Job Development: Job Prospecting",
        category: "Direct Service",
        is_primary: true,
        is_secondary: true
      },
      {
        code: "JD02",
        service_type: "job_development",
        program_type: "vr",
        short_description: "Employer Outreach",
        full_description: "Job Development: Employer Outreach",
        display_label: "JD02 - Job Development: Employer Outreach",
        category: "Indirect Service",
        is_primary: true,
        is_secondary: true
      },
      {
        code: "JD03",
        service_type: "job_development",
        program_type: "vr",
        short_description: "Job Negotiation",
        full_description: "Job Development: Job Negotiation",
        display_label: "JD03 - Job Development: Job Negotiation",
        category: "Direct Service",
        is_primary: true,
        is_secondary: true
      }
    ];

    // Life Skills codes
    const lsCodes = [
      {
        code: "LS01",
        service_type: "life_skills",
        program_type: "vr",
        short_description: "Transportation Training",
        full_description: "Life Skills: Transportation Training",
        display_label: "LS01 - Life Skills: Transportation Training",
        category: "Direct Service",
        is_primary: true,
        is_secondary: false
      },
      {
        code: "LS02",
        service_type: "life_skills",
        program_type: "vr",
        short_description: "Work-Related Soft Skills",
        full_description: "Life Skills: Work-Related Soft Skills",
        display_label: "LS02 - Life Skills: Work-Related Soft Skills",
        category: "Direct Service",
        is_primary: true,
        is_secondary: false
      },
      {
        code: "LS03",
        service_type: "life_skills",
        program_type: "vr",
        short_description: "Financial Literacy",
        full_description: "Life Skills: Financial Literacy",
        display_label: "LS03 - Life Skills: Financial Literacy",
        category: "Direct Service",
        is_primary: true,
        is_secondary: false
      }
    ];

    const allCodes = [...jcCodes, ...jdCodes, ...lsCodes];
    
    // Clear existing codes
    const existing = await base44.asServiceRole.entities.ServiceCode.list();
    for (const code of existing) {
      await base44.asServiceRole.entities.ServiceCode.delete(code.id);
    }

    // Bulk create new codes
    await base44.asServiceRole.entities.ServiceCode.bulkCreate(allCodes);

    return Response.json({
      status: 'success',
      message: `Seeded ${allCodes.length} service codes`,
      codes_by_type: {
        job_coaching: jcCodes.length,
        job_development: jdCodes.length,
        life_skills: lsCodes.length
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});