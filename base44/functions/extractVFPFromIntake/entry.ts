import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Maps intake section data to normalized VFP signals.
 * Augments existing vocational_facts_profile without replacing.
 * 
 * Reads IntakeSection records and extracts:
 * - barriers_support, medications, transportation, work_preferences
 * - accommodations, schedule_availability, support_systems
 * - education, employment_history, goals
 * - legal/safety concerns, communication preferences
 * - sensory/environment preferences
 * 
 * Normalizes into VFP fields with source tracking.
 */

const INTAKE_TO_VFP_MAPPING = {
  barriers_support: {
    extract: (answers) => ({
      barriers: extractBarriers(answers),
      support_needs: extractSupportNeeds(answers),
      safety_risk_flags: extractSafetyRisks(answers),
    }),
  },
  medications: {
    extract: (answers) => ({
      medication_side_effect_flags: extractMedicationEffects(answers),
    }),
  },
  transportation: {
    extract: (answers) => ({
      transportation_reliability: extractTransportation(answers),
    }),
  },
  work_preferences: {
    extract: (answers) => ({
      preferred_work_environment: extractWorkEnvironment(answers),
      independent_vs_team_preference: extractTeamPreference(answers),
      customer_interaction_tolerance: extractCustomerTolerance(answers),
    }),
  },
  accommodations: {
    extract: (answers) => ({
      accommodation_needs: extractAccommodations(answers),
      physical_limitations: extractPhysicalLimitations(answers),
      sensory_limitations: extractSensoryLimitations(answers),
    }),
  },
  schedule_availability: {
    extract: (answers) => ({
      schedule_constraints: extractScheduleConstraints(answers),
    }),
  },
  support_systems: {
    extract: (answers) => ({
      support_contacts: extractSupportContacts(answers),
      social_tolerance: extractSocialTolerance(answers),
    }),
  },
  education: {
    extract: (answers) => ({
      education_level: extractEducationLevel(answers),
    }),
  },
  employment_history: {
    extract: (answers) => ({
      strengths: extractStrengthsFromEmployment(answers),
      stamina_endurance_concerns: extractStamina(answers),
    }),
  },
  goals: {
    extract: (answers) => ({
      work_goal_themes: extractGoalThemes(answers),
    }),
  },
  communication_preferences: {
    extract: (answers) => ({
      communication_style: extractCommunicationStyle(answers),
    }),
  },
};

// ── EXTRACTION HELPERS ──

function extractBarriers(answers) {
  const text = Object.values(answers || {})
    .filter(v => typeof v === 'string')
    .join(' ')
    .toLowerCase();

  const barriers = [];
  const patterns = {
    physical: ['physical', 'mobility', 'pain', 'injury', 'disability'],
    cognitive: ['cognitive', 'memory', 'attention', 'learning difficulty'],
    mental_health: ['anxiety', 'depression', 'ptsd', 'trauma', 'mental health'],
    substance: ['substance', 'addiction', 'recovery'],
    social: ['social anxiety', 'isolation', 'discrimination'],
  };

  for (const [key, keywords] of Object.entries(patterns)) {
    if (keywords.some(kw => text.includes(kw))) {
      barriers.push(key);
    }
  }

  return barriers.length > 0 ? barriers : null;
}

function extractSupportNeeds(answers) {
  const text = Object.values(answers || {}).join(' ').toLowerCase();
  const needs = [];

  if (text.includes('childcare') || text.includes('child care')) needs.push('childcare');
  if (text.includes('transportation')) needs.push('transportation');
  if (text.includes('housing')) needs.push('housing');
  if (text.includes('healthcare') || text.includes('medical')) needs.push('healthcare');
  if (text.includes('counseling') || text.includes('therapy')) needs.push('counseling');
  if (text.includes('job coach')) needs.push('job_coaching');
  if (text.includes('advocate') || text.includes('advocacy')) needs.push('advocacy');

  return needs.length > 0 ? needs : null;
}

