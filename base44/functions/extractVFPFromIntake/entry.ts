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
      ...extractBarriersSupportByAnswerKey(answers),
      safety_risk_flags: extractSafetyRisks(answers),
    }),
  },
  medications: {
    extract: (answers) => extractMedicationsByAnswerKey(answers),
  },
  transportation: {
    extract: (answers) => extractTransportationByAnswerKey(answers),
  },
  employment_goals: {
    extract: (answers) => ({
      work_goal_themes: extractGoalThemesFromAnswers(answers),
      preferred_job_titles: extractJobTitlesFromAnswers(answers),
      job_readiness: extractJobReadinessFromAnswers(answers),
      employer_preferences: extractEmployerPreferencesFromAnswers(answers),
    }),
  },
  social_supports: {
    extract: (answers) => ({
      support_contacts: extractSupportContactsFromAnswers(answers),
      social_tolerance: extractSocialToleranceFromAnswers(answers),
      support_needs: extractSupportNeedsFromAnswers(answers),
    }),
  },
  benefits: {
    extract: (answers) => ({
      benefits_considerations: extractBenefitsFromAnswers(answers),
      support_needs: extractBenefitSupportNeeds(answers),
    }),
  },
  previous_employment: {
    extract: (answers) => ({
      strengths: extractStrengthsFromEmploymentHistory(answers),
      stamina_endurance_concerns: extractStaminaFromHistory(answers),
      preferred_tasks: extractPreferredTasksFromHistory(answers),
    }),
  },
  education_training: {
    extract: (answers) => ({
      education_level: extractEducationLevelFromAnswers(answers),
      preferred_tasks: extractPreferredTasksFromEducation(answers),
      strengths: extractStrengthsFromEducation(answers),
    }),
  },
  basic_info: {
    extract: (answers) => ({
      communication_style: extractCommunicationStyleFromBasicInfo(answers),
    }),
  },
  documents_available: {
    extract: () => ({}),
  },
  vr_referral: {
    extract: () => ({}),
  },
  emergency_contact: {
    extract: () => ({}),
  },
  services_agreement: {
    extract: () => ({}),
  },
  release_of_information: {
    extract: () => ({}),
  },
  references: {
    extract: () => ({}),
  },
  application_employment: {
    extract: () => ({}),
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

/**
 * Extract VFP fields per answer_key within barriers_support section.
 * Maps specific answer keys → [field, field, ...] for targeted signal extraction.
 */
function extractBarriersSupportByAnswerKey(answers) {
  const answerKeyMap = {
    barriers_list: ['barriers'],
    accommodations_needed: ['accommodation_needs', 'support_needs'],
    technology_barriers: ['barriers', 'support_needs'],
    communication_barriers: ['communication_style', 'social_tolerance', 'support_needs'],
    sensory_needs: ['sensory_limitations', 'preferred_work_environment', 'accommodation_needs'],
    job_coach_needed: ['support_needs', 'job_coaching_needs'],
    support_level: ['support_needs', 'independent_vs_team_preference', 'job_readiness_level'],
  };

  const extracted = {};

  // Process each answer_key that exists in the provided answers
  for (const [answerKey, targetFields] of Object.entries(answerKeyMap)) {
    const answerValue = answers[answerKey];

    // Skip empty answers
    if (!answerValue || (typeof answerValue === 'string' && answerValue.trim() === '')) {
      continue;
    }

    // Extract VFP fields appropriate to this answer_key
    for (const field of targetFields) {
      if (!extracted[field]) {
        extracted[field] = null;
      }

      // Extract value based on field type and answer content
      const text = (typeof answerValue === 'string' ? answerValue : JSON.stringify(answerValue)).toLowerCase();

      if (field === 'barriers') {
        const barriers = [];
        if (text.includes('physical') || text.includes('mobility') || text.includes('pain')) barriers.push('physical');
        if (text.includes('cognitive') || text.includes('memory') || text.includes('attention')) barriers.push('cognitive');
        if (text.includes('mental') || text.includes('anxiety') || text.includes('depression')) barriers.push('mental_health');
        if (text.includes('substance') || text.includes('addiction') || text.includes('recovery')) barriers.push('substance');
        if (text.includes('social') || text.includes('isolation') || text.includes('discrimination')) barriers.push('social');
        if (barriers.length > 0) extracted[field] = barriers;
      }

      else if (field === 'accommodation_needs') {
        const accom = [];
        if (text.includes('flexible') || text.includes('part-time')) accom.push('flexible_schedule');
        if (text.includes('remote') || text.includes('home')) accom.push('remote_work');
        if (text.includes('break')) accom.push('frequent_breaks');
        if (text.includes('technology') || text.includes('assistive')) accom.push('assistive_tech');
        if (text.includes('written')) accom.push('written_instructions');
        if (text.includes('visual') || text.includes('large print')) accom.push('visual_accommodation');
        if (text.includes('hearing') || text.includes('caption')) accom.push('hearing_accommodation');
        if (accom.length > 0) extracted[field] = accom;
      }

      else if (field === 'support_needs') {
        const needs = [];
        if (text.includes('childcare') || text.includes('child care')) needs.push('childcare');
        if (text.includes('transportation')) needs.push('transportation');
        if (text.includes('housing')) needs.push('housing');
        if (text.includes('healthcare') || text.includes('medical')) needs.push('healthcare');
        if (text.includes('counseling') || text.includes('therapy')) needs.push('counseling');
        if (text.includes('job coach') || text.includes('coaching')) needs.push('job_coaching');
        if (text.includes('advocate') || text.includes('advocacy')) needs.push('advocacy');
        if (needs.length > 0) extracted[field] = needs;
      }

      else if (field === 'communication_style') {
        if (text.includes('written') || text.includes('email')) extracted[field] = 'written';
        else if (text.includes('verbal') || text.includes('speak')) extracted[field] = 'verbal';
        else if (text.includes('visual') || text.includes('diagram')) extracted[field] = 'visual';
      }

      else if (field === 'social_tolerance') {
        if (text.includes('avoid') || text.includes('isolation') || text.includes('anxiety')) extracted[field] = 'low';
        else if (text.includes('limited') || text.includes('some difficulty')) extracted[field] = 'moderate';
        else if (text.includes('social')) extracted[field] = 'high';
      }

      else if (field === 'sensory_limitations') {
        const limits = [];
        if (text.includes('blind') || text.includes('vision')) limits.push('vision');
        if (text.includes('deaf') || text.includes('hearing')) limits.push('hearing');
        if (text.includes('noise sensitive') || text.includes('sound sensitive')) limits.push('sound_sensitivity');
        if (text.includes('light sensitive') || text.includes('fluorescent')) limits.push('light_sensitivity');
        if (text.includes('touch sensitive') || text.includes('sensory processing')) limits.push('touch_sensitivity');
        if (limits.length > 0) extracted[field] = limits;
      }

      else if (field === 'preferred_work_environment') {
        const prefs = [];
        if (text.includes('outdoor')) prefs.push('outdoor');
        if (text.includes('indoor')) prefs.push('indoor');
        if (text.includes('quiet')) prefs.push('low_noise');
        if (text.includes('structured')) prefs.push('structured');
        if (text.includes('flexible')) prefs.push('flexible');
        if (text.includes('retail') || text.includes('customer')) prefs.push('customer_facing');
        if (text.includes('behind') || text.includes('no customer')) prefs.push('non_customer_facing');
        if (prefs.length > 0) extracted[field] = prefs;
      }

      else if (field === 'independent_vs_team_preference') {
        if (text.includes('alone') || text.includes('independent')) extracted[field] = 'independent';
        else if (text.includes('team') || text.includes('collaborative') || text.includes('group')) extracted[field] = 'team_oriented';
      }

      else if (field === 'job_coaching_needed') {
        if (text.includes('yes') || text.includes('need') || text.includes('required')) extracted[field] = true;
        else if (text.includes('no')) extracted[field] = false;
      }

      else if (field === 'job_readiness_level') {
        if (text.includes('ready') || text.includes('prepared')) extracted[field] = 'ready';
        else if (text.includes('develop') || text.includes('progress')) extracted[field] = 'developing';
        else if (text.includes('early') || text.includes('not ready')) extracted[field] = 'early_stage';
      }
    }
  }

  // Filter out null values
  return Object.fromEntries(Object.entries(extracted).filter(([, v]) => v !== null));
}

/**
 * Extract employment goals answers → work goal themes, job titles, readiness.
 * Answer keys: goal_primary, goal_secondary, job_title_*, timeline_*
 */
function extractGoalThemesFromAnswers(answers) {
  const text = Object.values(answers || {}).join(' ').toLowerCase();
  const themes = [];

  if (text.includes('accounting') || text.includes('finance')) themes.push('finance');
  if (text.includes('healthcare') || text.includes('medical')) themes.push('healthcare');
  if (text.includes('technology') || text.includes('it') || text.includes('software')) themes.push('technology');
  if (text.includes('education') || text.includes('teaching')) themes.push('education');
  if (text.includes('management') || text.includes('leadership')) themes.push('management');
  if (text.includes('retail') || text.includes('sales') || text.includes('customer')) themes.push('sales');
  if (text.includes('creative') || text.includes('art') || text.includes('design') || text.includes('graphic')) themes.push('creative');
  if (text.includes('trade') || text.includes('skilled') || text.includes('construction')) themes.push('skilled_trades');
  if (text.includes('hospitality') || text.includes('food') || text.includes('restaurant')) themes.push('hospitality');
  if (text.includes('transportation') || text.includes('driver')) themes.push('transportation');

  return themes.length > 0 ? themes : null;
}

function extractJobTitlesFromAnswers(answers) {
  const titles = [];
  Object.entries(answers || {}).forEach(([key, value]) => {
    if (key.includes('job_title') || key.includes('title') || key === 'goal_primary') {
      if (value && typeof value === 'string' && value.trim()) {
        titles.push(value.trim());
      }
    }
  });
  return titles.length > 0 ? titles : null;
}

function extractJobReadinessFromAnswers(answers) {
  const text = Object.values(answers || {}).join(' ').toLowerCase();
  if (text.includes('ready') || text.includes('prepared')) return 'ready';
  if (text.includes('develop') || text.includes('work with') || text.includes('skills')) return 'developing';
  if (text.includes('exploring') || text.includes('uncertain') || text.includes('new')) return 'exploring';
  return null;
}

function extractEmployerPreferencesFromAnswers(answers) {
  const prefs = [];
  const text = Object.values(answers || {}).join(' ').toLowerCase();

  if (text.includes('small') || text.includes('startup')) prefs.push('small_company');
  if (text.includes('large') || text.includes('corporation') || text.includes('enterprise')) prefs.push('large_company');
  if (text.includes('nonprofit') || text.includes('non-profit')) prefs.push('nonprofit');
  if (text.includes('government') || text.includes('public sector')) prefs.push('government');
  if (text.includes('family') || text.includes('family-owned')) prefs.push('family_owned');

  return prefs.length > 0 ? prefs : null;
}

/**
 * Extract social supports answers → support contacts, social tolerance, needs.
 * Answer keys: support_type_*, family_*, professional_*, peer_*
 */
function extractSupportContactsFromAnswers(answers) {
  const contacts = [];
  const text = Object.values(answers || {}).join(' ').toLowerCase();

  if (text.includes('family') || text.includes('spouse') || text.includes('parent')) contacts.push('family');
  if (text.includes('friend') || text.includes('peer') || text.includes('social group')) contacts.push('friends');
  if (text.includes('counselor') || text.includes('therapist') || text.includes('case manager') || text.includes('professional')) contacts.push('professional');
  if (text.includes('church') || text.includes('religious') || text.includes('community')) contacts.push('community');

  return contacts.length > 0 ? contacts : null;
}

function extractSocialToleranceFromAnswers(answers) {
  const text = Object.values(answers || {}).join(' ').toLowerCase();

  if (text.includes('isolated') || text.includes('alone') || text.includes('avoid') || text.includes('anxiety')) return 'low';
  if (text.includes('small group') || text.includes('limited') || text.includes('difficulty')) return 'moderate';
  if (text.includes('social') && !text.includes('anxiety')) return 'high';

  return null;
}

function extractSupportNeedsFromAnswers(answers) {
  const needs = [];
  const text = Object.values(answers || {}).join(' ').toLowerCase();

  if (text.includes('emotional') || text.includes('counseling') || text.includes('support')) needs.push('emotional_support');
  if (text.includes('practical') || text.includes('help') || text.includes('assistance')) needs.push('practical_help');
  if (text.includes('advocacy') || text.includes('advocate')) needs.push('advocacy');
  if (text.includes('connection') || text.includes('networking')) needs.push('social_connection');

  return needs.length > 0 ? needs : null;
}

/**
 * Extract benefits answers → considerations and support needs.
 * Answer keys: benefits_*, receiving_*
 */
function extractBenefitsFromAnswers(answers) {
  const considerations = [];
  const text = Object.values(answers || {}).join(' ').toLowerCase();

  if (text.includes('ssi') || text.includes('social security')) considerations.push('ssi_considerations');
  if (text.includes('medicaid') || text.includes('medicare')) considerations.push('health_insurance_concerns');
  if (text.includes('food') || text.includes('snap')) considerations.push('food_assistance');
  if (text.includes('housing') || text.includes('rent')) considerations.push('housing_assistance');
  if (text.includes('childcare')) considerations.push('childcare_support');
  if (text.includes('work incentive') || text.includes('ticket')) considerations.push('work_incentive_aware');

  return considerations.length > 0 ? considerations : null;
}

function extractBenefitSupportNeeds(answers) {
  const text = Object.values(answers || {}).join(' ').toLowerCase();
  if (text.includes('benefits counseling') || text.includes('benefits')) {
    return ['benefits_counseling'];
  }
  return null;
}

/**
 * Extract employment history → strengths, stamina, preferred tasks.
 * Answer keys: emp_title_*, emp_employer_*, emp_duration_*, accomplishments_*
 */
function extractStrengthsFromEmploymentHistory(answers) {
  const strengths = [];
  const text = Object.values(answers || {}).join(' ').toLowerCase();

  if (text.includes('reliable') || text.includes('punctual') || text.includes('attendance')) strengths.push('reliability');
  if (text.includes('detail') || text.includes('accuracy') || text.includes('precision') || text.includes('organized')) strengths.push('attention_to_detail');
  if (text.includes('lead') || text.includes('manage') || text.includes('supervised')) strengths.push('leadership');
  if (text.includes('communication') || text.includes('speaking') || text.includes('interpersonal')) strengths.push('communication');
  if (text.includes('problem') || text.includes('solve') || text.includes('critical think')) strengths.push('problem_solving');
  if (text.includes('creative') || text.includes('innovate') || text.includes('idea')) strengths.push('creativity');
  if (text.includes('technical') || text.includes('skill') || text.includes('expertise')) strengths.push('technical');
  if (text.includes('team') || text.includes('collaborate') || text.includes('work together')) strengths.push('teamwork');

  return strengths.length > 0 ? strengths : null;
}

function extractStaminaFromHistory(answers) {
  const text = Object.values(answers || {}).join(' ').toLowerCase();

  if (text.includes('part-time') || text.includes('part time')) return 'low_endurance';
  if (text.includes('full-time') || text.includes('full time')) return 'high_endurance';
  if (text.includes('temporary') || text.includes('seasonal')) return 'moderate_endurance';

  return null;
}

function extractPreferredTasksFromHistory(answers) {
  const tasks = [];
  const text = Object.values(answers || {}).join(' ').toLowerCase();

  if (text.includes('hands-on') || text.includes('hands on')) tasks.push('hands_on');
  if (text.includes('behind desk') || text.includes('office')) tasks.push('desk_work');
  if (text.includes('customer') || text.includes('interaction')) tasks.push('customer_facing');
  if (text.includes('independent') || text.includes('self-directed')) tasks.push('independent_work');
  if (text.includes('routine') || text.includes('structured')) tasks.push('structured_tasks');
  if (text.includes('creative') || text.includes('variety')) tasks.push('varied_tasks');

  return tasks.length > 0 ? tasks : null;
}

/**
 * Extract education/training → education level, preferred tasks, strengths.
 * Answer keys: edu_level_*, institution_*, degree_*, field_*, gpa_*
 */
function extractEducationLevelFromAnswers(answers) {
  const text = Object.values(answers || {}).join(' ').toLowerCase();

  if (text.includes('college') || text.includes('bachelor') || text.includes('masters') || text.includes('graduate')) return 'college';
  if (text.includes('some college') || text.includes('associate')) return 'some_college';
  if (text.includes('high school') || text.includes('diploma') || text.includes('ged')) return 'high_school';
  if (text.includes('certificate') || text.includes('training program')) return 'certificate';

  return null;
}

function extractPreferredTasksFromEducation(answers) {
  const tasks = [];
  const text = Object.values(answers || {}).join(' ').toLowerCase();

  if (text.includes('research') || text.includes('analysis')) tasks.push('analytical_work');
  if (text.includes('project') || text.includes('organize')) tasks.push('project_management');
  if (text.includes('teach') || text.includes('training')) tasks.push('teaching');
  if (text.includes('writing') || text.includes('communication')) tasks.push('writing');
  if (text.includes('hands') || text.includes('practical')) tasks.push('hands_on');

  return tasks.length > 0 ? tasks : null;
}

function extractStrengthsFromEducation(answers) {
  const strengths = [];
  const text = Object.values(answers || {}).join(' ').toLowerCase();

  if (text.includes('high gpa') || text.includes('excellent') || text.includes('honors')) strengths.push('academic_excellence');
  if (text.includes('scholarship') || text.includes('award')) strengths.push('recognized_achievement');
  if (text.includes('specialized') || text.includes('expertise')) strengths.push('specialization');

  return strengths.length > 0 ? strengths : null;
}

/**
 * Extract basic info → communication style.
 * Answer keys: communication_*, preferred_*
 */
function extractCommunicationStyleFromBasicInfo(answers) {
  const text = Object.values(answers || {}).join(' ').toLowerCase();

  if (text.includes('written') || text.includes('email') || text.includes('text')) return 'written';
  if (text.includes('verbal') || text.includes('speak') || text.includes('phone')) return 'verbal';
  if (text.includes('visual') || text.includes('diagram') || text.includes('picture')) return 'visual';
  if (text.includes('face') || text.includes('in-person')) return 'face_to_face';

  return null;
}

/**
 * Extract transportation section answers into VFP fields.
 * Maps specific answer_keys → [field, field, ...] for targeted signal extraction.
 * 
 * Answer keys:
 * - has_reliable_transportation: yes/no/sometimes
 * - transportation_method: owns_vehicle, public_transit, carpool, other
 * - transportation_barriers: list of barriers (no_car, no_license, mobility, cost, etc)
 * - schedule_impact: early_start, late_finish, shift_specific, childcare_pickup, medical_appts
 */
function extractTransportationByAnswerKey(answers) {
  const answerKeyMap = {
    has_reliable_transportation: ['transportation_reliability', 'barriers'],
    transportation_method: ['transportation_reliability', 'schedule_constraints'],
    transportation_barriers: ['transportation_limitations', 'barriers', 'support_needs'],
    schedule_impact: ['schedule_constraints', 'barriers'],
  };

  const extracted = {};

  for (const [answerKey, targetFields] of Object.entries(answerKeyMap)) {
    const answerValue = answers[answerKey];
    if (!answerValue || (typeof answerValue === 'string' && answerValue.trim() === '')) {
      continue;
    }

    const text = (typeof answerValue === 'string' ? answerValue : JSON.stringify(answerValue)).toLowerCase();

    for (const field of targetFields) {
      if (!extracted[field]) {
        extracted[field] = null;
      }

      if (field === 'transportation_reliability') {
        if (text.includes('no') || text.includes('none') || text.includes('unreliable')) {
          extracted[field] = 'unreliable';
        } else if (text.includes('sometimes') || text.includes('inconsistent')) {
          extracted[field] = 'sometimes_available';
        } else if (text.includes('yes') || text.includes('own') || text.includes('reliable')) {
          extracted[field] = 'reliable';
        }
      }

      else if (field === 'transportation_limitations') {
        const limits = [];
        if (text.includes('no car') || text.includes('no vehicle')) limits.push('no_personal_vehicle');
        if (text.includes('no license') || text.includes('cannot drive')) limits.push('no_driver_license');
        if (text.includes('mobility') || text.includes('wheelchair')) limits.push('mobility_access');
        if (text.includes('cost') || text.includes('afford')) limits.push('cost_prohibitive');
        if (text.includes('transit') || text.includes('public')) limits.push('limited_transit');
        if (text.includes('distance') || text.includes('miles')) limits.push('distance_barrier');
        if (limits.length > 0) extracted[field] = limits;
      }

      else if (field === 'schedule_constraints') {
        const constraints = [];
        if (text.includes('early') || text.includes('start')) constraints.push('early_start_required');
        if (text.includes('late') || text.includes('evening')) constraints.push('late_finish_required');
        if (text.includes('shift') || text.includes('specific hours')) constraints.push('shift_specific');
        if (text.includes('childcare') || text.includes('pickup')) constraints.push('childcare_hours');
        if (text.includes('medical') || text.includes('appointment')) constraints.push('medical_appointments');
        if (constraints.length > 0) extracted[field] = constraints;
      }

      else if (field === 'barriers') {
        const barriers = [];
        if (text.includes('transportation') || text.includes('transit')) barriers.push('transportation');
        if (text.includes('mobility') || text.includes('physical')) barriers.push('physical');
        if (text.includes('cost') || text.includes('afford')) barriers.push('financial');
        if (barriers.length > 0) extracted[field] = barriers;
      }

      else if (field === 'support_needs') {
        const needs = [];
        if (text.includes('transportation')) needs.push('transportation');
        if (text.includes('childcare')) needs.push('childcare');
        if (text.includes('mobility') || text.includes('accessible')) needs.push('accessible_transportation');
        if (needs.length > 0) extracted[field] = needs;
      }
    }
  }

  return Object.fromEntries(Object.entries(extracted).filter(([, v]) => v !== null));
}

/**
 * Extract medications section answers into VFP fields.
 * Maps medication_list (and side effects) → work-impact signals.
 * 
 * Answer keys:
 * - medication_list: structured list of medications
 * - side_effects: user-reported side effects
 * - energy_level: high/medium/low
 * - cognitive_impact: none/minimal/moderate/significant
 */
function extractMedicationsByAnswerKey(answers) {
  const answerKeyMap = {
    medication_list: ['medication_side_effect_flags', 'stamina_endurance_concerns', 'support_needs'],
    side_effects: ['medication_side_effect_flags', 'stamina_endurance_concerns', 'accommodation_needs'],
    energy_level: ['stamina_endurance_concerns', 'schedule_constraints'],
    cognitive_impact: ['medication_side_effect_flags', 'support_needs', 'accommodation_needs'],
  };

  const extracted = {};

  for (const [answerKey, targetFields] of Object.entries(answerKeyMap)) {
    const answerValue = answers[answerKey];
    if (!answerValue || (typeof answerValue === 'string' && answerValue.trim() === '')) {
      continue;
    }

    const text = (typeof answerValue === 'string' ? answerValue : JSON.stringify(answerValue)).toLowerCase();

    for (const field of targetFields) {
      if (!extracted[field]) {
        extracted[field] = null;
      }

      if (field === 'medication_side_effect_flags') {
        const flags = [];
        if (text.includes('drowsy') || text.includes('sedating') || text.includes('fatigue')) flags.push('sedation');
        if (text.includes('tremor') || text.includes('shake') || text.includes('motor')) flags.push('motor_effects');
        if (text.includes('cognitive') || text.includes('brain fog') || text.includes('confusion') || text.includes('memory')) flags.push('cognitive_effects');
        if (text.includes('mood') || text.includes('emotional') || text.includes('irritability')) flags.push('mood_effects');
        if (text.includes('weight') || text.includes('appetite') || text.includes('metabolic')) flags.push('metabolic_effects');
        if (text.includes('dizziness') || text.includes('dizzy')) flags.push('dizziness');
        if (text.includes('headache') || text.includes('migraine')) flags.push('headache');
        if (text.includes('nausea') || text.includes('stomach')) flags.push('gi_effects');
        if (flags.length > 0) extracted[field] = flags;
      }

      else if (field === 'stamina_endurance_concerns') {
        if (text.includes('low energy') || text.includes('fatigue') || text.includes('tired')) {
          extracted[field] = 'low_endurance';
        } else if (text.includes('mid') || text.includes('moderate')) {
          extracted[field] = 'moderate_endurance';
        } else if (text.includes('high') || text.includes('good energy') || text.includes('full-time')) {
          extracted[field] = 'good_endurance';
        }
      }

      else if (field === 'support_needs') {
        const needs = [];
        if (text.includes('medication management') || text.includes('reminder')) needs.push('medication_reminders');
        if (text.includes('frequent breaks') || text.includes('rest')) needs.push('frequent_breaks');
        if (text.includes('flexible schedule') || text.includes('part-time')) needs.push('flexible_schedule');
        if (text.includes('counseling') || text.includes('support')) needs.push('counseling');
        if (needs.length > 0) extracted[field] = needs;
      }

      else if (field === 'accommodation_needs') {
        const accom = [];
        if (text.includes('frequent breaks') || text.includes('rest period')) accom.push('frequent_breaks');
        if (text.includes('flexible') || text.includes('part-time')) accom.push('flexible_schedule');
        if (text.includes('reduced hours') || text.includes('less than full')) accom.push('reduced_hours');
        if (text.includes('quiet') || text.includes('low stimulation')) accom.push('quiet_workspace');
        if (text.includes('sit')) accom.push('seated_work');
        if (accom.length > 0) extracted[field] = accom;
      }

      else if (field === 'safety_risk_flags') {
        const flags = [];
        if (text.includes('drowsy') || text.includes('sedating')) flags.push('impaired_alertness');
        if (text.includes('tremor') || text.includes('motor')) flags.push('motor_impairment');
        if (text.includes('cognitive') || text.includes('confusion')) flags.push('cognitive_impairment');
        if (text.includes('dizziness') || text.includes('balance')) flags.push('balance_issues');
        if (flags.length > 0) extracted[field] = flags;
      }

      else if (field === 'schedule_constraints') {
        const constraints = [];
        if (text.includes('morning') || text.includes('morning dose')) constraints.push('morning_medication_schedule');
        if (text.includes('afternoon') || text.includes('midday')) constraints.push('afternoon_medication_schedule');
        if (text.includes('evening') || text.includes('bedtime')) constraints.push('evening_medication_schedule');
        if (text.includes('meal') || text.includes('food')) constraints.push('meal_dependent');
        if (constraints.length > 0) extracted[field] = constraints;
      }
    }
  }

  return Object.fromEntries(Object.entries(extracted).filter(([, v]) => v !== null));
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
      _intake_sources_count: processableSections.length,
    };

    // Update client
    logs.push(`[Client] BEFORE UPDATE - current VFP fields: ${Object.keys(existing).length}`);
    logs.push(`[Client] ATTEMPTING UPDATE with vocational_facts_profile containing ${Object.keys(allSignals).length} new signals`);
    
    try {
      const updateResult = await base44.entities.Client.update(client_id, {
        vocational_facts_profile,
        vocational_facts_extracted_at: new Date().toISOString(),
        vocational_facts_extracted_by: user.email,
        vocational_facts_document_count: processableSections.length,
      });
      
      logs.push(`[Client] UPDATE SUCCEEDED - result: ${JSON.stringify(updateResult).substring(0, 200)}`);
      
      // Verify the update actually persisted
      const updatedClient = await base44.entities.Client.list();
      const verifyClient = updatedClient.find(c => c.id === client_id);
      const verifyVFP = verifyClient?.vocational_facts_profile || {};
      
      logs.push(`[Client] VERIFICATION - VFP now has ${Object.keys(verifyVFP).length} fields`);
      logs.push(`[Client] VERIFICATION - vocational_facts_extracted_at: ${verifyClient?.vocational_facts_extracted_at}`);
      logs.push(`[Client] VERIFICATION - vocational_facts_extracted_by: ${verifyClient?.vocational_facts_extracted_by}`);
      
    } catch (updateErr) {
      logs.push(`[Client] UPDATE FAILED: ${updateErr.message}`);
      console.error(logs.join('\n'));
      throw updateErr;
    }

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