import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Seed ReportFieldTemplate records for job_coaching, job_development, life_skills
 * This enables dynamic questions in the UI
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    // Get entry types
    const entryTypes = await base44.entities.EntryType.filter({
      code: { $in: ['job_coaching', 'job_development', 'life_skills'] },
      is_active: true
    });

    const typeMap = {};
    entryTypes.forEach(t => { typeMap[t.code] = t; });

    const results = {};

    // ===== JOB COACHING TEMPLATES =====
    if (typeMap['job_coaching']) {
      const jobCoachingFields = [
        {
          entry_type_id: typeMap['job_coaching'].id,
          entry_type_code: 'job_coaching',
          field_key: 'employer_name',
          label: 'Employer Name',
          field_type: 'text',
          is_required: true,
          order: 1,
          section: 'Work Details'
        },
        {
          entry_type_id: typeMap['job_coaching'].id,
          entry_type_code: 'job_coaching',
          field_key: 'job_title',
          label: 'Job Title',
          field_type: 'text',
          is_required: true,
          order: 2,
          section: 'Work Details'
        },
        {
          entry_type_id: typeMap['job_coaching'].id,
          entry_type_code: 'job_coaching',
          field_key: 'tasks_performed',
          label: 'Tasks Performed',
          field_type: 'textarea',
          is_required: true,
          order: 3,
          section: 'Session Details'
        },
        {
          entry_type_id: typeMap['job_coaching'].id,
          entry_type_code: 'job_coaching',
          field_key: 'level_of_support',
          label: 'Level of Support Provided',
          field_type: 'select',
          options: ['Minimal', 'Moderate', 'Intensive', 'Maximum'],
          is_required: true,
          order: 4,
          section: 'Support'
        }
      ];
      
      const createdCoaching = await base44.entities.ReportFieldTemplate.bulkCreate(jobCoachingFields);
      results['job_coaching'] = {
        created: createdCoaching.length,
        fields: jobCoachingFields.map(f => f.field_key)
      };
    }

    // ===== JOB DEVELOPMENT TEMPLATES =====
    if (typeMap['job_development']) {
      const jobDevFields = [
        {
          entry_type_id: typeMap['job_development'].id,
          entry_type_code: 'job_development',
          field_key: 'job_market_research',
          label: 'Job Market Research Conducted',
          field_type: 'textarea',
          is_required: true,
          order: 1,
          section: 'Research'
        },
        {
          entry_type_id: typeMap['job_development'].id,
          entry_type_code: 'job_development',
          field_key: 'employers_contacted',
          label: 'Employers Contacted',
          field_type: 'text',
          is_required: true,
          order: 2,
          section: 'Outreach'
        },
        {
          entry_type_id: typeMap['job_development'].id,
          entry_type_code: 'job_development',
          field_key: 'job_leads_generated',
          label: 'Job Leads Generated',
          field_type: 'number',
          is_required: false,
          order: 3,
          section: 'Outreach'
        },
        {
          entry_type_id: typeMap['job_development'].id,
          entry_type_code: 'job_development',
          field_key: 'strategies_used',
          label: 'Job Development Strategies Used',
          field_type: 'multiselect',
          options: ['Cold Calling', 'Networking', 'Job Boards', 'Referrals', 'Hidden Market'],
          is_required: true,
          order: 4,
          section: 'Strategy'
        }
      ];

      const createdDev = await base44.entities.ReportFieldTemplate.bulkCreate(jobDevFields);
      results['job_development'] = {
        created: createdDev.length,
        fields: jobDevFields.map(f => f.field_key)
      };
    }

    // ===== LIFE SKILLS TEMPLATES =====
    if (typeMap['life_skills']) {
      const lifeSkillsFields = [
        {
          entry_type_id: typeMap['life_skills'].id,
          entry_type_code: 'life_skills',
          field_key: 'skill_area',
          label: 'Life Skills Area',
          field_type: 'select',
          options: ['Financial Literacy', 'Transportation', 'Housing', 'Health/Wellness', 'Social Skills', 'Communication', 'Time Management', 'Other'],
          is_required: true,
          order: 1,
          section: 'Focus Area'
        },
        {
          entry_type_id: typeMap['life_skills'].id,
          entry_type_code: 'life_skills',
          field_key: 'skill_taught',
          label: 'Specific Skill Taught',
          field_type: 'text',
          is_required: true,
          order: 2,
          section: 'Focus Area'
        },
        {
          entry_type_id: typeMap['life_skills'].id,
          entry_type_code: 'life_skills',
          field_key: 'client_progress',
          label: 'Client Progress/Mastery Level',
          field_type: 'select',
          options: ['Introduced', 'Developing', 'Proficient', 'Mastered'],
          is_required: true,
          order: 3,
          section: 'Progress'
        },
        {
          entry_type_id: typeMap['life_skills'].id,
          entry_type_code: 'life_skills',
          field_key: 'practice_completed',
          label: 'Practice/Homework Assigned',
          field_type: 'boolean',
          is_required: false,
          order: 4,
          section: 'Progress'
        }
      ];

      const createdSkills = await base44.entities.ReportFieldTemplate.bulkCreate(lifeSkillsFields);
      results['life_skills'] = {
        created: createdSkills.length,
        fields: lifeSkillsFields.map(f => f.field_key)
      };
    }

    return Response.json({
      success: true,
      seeded_at: new Date().toISOString(),
      summary: results
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});