function extractSafetyRisks(answers) {
  const text = Object.values(answers || {}).join(' ').toLowerCase();
  const flags = [];

  if (text.includes('violence') || text.includes('domestic abuse')) flags.push('violence_history');
  if (text.includes('criminal') || text.includes('felony')) flags.push('criminal_history');
  if (text.includes('suicidal') || text.includes('self-harm')) flags.push('suicidal_ideation');
  if (text.includes('risk')) flags.push('elevated_risk');

  return flags.length > 0 ? flags : null;
}

function extractMedicationEffects(answers) {
  const text = Object.values(answers || {}).join(' ').toLowerCase();
  const flags = [];

  if (text.includes('drowsy') || text.includes('fatigue') || text.includes('sedating')) flags.push('sedation');
  if (text.includes('tremor') || text.includes('motor')) flags.push('motor_effects');
  if (text.includes('cognitive') || text.includes('concentration')) flags.push('cognitive_effects');
  if (text.includes('mood') || text.includes('emotional')) flags.push('mood_effects');
  if (text.includes('weight') || text.includes('appetite')) flags.push('metabolic_effects');

  return flags.length > 0 ? flags : null;
}

function extractTransportation(answers) {
  const text = Object.values(answers || {}).join(' ').toLowerCase();

  if (text.includes('no car') || text.includes('no vehicle') || text.includes('cannot drive')) {
    return 'requires_transit';
  }
  if (text.includes('reliable') || text.includes('own car') || text.includes('can drive')) {
    return 'has_vehicle';
  }
  if (text.includes('sometimes') || text.includes('inconsistent')) {
    return 'unreliable';
  }

  return null;
}

function extractWorkEnvironment(answers) {
  const text = Object.values(answers || {}).join(' ').toLowerCase();

  const preferences = [];
  if (text.includes('outdoor')) preferences.push('outdoor');
  if (text.includes('indoor')) preferences.push('indoor');
  if (text.includes('quiet')) preferences.push('low_noise');
  if (text.includes('structured')) preferences.push('structured');
  if (text.includes('flexible')) preferences.push('flexible');
  if (text.includes('retail') || text.includes('customer facing')) preferences.push('customer_facing');
  if (text.includes('behind scenes') || text.includes('no customer')) preferences.push('non_customer_facing');

  return preferences.length > 0 ? preferences : null;
}

function extractTeamPreference(answers) {
  const text = Object.values(answers || {}).join(' ').toLowerCase();

  if (text.includes('work alone') || text.includes('independent')) return 'independent';
  if (text.includes('team') || text.includes('collaborative') || text.includes('group')) return 'team_oriented';

  return null;
}

function extractCustomerTolerance(answers) {
  const text = Object.values(answers || {}).join(' ').toLowerCase();

  if (text.includes('no customer') || text.includes('avoid people')) return 'low';
  if (text.includes('some customer') || text.includes('limited interaction')) return 'moderate';
  if (text.includes('enjoy customer') || text.includes('high interaction')) return 'high';

  return null;
}

function extractAccommodations(answers) {
  const text = Object.values(answers || {}).join(' ').toLowerCase();
  const accommodations = [];

  if (text.includes('flexible schedule') || text.includes('part-time')) accommodations.push('flexible_schedule');
  if (text.includes('work from home') || text.includes('remote')) accommodations.push('remote_work');
  if (text.includes('breaks') || text.includes('frequent breaks')) accommodations.push('frequent_breaks');
  if (text.includes('assistive technology') || text.includes('technology')) accommodations.push('assistive_tech');
  if (text.includes('written instructions')) accommodations.push('written_instructions');
  if (text.includes('visual') || text.includes('large print')) accommodations.push('visual_accommodation');
  if (text.includes('hearing') || text.includes('captioning')) accommodations.push('hearing_accommodation');

  return accommodations.length > 0 ? accommodations : null;
}

