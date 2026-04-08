import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Job Coaching service codes (15 USOR approved codes)
     const jcCodes = [
       {
         code: "JC01",
         service_type: "job_coaching",
         program_type: "vr",
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
         program_type: "vr",
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
         program_type: "vr",
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
         program_type: "vr",
         short_description: "Follow-Up Support",
         full_description: "Job Coaching: Follow-Up Support",
         display_label: "JC04 - Job Coaching: Follow-Up Support",
         category: "Direct Service",
         is_primary: true,
         is_secondary: true
       },
       {
         code: "JC05",
         service_type: "job_coaching",
         program_type: "vr",
         short_description: "Behavior Management Coaching",
         full_description: "Job Coaching: Behavior Management Coaching",
         display_label: "JC05 - Job Coaching: Behavior Management Coaching",
         category: "Direct Service",
         is_primary: true,
         is_secondary: true
       },
       {
         code: "JC06",
         service_type: "job_coaching",
         program_type: "vr",
         short_description: "Safety Training & Compliance",
         full_description: "Job Coaching: Safety Training & Compliance",
         display_label: "JC06 - Job Coaching: Safety Training & Compliance",
         category: "Direct Service",
         is_primary: true,
         is_secondary: true
       },
       {
         code: "JC07",
         service_type: "job_coaching",
         program_type: "vr",
         short_description: "Performance Review Coaching",
         full_description: "Job Coaching: Performance Review Coaching",
         display_label: "JC07 - Job Coaching: Performance Review Coaching",
         category: "Direct Service",
         is_primary: true,
         is_secondary: true
       },
       {
         code: "JC08",
         service_type: "job_coaching",
         program_type: "vr",
         short_description: "Workplace Accommodation Setup",
         full_description: "Job Coaching: Workplace Accommodation Setup",
         display_label: "JC08 - Job Coaching: Workplace Accommodation Setup",
         category: "Indirect Service",
         is_primary: true,
         is_secondary: true
       },
       {
         code: "JC09",
         service_type: "job_coaching",
         program_type: "vr",
         short_description: "Team Communication Support",
         full_description: "Job Coaching: Team Communication Support",
         display_label: "JC09 - Job Coaching: Team Communication Support",
         category: "Direct Service",
         is_primary: true,
         is_secondary: true
       },
       {
         code: "JC10",
         service_type: "job_coaching",
         program_type: "vr",
         short_description: "Task Modification & Adaptation",
         full_description: "Job Coaching: Task Modification & Adaptation",
         display_label: "JC10 - Job Coaching: Task Modification & Adaptation",
         category: "Direct Service",
         is_primary: true,
         is_secondary: true
       },
       {
         code: "JC11",
         service_type: "job_coaching",
         program_type: "vr",
         short_description: "Supervisor Consultation",
         full_description: "Job Coaching: Supervisor Consultation",
         display_label: "JC11 - Job Coaching: Supervisor Consultation",
         category: "Indirect Service",
         is_primary: true,
         is_secondary: true
       },
       {
         code: "JC12",
         service_type: "job_coaching",
         program_type: "vr",
         short_description: "Problem-Solving Coaching",
         full_description: "Job Coaching: Problem-Solving Coaching",
         display_label: "JC12 - Job Coaching: Problem-Solving Coaching",
         category: "Direct Service",
         is_primary: true,
         is_secondary: true
       },
       {
         code: "JC13",
         service_type: "job_coaching",
         program_type: "vr",
         short_description: "Job Retention Planning",
         full_description: "Job Coaching: Job Retention Planning",
         display_label: "JC13 - Job Coaching: Job Retention Planning",
         category: "Indirect Service",
         is_primary: true,
         is_secondary: true
       },
       {
         code: "JC14",
         service_type: "job_coaching",
         program_type: "vr",
         short_description: "Work Schedule Adjustment",
         full_description: "Job Coaching: Work Schedule Adjustment",
         display_label: "JC14 - Job Coaching: Work Schedule Adjustment",
         category: "Indirect Service",
         is_primary: true,
         is_secondary: true
       },
       {
         code: "JC15",
         service_type: "job_coaching",
         program_type: "vr",
         short_description: "Career Development Planning",
         full_description: "Job Coaching: Career Development Planning",
         display_label: "JC15 - Job Coaching: Career Development Planning",
         category: "Indirect Service",
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