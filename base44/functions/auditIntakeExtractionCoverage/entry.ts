import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Audits intake extraction coverage for a client.
 * 
 * For each IntakeSection:
 * - Lists actual answer_keys
 * - Compares against INTAKE_TO_VFP_MAPPING expectations
 * - Reports matched vs unmapped fields
 * - Generates coverage summary
 */

const INTAKE_TO_VFP_MAPPING = {
  barriers_support: {
    extract: (answers) => ({
      ...extractBarriersSupportByAnswerKey(answers),
    }),
    expectedAnswerKeys: ['barriers_list', 'accommodations_needed', 'technology_barriers', 'communication_barriers', 'sensory_needs', 'job_coach_needed', 'support_level'],
  },
  medications: {
    extract: (answers) => extractMedicationsByAnswerKey(answers),
    expectedAnswerKeys: ['medication_list', 'side_effects', 'energy_level', 'cognitive_impact'],
  },
  transportation: {
    extract: (answers) => extractTransportationByAnswerKey(answers),
    expectedAnswerKeys: ['has_reliable_transportation', 'transportation_method', 'transportation_barriers', 'schedule_impact'],
  },
  work_preferences: {
    extract: (answers) => ({
      preferred_work_environment: extractWorkEnvironment(answers),
      independent_vs_team_preference: extractTeamPreference(answers),
      customer_interaction_tolerance: extractCustomerTolerance(answers),
    }),
    expectedAnswerKeys: ['work_environment', 'team_preference', 'customer_interaction'],
  },
  accommodations: {
    extract: (answers) => ({
      accommodation_needs: extractAccommodations(answers),
      physical_limitations: extractPhysicalLimitations(answers),
      sensory_limitations: extractSensoryLimitations(answers),
    }),
    expectedAnswerKeys: ['accommodation_type', 'physical_needs', 'sensory_needs'],
  },
  schedule_availability: {
    extract: (answers) => ({
      schedule_constraints: extractScheduleConstraints(answers),
    }),
    expectedAnswerKeys: ['work_hours', 'availability', 'constraints'],
  },
  support_systems: {
    extract: (answers) => ({
      support_contacts: extractSupportContacts(answers),
      social_tolerance: extractSocialTolerance(answers),
    }),
    expectedAnswerKeys: ['support_type', 'family_support', 'professional_support', 'peer_support'],
  },
  employment_goals: {
    extract: (answers) => ({
      work_goal_themes: extractGoalThemes(answers),
    }),
    expectedAnswerKeys: ['primary_goal', 'job_title', 'industry', 'timeline'],
  },
  communication_preferences: {
    extract: (answers) => ({
      communication_style: extractCommunicationStyle(answers),
    }),
    expectedAnswerKeys: ['preferred_communication', 'written_vs_verbal'],
  },
  // Sections without mappings yet
  emergency_contact: {
    extract: () => ({}),
    expectedAnswerKeys: ['name', 'phone', 'relationship'],
  },
  benefits: {
    extract: () => ({}),
    expectedAnswerKeys: ['benefits_type', 'benefits_status'],
  },
  documents_available: {
    extract: () => ({}),
    expectedAnswerKeys: ['document_type', 'available'],
  },
  vr_referral: {
    extract: () => ({}),
    expectedAnswerKeys: ['vr_status', 'referral_date'],
  },
  basic_info: {
    extract: () => ({}),
    expectedAnswerKeys: ['name', 'dob', 'contact'],
  },
  education: {
    extract: () => ({}),
    expectedAnswerKeys: ['education_level', 'major', 'graduation_date'],
  },
  employment_history: {
    extract: () => ({}),
    expectedAnswerKeys: ['job_title', 'employer', 'dates'],
  },
};

// Stub helpers for audit (actual implementations in extractVFPFromIntake)
function extractBarriersSupportByAnswerKey() { return {}; }
function extractMedicationsByAnswerKey() { return {}; }
function extractTransportationByAnswerKey() { return {}; }
function extractWorkEnvironment() { return null; }
function extractTeamPreference() { return null; }
function extractCustomerTolerance() { return null; }
function extractAccommodations() { return null; }
function extractPhysicalLimitations() { return null; }
function extractSensoryLimitations() { return null; }
function extractScheduleConstraints() { return null; }
function extractSupportContacts() { return null; }
function extractSocialTolerance() { return null; }
function extractGoalThemes() { return null; }
function extractCommunicationStyle() { return null; }

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { client_id } = await req.json();
    if (!client_id) {
      return Response.json({ error: 'client_id required' }, { status: 400 });
    }

    const intakeSections = await base44.entities.IntakeSection.filter({ client_id });
    const report = {
      client_id,
      total_sections: intakeSections.length,
      sections_by_type: {},
      coverage_by_section: {},
      total_answer_keys_found: 0,
      total_answer_keys_mapped: 0,
      unmapped_by_section: {},
    };

    const allUnmappedKeys = {};

    for (const section of intakeSections) {
      const { section_key, status, answers } = section;
      const answerKeys = Object.keys(answers || {});
      
      if (!report.sections_by_type[section_key]) {
        report.sections_by_type[section_key] = 0;
      }
      report.sections_by_type[section_key]++;

      const mapping = INTAKE_TO_VFP_MAPPING[section_key];
      const expectedKeys = mapping?.expectedAnswerKeys || [];

      report.total_answer_keys_found += answerKeys.length;

      const coverage = {
        status,
        total_answer_keys: answerKeys.length,
        actual_answer_keys: answerKeys,
        expected_answer_keys: expectedKeys,
        matched: answerKeys.filter(k => expectedKeys.includes(k)),
        unmapped: answerKeys.filter(k => !expectedKeys.includes(k)),
      };

      report.coverage_by_section[`${section_key}:${section.id}`] = coverage;
      report.total_answer_keys_mapped += coverage.matched.length;

      if (coverage.unmapped.length > 0) {
        if (!report.unmapped_by_section[section_key]) {
          report.unmapped_by_section[section_key] = [];
        }
        report.unmapped_by_section[section_key].push(...coverage.unmapped);

        coverage.unmapped.forEach(key => {
          if (!allUnmappedKeys[key]) {
            allUnmappedKeys[key] = { count: 0, sections: [] };
          }
          allUnmappedKeys[key].count++;
          if (!allUnmappedKeys[key].sections.includes(section_key)) {
            allUnmappedKeys[key].sections.push(section_key);
          }
        });
      }
    }

    // Deduplicate unmapped keys per section
    Object.keys(report.unmapped_by_section).forEach(section_key => {
      report.unmapped_by_section[section_key] = [...new Set(report.unmapped_by_section[section_key])];
    });

    report.all_unmapped_keys = allUnmappedKeys;
    report.coverage_percentage = report.total_answer_keys_found > 0 
      ? ((report.total_answer_keys_mapped / report.total_answer_keys_found) * 100).toFixed(1)
      : 0;

    console.log(JSON.stringify(report, null, 2));

    return Response.json(report);
  } catch (error) {
    console.error('[auditIntakeExtractionCoverage] ERROR:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});