function extractPhysicalLimitations(answers) {
  const text = Object.values(answers || {}).join(' ').toLowerCase();
  const limitations = [];

  if (text.includes('sitting') || text.includes('sedentary')) limitations.push('prolonged_sitting');
  if (text.includes('standing')) limitations.push('prolonged_standing');
  if (text.includes('lifting') || text.includes('heavy')) limitations.push('lifting');
  if (text.includes('reach') || text.includes('fine motor')) limitations.push('fine_motor');
  if (text.includes('walk') || text.includes('stairs')) limitations.push('mobility');

  return limitations.length > 0 ? limitations : null;
}

function extractSensoryLimitations(answers) {
  const text = Object.values(answers || {}).join(' ').toLowerCase();
  const limitations = [];

  if (text.includes('blind') || text.includes('vision')) limitations.push('vision');
  if (text.includes('deaf') || text.includes('hearing')) limitations.push('hearing');
  if (text.includes('noise sensitive') || text.includes('sound sensitive')) limitations.push('sound_sensitivity');
  if (text.includes('light sensitive') || text.includes('fluorescent')) limitations.push('light_sensitivity');
  if (text.includes('touch sensitive') || text.includes('sensory processing')) limitations.push('touch_sensitivity');

  return limitations.length > 0 ? limitations : null;
}

function extractScheduleConstraints(answers) {
  const text = Object.values(answers || {}).join(' ').toLowerCase();
  const constraints = [];

  if (text.includes('childcare') || text.includes('school pickup')) constraints.push('childcare_hours');
  if (text.includes('no nights') || text.includes('no evenings')) constraints.push('no_evenings');
  if (text.includes('no weekends')) constraints.push('no_weekends');
  if (text.includes('specific hours') || text.includes('certain times')) constraints.push('specific_hours');
  if (text.includes('medical appointments') || text.includes('therapy')) constraints.push('medical_appointments');

  return constraints.length > 0 ? constraints : null;
}

function extractSupportContacts(answers) {
  const contacts = [];
  const text = Object.values(answers || {}).join(' ');

  if (text.includes('family') || text.includes('spouse') || text.includes('parent')) {
    contacts.push('family');
  }
  if (text.includes('friend') || text.includes('peer support')) {
    contacts.push('friends');
  }
  if (text.includes('counselor') || text.includes('therapist') || text.includes('case manager')) {
    contacts.push('professional');
  }

  return contacts.length > 0 ? contacts : null;
}

function extractSocialTolerance(answers) {
  const text = Object.values(answers || {}).join(' ').toLowerCase();

  if (text.includes('social anxiety') || text.includes('avoid people') || text.includes('isolation')) {
    return 'low';
  }
  if (text.includes('some social difficulty') || text.includes('limited interaction')) {
    return 'moderate';
  }
  if (text.includes('social') && !text.includes('anxiety')) {
    return 'high';
  }

  return null;
}

function extractEducationLevel(answers) {
  const text = Object.values(answers || {}).join(' ').toLowerCase();

  if (text.includes('college') || text.includes('bachelor') || text.includes('graduate')) return 'college';
  if (text.includes('high school') || text.includes('diploma') || text.includes('ged')) return 'high_school';
  if (text.includes('some college')) return 'some_college';

  return null;
}

function extractStrengthsFromEmployment(answers) {
  const strengths = [];
  const text = Object.values(answers || {}).join(' ').toLowerCase();

  if (text.includes('reliable') || text.includes('punctual')) strengths.push('reliability');
  if (text.includes('detail') || text.includes('accuracy') || text.includes('precision')) strengths.push('attention_to_detail');
  if (text.includes('leadership') || text.includes('manage')) strengths.push('leadership');
  if (text.includes('communication') || text.includes('speaking')) strengths.push('communication');
  if (text.includes('problem solving') || text.includes('critical thinking')) strengths.push('problem_solving');
  if (text.includes('creativity') || text.includes('innovative')) strengths.push('creativity');

  return strengths.length > 0 ? strengths : null;
}

function extractStamina(answers) {
  const text = Object.values(answers || {}).join(' ').toLowerCase();

  if (text.includes('fatigue') || text.includes('low energy') || text.includes('tired quickly')) {
    return 'low_endurance';
  }
  if (text.includes('full-time') && text.includes('physical')) {
    return 'high_endurance';
  }

  return null;
}

