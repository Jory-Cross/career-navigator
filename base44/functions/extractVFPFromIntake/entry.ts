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
    extract: (answers) => extractBarriersSupportByAnswerKey(answers),
  },
  medications: {
    extract: (answers) => extractMedicationsByAnswerKey(answers),
  },
  transportation: {
    extract: (answers) => extractTransportationByAnswerKey(answers),
  },
  employment_goals: {
    extract: (answers) => extractEmploymentGoalsByAnswerKey(answers),
  },
  social_supports: {
    extract: (answers) => extractSocialSupportsByAnswerKey(answers),
  },
  benefits: {
    extract: (answers) => extractBenefitsByAnswerKey(answers),
  },
  basic_info: {
    extract: (answers) => extractBasicInfoByAnswerKey(answers),
  },
  documents_available: {
    extract: (answers) => extractDocumentsAvailableByAnswerKey(answers),
  },
  previous_employment: {
    extract: (answers) => extractEmploymentHistoryByAnswerKey(answers),
  },
  education_training: {
    extract: (answers) => extractEducationByAnswerKey(answers),
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

// ── COMPREHENSIVE EXTRACTION HELPERS ──

/**
 * Transportation section → VFP fields
 * 
 * Properly distinguishes between:
 * - has_vehicle === true AND has_license === true → reliable_personal_vehicle
 * - transportation_method includes bus/public transit → relies_on_public_transit
 * - transportation_notes includes paratransit → paratransit_dependent
 * - has_vehicle === false → adds no_personal_vehicle limitation
 * - has_license === false → adds no_driver_license limitation
 */
function extractTransportationByAnswerKey(answers) {
  const extracted = {};
  const text = Object.values(answers || {}).join(' ').toLowerCase();
  const notes = (answers.transportation_notes || '').toLowerCase();
  const method = (answers.transportation_method || '').toLowerCase();

  // Extract boolean fields properly: check for actual 'yes'/'no' or true/false values
  const hasVehicle = answers.has_vehicle === 'yes' || answers.has_vehicle === true;
  const hasLicense = answers.has_license === 'yes' || answers.has_license === true;

  // transportation_reliability - only reliable if BOTH vehicle AND license
  const reliability = [];
  if (hasVehicle && hasLicense) {
    reliability.push('reliable_personal_vehicle');
  } else if (method.includes('bus') || method.includes('public') || method.includes('transit')) {
    reliability.push('relies_on_public_transit');
  } else if (notes.includes('paratransit')) {
    reliability.push('paratransit_dependent');
  } else if (hasVehicle && !hasLicense) {
    reliability.push('vehicle_without_license');
  } else if (!hasVehicle && method) {
    reliability.push('relies_on_alternative_transport');
  }
  if (reliability.length) extracted.transportation_reliability = reliability;

  // transportation_limitations - explicit negative conditions
  const limitations = [];
  if (!hasLicense) limitations.push('no_driver_license');
  if (!hasVehicle) limitations.push('no_personal_vehicle');
  if (notes.includes('paratransit')) limitations.push('requires_scheduled_transportation');
  if (text.includes('mobility') || text.includes('wheelchair')) limitations.push('mobility_access_needed');
  if (text.includes('cost') || text.includes('afford')) limitations.push('cost_prohibitive');
  if (text.includes('distance') || text.includes('far')) limitations.push('distance_barrier');
  if (limitations.length) extracted.transportation_limitations = limitations;

  // schedule_constraints
  const constraints = [];
  const availDays = (answers.available_days || '').toLowerCase();
  const availHours = (answers.available_hours || '').toLowerCase();
  const schedNotes = (answers.schedule_notes || '').toLowerCase();

  if (availDays === 'weekdays' || availDays.includes('weekday')) constraints.push('weekdays_only');
  else if (availDays === 'weekends' || availDays.includes('weekend')) constraints.push('weekends_only');

  if (availHours === 'morning' || schedNotes.includes('morning')) constraints.push('morning_preferred');
  if (availHours === 'afternoon' || schedNotes.includes('afternoon')) constraints.push('afternoon_preferred');
  if (availHours === 'evening' || schedNotes.includes('evening')) constraints.push('evening_preferred');
  if (schedNotes.includes('no overnight') || schedNotes.includes('no night')) constraints.push('no_overnight_shifts');
  if (schedNotes.includes('childcare') || schedNotes.includes('pickup')) constraints.push('childcare_hours');
  if (constraints.length) extracted.schedule_constraints = constraints;

  // work_availability
  if (availHours && availHours !== 'flexible') {
    extracted.work_availability = [availHours];
  } else if (!constraints.length && (hasVehicle || method.includes('bus') || method.includes('public'))) {
    extracted.work_availability = ['flexible'];
  }

  // support_needs
  const needs = [];
  if (!hasVehicle) needs.push('transportation_assistance');
  if (!hasLicense) needs.push('transportation_training');
  if (method.includes('public') || method.includes('transit') || method.includes('bus')) needs.push('public_transit_access');
  if (notes.includes('paratransit')) needs.push('paratransit_coordination');
  if (text.includes('carpool')) needs.push('carpool_coordination');
  if (limitations.length) needs.push('transportation_planning');
  if (needs.length) extracted.support_needs = needs;

  return extracted;
}

/**
 * Medications section → VFP fields
 */
function extractMedicationsByAnswerKey(answers) {
  const extracted = {};
  const text = Object.values(answers || {}).join(' ').toLowerCase();
  const medList = answers.medication_list || '';

  // medication_side_effect_flags
  const flags = [];
  if (text.includes('drowsy') || text.includes('sedating') || text.includes('fatigue')) flags.push('sedation');
  if (text.includes('tremor') || text.includes('shake') || text.includes('motor')) flags.push('motor_effects');
  if (text.includes('cognitive') || text.includes('brain fog') || text.includes('confusion') || text.includes('memory')) flags.push('cognitive_effects');
  if (text.includes('mood') || text.includes('emotional') || text.includes('irritability')) flags.push('mood_effects');
  if (text.includes('weight') || text.includes('appetite') || text.includes('metabolic')) flags.push('metabolic_effects');
  if (text.includes('dizziness') || text.includes('dizzy')) flags.push('dizziness');
  if (text.includes('nausea') || text.includes('stomach')) flags.push('gi_effects');
  if (flags.length) extracted.medication_side_effect_flags = flags;

  // stamina_endurance_concerns
  if (text.includes('low energy') || text.includes('fatigue') || text.includes('tired')) {
    extracted.stamina_endurance_concerns = ['low_endurance'];
  } else if (text.includes('high') || text.includes('good energy')) {
    extracted.stamina_endurance_concerns = ['good_endurance'];
  }

  // safety_risk_flags
  const safetyFlags = [];
  if (text.includes('drowsy') || text.includes('sedating')) safetyFlags.push('impaired_alertness');
  if (text.includes('tremor') || text.includes('motor')) safetyFlags.push('motor_impairment');
  if (text.includes('cognitive') || text.includes('confusion')) safetyFlags.push('cognitive_impairment');
  if (text.includes('dizziness') || text.includes('balance')) safetyFlags.push('balance_issues');
  if (safetyFlags.length) extracted.safety_risk_flags = safetyFlags;

  // accommodation_needs
  const accom = [];
  if (flags.length) accom.push('medication_schedule_accommodation');
  if (text.includes('frequent breaks') || text.includes('rest')) accom.push('frequent_breaks');
  if (text.includes('flexible') || text.includes('part-time')) accom.push('flexible_schedule');
  if (text.includes('quiet') || text.includes('low stimulation')) accom.push('quiet_workspace');
  if (accom.length) extracted.accommodation_needs = accom;

  return extracted;
}

/**
 * Benefits section → VFP fields
 * 
 * Properly evaluates boolean/yes-no fields:
 * - Only creates benefit facts when answer is explicitly yes/true/enrolled/active
 * - Explicitly excludes no/false/none/empty values
 * - Tracks when client receives no benefits
 */
function extractBenefitsByAnswerKey(answers) {
  const extracted = {};

  // Helper: check if value indicates YES
  const isYes = (val) => {
    if (val === true || val === 'true') return true;
    if (typeof val === 'string') {
      const norm = val.toLowerCase().trim();
      return norm === 'yes' || norm === 'enrolled' || norm === 'active' || norm === 'y';
    }
    return false;
  };

  // Helper: check if value indicates NO
  const isNo = (val) => {
    if (val === false || val === 'false') return true;
    if (typeof val === 'string') {
      const norm = val.toLowerCase().trim();
      return norm === 'no' || norm === 'n' || norm === 'none' || norm === '';
    }
    return val === null || val === undefined;
  };

  // benefits_considerations - ONLY if answer is explicitly YES
  const considerations = [];
  if (isYes(answers.receives_ssi)) considerations.push('ssi_recipient');
  if (isYes(answers.receives_ssdi)) considerations.push('ssdi_recipient');
  if (isYes(answers.receives_medicare)) considerations.push('medicare_coverage');
  if (isYes(answers.receives_medicaid)) considerations.push('medicaid_coverage');
  if (isYes(answers.receives_snap)) considerations.push('snap_recipient');
  if (isYes(answers.ticket_to_work)) considerations.push('ticket_to_work_enrolled');

  // If all benefits are explicitly NO, note it
  const allBenefitsAreNo = [
    answers.receives_ssi,
    answers.receives_ssdi,
    answers.receives_medicare,
    answers.receives_medicaid,
    answers.receives_snap,
    answers.ticket_to_work
  ].every(val => isNo(val));

  if (allBenefitsAreNo && Object.keys(answers).length > 0) {
    considerations.push('no_current_benefits');
  }

  if (considerations.length) extracted.benefits_considerations = considerations;

  // support_needs - only if counseling is explicitly requested
  const needs = [];
  if (isYes(answers.benefits_counseling_needed)) {
    needs.push('benefits_counseling');
  }
  if (answers.work_incentive_planning && isYes(answers.work_incentive_planning)) {
    needs.push('work_incentive_planning');
  }
  if (answers.healthcare_coordination && isYes(answers.healthcare_coordination)) {
    needs.push('healthcare_coordination');
  }
  if (needs.length) extracted.support_needs = needs;

  // work_incentive_flags - only if ticket is actively enrolled
  if (isYes(answers.ticket_to_work)) {
    extracted.work_incentive_flags = ['ticket_to_work_available'];
  }

  return extracted;
}

/**
 * Employment Goals section → VFP fields
 */
function extractEmploymentGoalsByAnswerKey(answers) {
  const extracted = {};
  const text = Object.values(answers || {}).join(' ').toLowerCase();

  // preferred_job_titles
  const titles = [];
  if (answers.goal_job_title) titles.push(answers.goal_job_title);
  if (titles.length) extracted.preferred_job_titles = titles;

  // preferred_industries
  const industries = [];
  if (answers.goal_industries) {
    const indusList = Array.isArray(answers.goal_industries) 
      ? answers.goal_industries 
      : (answers.goal_industries || '').split(',').map(s => s.trim()).filter(s => s);
    industries.push(...indusList);
  }
  if (text.includes('accounting') || text.includes('finance')) industries.push('finance');
  if (text.includes('healthcare') || text.includes('medical')) industries.push('healthcare');
  if (text.includes('technology') || text.includes('it')) industries.push('technology');
  if (text.includes('education') || text.includes('teaching')) industries.push('education');
  if (text.includes('retail') || text.includes('sales')) industries.push('sales');
  if (text.includes('trade') || text.includes('skilled')) industries.push('skilled_trades');
  if ([...new Set(industries)].length) extracted.preferred_industries = [...new Set(industries)];

  // work_environment_preferences
  const envPrefs = [];
  if (answers.goal_work_environment) {
    const env = answers.goal_work_environment.toLowerCase();
    if (env.includes('outdoor')) envPrefs.push('outdoor');
    if (env.includes('indoor')) envPrefs.push('indoor');
    if (env.includes('quiet')) envPrefs.push('low_noise');
    if (env.includes('team')) envPrefs.push('team_oriented');
    if (env.includes('independent')) envPrefs.push('independent');
  }
  if (envPrefs.length) extracted.work_environment_preferences = envPrefs;

  // schedule_preferences
  if (answers.full_time_part_time) {
    const sched = (answers.full_time_part_time || '').toLowerCase();
    if (sched.includes('full')) extracted.schedule_preferences = ['full_time'];
    else if (sched.includes('part')) extracted.schedule_preferences = ['part_time'];
  }

  // work_motivation from past_work_liked
  const motivation = [];
  if (answers.past_work_liked) {
    const liked = (answers.past_work_liked || '').toLowerCase();
    if (liked.includes('helping')) motivation.push('helping_people');
    if (liked.includes('team') || liked.includes('working')) motivation.push('teamwork');
    if (liked.includes('independence') || liked.includes('independent')) motivation.push('autonomy');
    if (liked.includes('creative') || liked.includes('problem')) motivation.push('problem_solving');
    if (liked.includes('detail') || liked.includes('accuracy')) motivation.push('attention_to_detail');
  }
  if (motivation.length) extracted.work_motivation = motivation;

  // preferred_tasks / avoided_tasks
  const preferred = [];
  const avoided = [];
  if (answers.past_work_liked) {
    const liked = (answers.past_work_liked || '').toLowerCase();
    if (liked.includes('hands-on') || liked.includes('hands on')) preferred.push('hands_on');
    if (liked.includes('customer') || liked.includes('interaction')) preferred.push('customer_facing');
    if (liked.includes('routine') || liked.includes('structured')) preferred.push('structured_tasks');
  }
  if (answers.past_work_disliked) {
    const disliked = (answers.past_work_disliked || '').toLowerCase();
    if (disliked.includes('customer') || disliked.includes('public')) avoided.push('public_facing');
    if (disliked.includes('pressure') || disliked.includes('deadline')) avoided.push('high_pressure');
    if (disliked.includes('repetitive')) avoided.push('repetitive_tasks');
    if (disliked.includes('chaos') || disliked.includes('disorganized')) avoided.push('chaotic_environment');
  }
  if (preferred.length) extracted.preferred_tasks = preferred;
  if (avoided.length) extracted.avoided_tasks = avoided;

  // job_readiness from timeline
  if (answers.start_timeline) {
    const timeline = (answers.start_timeline || '').toLowerCase();
    if (timeline.includes('immediately') || timeline.includes('now')) {
      extracted.job_readiness_level = ['ready_to_start'];
    } else if (timeline.includes('1-2') || timeline.includes('developing')) {
      extracted.job_readiness_level = ['developing'];
    } else if (timeline.includes('explore')) {
      extracted.job_readiness_level = ['exploring'];
    }
  }

  return extracted;
}

/**
 * Social Supports section → VFP fields
 */
function extractSocialSupportsByAnswerKey(answers) {
  const extracted = {};
  const text = Object.values(answers || {}).join(' ').toLowerCase();

  // social_supports
  const supports = [];
  if (text.includes('family') || text.includes('spouse') || text.includes('parent')) supports.push('family');
  if (text.includes('friend') || text.includes('peer')) supports.push('friends');
  if (text.includes('counselor') || text.includes('therapist') || text.includes('case manager')) supports.push('professional');
  if (answers.church_community || text.includes('church') || text.includes('religious')) supports.push('faith_community');
  if (text.includes('support group')) supports.push('support_group');
  if (supports.length) extracted.social_supports = supports;

  // community_supports
  const community = [];
  if (text.includes('church') || text.includes('religious') || text.includes('faith')) community.push('faith_based');
  if (text.includes('community center') || text.includes('civic')) community.push('community_organizations');
  if (text.includes('disability') || text.includes('advocacy')) community.push('disability_services');
  if (community.length) extracted.community_supports = community;

  return extracted;
}

/**
 * Basic Info section → VFP fields
 */
function extractBasicInfoByAnswerKey(answers) {
  const extracted = {};
  const text = Object.values(answers || {}).join(' ').toLowerCase();

  // disability_related_considerations
  if (answers.disability_description || text.includes('disability')) {
    const disabilityText = (answers.disability_description || '').toLowerCase();
    const considerations = [];
    if (disabilityText.includes('physical')) considerations.push('physical_disability');
    if (disabilityText.includes('cognitive') || disabilityText.includes('learning')) considerations.push('cognitive_disability');
    if (disabilityText.includes('mental') || disabilityText.includes('psychiatric')) considerations.push('mental_health_disability');
    if (disabilityText.includes('developmental')) considerations.push('developmental_disability');
    if (disabilityText.includes('sensory') || disabilityText.includes('blind') || disabilityText.includes('deaf')) considerations.push('sensory_disability');
    if (considerations.length) extracted.disability_related_considerations = considerations;
  }

  // communication_style
  if (answers.primary_language) {
    const lang = (answers.primary_language || '').toLowerCase();
    if (lang !== 'english' && lang !== 'en') {
      extracted.communication_style = [`primary_language_${lang}`];
    }
  }

  // transportation_context (if location noted)
  if (answers.address || answers.location) {
    const location = (answers.address || answers.location || '').toLowerCase();
    if (location.includes('rural') || location.includes('remote')) {
      extracted.transportation_context = ['rural_location'];
    } else if (location.includes('urban') || location.includes('city')) {
      extracted.transportation_context = ['urban_location'];
    } else if (location.includes('suburban')) {
      extracted.transportation_context = ['suburban_location'];
    }
  }

  // support_needs
  if (answers.veteran || text.includes('veteran')) {
    extracted.support_needs = ['veteran_services'];
  }

  return extracted;
}

/**
 * Documents Available section → VFP fields
 */
function extractDocumentsAvailableByAnswerKey(answers) {
  const extracted = {};
  const readiness = [];

  if (answers.has_resume) readiness.push('resume_ready');
  if (answers.has_state_id) readiness.push('state_id_ready');
  if (answers.has_sscard) readiness.push('ssn_card_ready');
  if (answers.has_work_permit) readiness.push('work_permit_ready');

  if (readiness.length === 4) {
    extracted.job_readiness_level = ['fully_documented'];
    extracted.onboarding_readiness = ['documents_complete'];
  } else if (readiness.length >= 2) {
    extracted.job_readiness_level = ['mostly_ready'];
    extracted.onboarding_readiness = ['documents_partial'];
  } else if (readiness.length === 1) {
    extracted.onboarding_readiness = ['documents_minimal'];
  } else {
    extracted.onboarding_readiness = ['documents_missing'];
  }

  extracted.documentation_readiness = readiness;

  return extracted;
}

/**
 * Employment History section → VFP fields
 */
function extractEmploymentHistoryByAnswerKey(answers) {
  const extracted = {};
  const text = Object.values(answers || {}).join(' ').toLowerCase();

  // strengths
  const strengths = [];
  if (text.includes('reliable') || text.includes('punctual') || text.includes('attendance')) strengths.push('reliability');
  if (text.includes('detail') || text.includes('accuracy') || text.includes('precision')) strengths.push('attention_to_detail');
  if (text.includes('lead') || text.includes('manage') || text.includes('supervise')) strengths.push('leadership');
  if (text.includes('communicate') || text.includes('speaking') || text.includes('interpersonal')) strengths.push('communication');
  if (text.includes('problem') || text.includes('critical think')) strengths.push('problem_solving');
  if (text.includes('creative') || text.includes('innovate')) strengths.push('creativity');
  if (text.includes('team') || text.includes('collaborate')) strengths.push('teamwork');
  if (strengths.length) extracted.strengths = strengths;

  // stamina_endurance_concerns
  if (text.includes('part-time') || text.includes('part time')) {
    extracted.stamina_endurance_concerns = ['low_endurance'];
  } else if (text.includes('full-time') || text.includes('full time')) {
    extracted.stamina_endurance_concerns = ['good_endurance'];
  }

  // preferred_tasks
  const tasks = [];
  if (text.includes('hands-on') || text.includes('hands on')) tasks.push('hands_on');
  if (text.includes('customer') || text.includes('interaction')) tasks.push('customer_facing');
  if (text.includes('independent')) tasks.push('independent_work');
  if (text.includes('routine') || text.includes('structured')) tasks.push('structured_tasks');
  if (tasks.length) extracted.preferred_tasks = tasks;

  return extracted;
}

/**
 * Education section → VFP fields
 */
function extractEducationByAnswerKey(answers) {
  const extracted = {};
  const text = Object.values(answers || {}).join(' ').toLowerCase();

  // education_level
  if (text.includes('college') || text.includes('bachelor') || text.includes('masters')) {
    extracted.education_level = ['college'];
  } else if (text.includes('some college') || text.includes('associate')) {
    extracted.education_level = ['some_college'];
  } else if (text.includes('high school') || text.includes('diploma') || text.includes('ged')) {
    extracted.education_level = ['high_school'];
  } else if (text.includes('certificate')) {
    extracted.education_level = ['certificate'];
  }

  // strengths from education
  const strengths = [];
  if (text.includes('honor') || text.includes('award') || text.includes('scholarship')) {
    strengths.push('academic_achievement');
  }
  if (text.includes('specialized') || text.includes('expertise')) {
    strengths.push('specialization');
  }
  if (strengths.length) extracted.strengths = strengths;

  return extracted;
}



/**
 * Extract VFP fields from barriers_support section with nuanced vocational intelligence.
 * 
 * Maps detailed intake descriptions into specific, actionable workplace signals:
 * - Direct answers: mobility/sensory/cognitive/learning barriers, accommodations, communication
 * - AI clarification fields: augment direct extraction with LLM-refined summaries and keywords
 * - Support needs, strengths, job readiness
 * 
 * Preserves original intake extraction. AI clarification augments, never replaces, direct facts.
 */
function extractBarriersSupportByAnswerKey(answers) {
  const extracted = {};
  const sourceMetadata = {};

  // Combine direct answers + AI clarification for comprehensive text analysis
  const directText = Object.values(answers || {})
    .filter(v => typeof v === 'string' && !v.startsWith('ai_'))
    .join(' ')
    .toLowerCase();

  const aiText = [
    answers.ai_clarified_barriers,
    answers.ai_vocational_impact,
    answers.ai_support_recommendations,
    answers.ai_vfp_keywords
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const allText = (directText + ' ' + aiText).toLowerCase();

  // ── BARRIERS (workplace functional limitations) ──
  const barriers = [];
  if (allText.includes('wheelchair') || allText.includes('mobility') || allText.includes('walk') || allText.includes('stairs')) barriers.push('mobility_limitations');
  if (allText.includes('vision') || allText.includes('blind') || allText.includes('sight') || allText.includes('visual')) barriers.push('visual_impairment');
  if (allText.includes('routine') && allText.includes('change')) barriers.push('routine_change_difficulty');
  if (allText.includes('deaf') || allText.includes('hearing')) barriers.push('hearing_impairment');
  if (allText.includes('cognitive') || allText.includes('memory') || allText.includes('attention')) barriers.push('cognitive_processing');
  if (allText.includes('learning') || allText.includes('dyslexia') || allText.includes('processing')) barriers.push('learning_difference');
  if (allText.includes('anxiety') || allText.includes('depression') || allText.includes('mental') || allText.includes('ptsd')) barriers.push('mental_health_condition');
  if (allText.includes('pain') || allText.includes('chronic') || allText.includes('fatigue')) barriers.push('chronic_pain_fatigue');
  if (barriers.length) {
    extracted.barriers = barriers;
    sourceMetadata.barriers = [{
      source: directText.includes('barrier') ? 'intake_direct' : 'barriers_ai_clarify',
      confidence: aiText ? 'medium' : 'high'
    }];
  }

  // ── ACCOMMODATION_NEEDS (environmental/support adjustments) ──
  const accommodations = [];
  if (allText.includes('wheelchair')) accommodations.push('wheelchair_accessibility');
  if (allText.includes('accessible') && allText.includes('restroom')) accommodations.push('accessible_restroom');
  if (allText.includes('parking')) accommodations.push('accessible_parking');
  if (allText.includes('large print') || allText.includes('magnification')) accommodations.push('magnification_or_large_print');
  if (allText.includes('screen reader') || allText.includes('assistive')) accommodations.push('assistive_technology');
  if (allText.includes('extra time') || allText.includes('slow') || allText.includes('extended')) accommodations.push('extended_training_time');
  if (allText.includes('repetition') || allText.includes('repeat')) accommodations.push('routine_repetition_support');
  if (allText.includes('written') && (allText.includes('instruction') || allText.includes('direction'))) accommodations.push('written_instructions');
  if (allText.includes('quiet') || allText.includes('distraction')) accommodations.push('low_distraction_workspace');
  if (allText.includes('flexible') && (allText.includes('schedule') || allText.includes('break'))) accommodations.push('flexible_schedule');
  if (allText.includes('frequent break')) accommodations.push('frequent_breaks');
  if (accommodations.length) {
    extracted.accommodation_needs = accommodations;
    sourceMetadata.accommodation_needs = [{
      source: directText.includes('accommodat') ? 'intake_direct' : 'barriers_ai_clarify',
      confidence: aiText ? 'medium' : 'high'
    }];
  }

  // ── COMMUNICATION_STYLE (interaction patterns & capabilities) ──
  const commStyle = [];
  if (allText.includes('slow') && allText.includes('processing')) commStyle.push('slower_processing_time');
  if (allText.includes('processing') && (allText.includes('time') || allText.includes('slow'))) commStyle.push('needs_processing_time');
  if (allText.includes('customer') && (allText.includes('communication') || allText.includes('successful') || allText.includes('able'))) commStyle.push('capable_customer_interaction');
  if (allText.includes('email') || allText.includes('written')) commStyle.push('prefers_written_communication');
  if (allText.includes('verbal') || allText.includes('phone')) commStyle.push('prefers_verbal_communication');
  if (allText.includes('visual') || allText.includes('demonstration')) commStyle.push('learns_by_demonstration');
  if (commStyle.length) {
    extracted.communication_style = commStyle;
    sourceMetadata.communication_style = [{
      source: aiText ? 'barriers_ai_clarify' : 'intake_direct',
      confidence: 'medium'
    }];
  }

  // ── SUPPORT_NEEDS (external assistance level & coaching) ──
  const support = [];
  
  // Level-of-support indicators
  if (allText.includes('moderate') && allText.includes('support')) support.push('moderate_support_needs');
  if (allText.includes('high') && allText.includes('support')) support.push('high_support_needs');
  
  // Job coaching & mentoring
  if (allText.includes('job coach') || allText.includes('coaching required') || allText.includes('job coaching')) support.push('job_coaching_required');
  if (allText.includes('mentor') || allText.includes('mentoring')) support.push('mentoring_needed');
  if (allText.includes('on-the-job')) support.push('on_the_job_support');
  
  // Task & routine learning
  if (allText.includes('task breakdown') || allText.includes('break down')) support.push('task_breakdown_support');
  if (allText.includes('routine') && (allText.includes('learning') || allText.includes('development') || allText.includes('change'))) support.push('routine_learning_support');
  if (allText.includes('establish routine') || allText.includes('routine development')) support.push('routine_learning_support');
  
  // Processing & communication support (AI-driven from barriers/impact)
  if (allText.includes('slow') && allText.includes('processing')) support.push('slower_processing_support');
  if (allText.includes('processing') && (allText.includes('time') || allText.includes('response'))) support.push('slower_processing_support');
  if (allText.includes('communication') && (allText.includes('support') || allText.includes('barrier') || allText.includes('needs'))) support.push('communication_support');
  if (aiText && (aiText.includes('communication') || aiText.includes('engage'))) support.push('communication_support');
  
  // Training & time accommodations
  if (allText.includes('extra time') || (allText.includes('extended') && allText.includes('training'))) support.push('extended_training_support');
  if (allText.includes('additional time') && allText.includes('training')) support.push('extended_training_support');
  
  if (support.length) {
    extracted.support_needs = support;
    sourceMetadata.support_needs = [{
      source: aiText ? 'barriers_ai_clarify' : 'intake_direct',
      confidence: 'medium'
    }];
  }

  // ── JOB_COACHING_NEEDS (from AI impact statement or direct needs) ──
  if (allText.includes('job coach') || (aiText && aiText.includes('coach'))) {
    extracted.job_coaching_needs = true;
    sourceMetadata.job_coaching_needs = [{
      source: 'barriers_ai_clarify',
      confidence: aiText ? 'medium' : 'high'
    }];
  }

  // ── PREFERRED_WORK_ENVIRONMENT (from AI or direct) ──
  const envPrefs = [];
  if (allText.includes('quiet') || allText.includes('low noise') || allText.includes('minimal distraction')) envPrefs.push('low_noise');
  if (allText.includes('structured') || allText.includes('routine')) envPrefs.push('structured');
  if (allText.includes('flexible') || allText.includes('autonomy')) envPrefs.push('flexible');
  if (allText.includes('team') || allText.includes('collaborative')) envPrefs.push('team_oriented');
  if (allText.includes('independent') && !allText.includes('not independent')) envPrefs.push('independent');
  if (envPrefs.length) {
    extracted.preferred_work_environment = envPrefs;
    sourceMetadata.preferred_work_environment = [{
      source: aiText ? 'barriers_ai_clarify' : 'intake_direct',
      confidence: 'medium'
    }];
  }

  // ── JOB_READINESS_LEVEL (from AI vocational impact or direct) ──
  if (aiText.includes('may impact') || aiText.includes('barrier') || directText.includes('barrier')) {
    extracted.job_readiness_level = ['developing'];
    sourceMetadata.job_readiness_level = [{
      source: 'barriers_ai_clarify',
      confidence: 'medium'
    }];
  } else if (allText.includes('ready') || allText.includes('prepared')) {
    extracted.job_readiness_level = ['ready_to_start'];
    sourceMetadata.job_readiness_level = [{
      source: aiText ? 'barriers_ai_clarify' : 'intake_direct',
      confidence: 'medium'
    }];
  }

  // ── STRENGTHS (demonstrated capabilities & assets) ──
  const strengths = [];
  if (allText.includes('technology') && (allText.includes('capable') || allText.includes('able') || allText.includes('skill'))) strengths.push('computer_literate');
  if (allText.includes('email') || (allText.includes('technology') && allText.includes('skill'))) strengths.push('email_skills');
  if (allText.includes('social media')) strengths.push('social_media_skills');
  if (allText.includes('customer') && (allText.includes('service') || allText.includes('communication') || allText.includes('capable'))) strengths.push('customer_service_capable');
  if (allText.includes('reliable') || allText.includes('punctual')) strengths.push('reliability');
  if (allText.includes('detail') || allText.includes('accuracy')) strengths.push('attention_to_detail');
  if (allText.includes('team') || allText.includes('collaborate')) strengths.push('teamwork');
  if (strengths.length) {
    extracted.strengths = strengths;
    sourceMetadata.strengths = [{
      source: 'intake_direct',
      confidence: 'high'
    }];
  }

  // ── RAW INTAKE & AI TEXT FOR REFERENCE ──
  if (answers.barriers_description) {
    extracted.raw_barriers_text = answers.barriers_description;
  }
  if (answers.ai_clarified_barriers) {
    extracted.ai_clarified_barriers = answers.ai_clarified_barriers;
  }
  if (answers.ai_vocational_impact) {
    extracted.ai_vocational_impact = answers.ai_vocational_impact;
  }
  if (answers.ai_vfp_keywords) {
    extracted.ai_vfp_keywords = answers.ai_vfp_keywords;
  }

  // Attach source metadata for audit trail
  if (Object.keys(sourceMetadata).length > 0) {
    extracted._barriers_support_sources = sourceMetadata;
  }

  // Filter out empty arrays/null values
  return Object.fromEntries(Object.entries(extracted).filter(([, v]) => v !== null && v !== undefined && (Array.isArray(v) ? v.length > 0 : true)));
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