function extractGoalThemes(answers) {
  const text = Object.values(answers || {}).join(' ').toLowerCase();
  const themes = [];

  if (text.includes('accounting') || text.includes('finance')) themes.push('finance');
  if (text.includes('healthcare') || text.includes('medical')) themes.push('healthcare');
  if (text.includes('technology') || text.includes('it')) themes.push('technology');
  if (text.includes('education') || text.includes('teaching')) themes.push('education');
  if (text.includes('management') || text.includes('leadership')) themes.push('management');
  if (text.includes('retail') || text.includes('sales')) themes.push('sales');
  if (text.includes('creative') || text.includes('art') || text.includes('design')) themes.push('creative');
  if (text.includes('trade') || text.includes('skilled')) themes.push('skilled_trades');

  return themes.length > 0 ? themes : null;
}

// ── MAIN HANDLER ──

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

    // Fetch client
    const clients = await base44.entities.Client.list();
    const client = clients.find(c => c.id === client_id);
    if (!client) {
      return Response.json({ error: 'Client not found' }, { status: 404 });
    }

    // Fetch all IntakeSections for this client
    const intakeSections = await base44.entities.IntakeSection.filter({ client_id });
    const processableSections = (intakeSections || []).filter(s => {
      // Include in_progress and completed; skip assigned, not_started, reviewed, empty
      const hasAnswers = s.answers && Object.keys(s.answers).length > 0;
      const isProcessable = s.status === 'in_progress' || s.status === 'completed';
      return isProcessable && hasAnswers;
    });

    if (!processableSections.length) {
      return Response.json({
        client_id,
        extracted_signals: {},
        source_summary: 'No in-progress or completed intake sections with answers found',
      });
    }

    // Extract VFP signals from intake sections
    const allSignals = {};
    const sourceMetadata = {};
    const logs = [];

    for (const section of processableSections) {
       const { id: section_id, section_key, status, answers } = section;
       const mapping = INTAKE_TO_VFP_MAPPING[section_key];

       if (!mapping || !answers) continue;

       // Determine confidence based on completion status
       const confidence = status === 'completed' ? 'high' : 'medium';

       try {
         const extracted = mapping.extract(answers);
         logs.push(`[${section_key}] status=${status}, confidence=${confidence}, extracted: ${Object.keys(extracted).filter(k => extracted[k] !== null && extracted[k] !== undefined).join(', ')}`);

         for (const [field, value] of Object.entries(extracted)) {
           if (value !== null && value !== undefined) {
             // Initialize source tracking for this field
             if (!sourceMetadata[field]) {
               sourceMetadata[field] = [];
             }

             allSignals[field] = value;
             sourceMetadata[field].push({
               source: 'intake_section',
               section_key,
               section_id,
               status,
               confidence,
               extracted_at: new Date().toISOString(),
             });
           }
         }
       } catch (e) {
         logs.push(`[${section_key}] Error: ${e.message}`);
       }
     }

    // Merge with existing vocational_facts_profile (augment, not replace)
    const existing = client.vocational_facts_profile || {};
    const merged = { ...existing, ...allSignals };

    // Track extraction metadata
    const vocational_facts_profile = {
      ...merged,
      _intake_signals: sourceMetadata,
      _intake_extracted_at: new Date().toISOString(),
      _intake_extracted_by: user.email,
      _intake_sources_count: completedSections.length,
    };

    // Update client
    await base44.entities.Client.update(client_id, {
      vocational_facts_profile,
    });

    logs.push(`[Client] Updated vocational_facts_profile with ${Object.keys(allSignals).length} signals from ${processableSections.length} sections`);
    console.log(logs.join('\n'));

    return Response.json({
      client_id,
      extracted_signals: allSignals,
      source_metadata: sourceMetadata,
      intake_sections_processed: processableSections.length,
      total_vfp_fields: Object.keys(merged).length,
      logs,
      status: 'success',
    });
    } catch (error) {
    console.error('[extractVFPFromIntake] ERROR:', error.message, error.stack);
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
    }
});