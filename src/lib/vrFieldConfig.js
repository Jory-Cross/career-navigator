/**
 * VR Field Configuration
 * Defines required fields for each entry type and VR form compliance
 */

/**
 * Field Template Definition
 */
export const VR_FIELDS = {
  // ===== JOB DEVELOPMENT (USOR96) =====
  job_development: {
    entry_type_id: 'job_development',
    entry_type_code: 'job_development',
    form_name: 'Job Development Report (USOR96)',
    required_fields: [
      'employer_name',
      'employer_contact_person',
      'employer_phone',
      'job_title',
      'job_description',
      'wage_offered',
      'start_date',
      'hours_per_week',
      'employment_type'
    ],
    all_fields: [
      {
        field_key: 'employer_name',
        label: 'Employer Name',
        input_type: 'text',
        required: true,
        pdf_field_name: 'EmployerName',
        order: 1,
        section: 'Employer Information'
      },
      {
        field_key: 'employer_contact_person',
        label: 'Contact Person',
        input_type: 'text',
        required: true,
        pdf_field_name: 'ContactPerson',
        order: 2,
        section: 'Employer Information'
      },
      {
        field_key: 'employer_phone',
        label: 'Phone',
        input_type: 'text',
        required: true,
        pdf_field_name: 'EmployerPhone',
        order: 3,
        section: 'Employer Information'
      },
      {
        field_key: 'job_title',
        label: 'Job Title',
        input_type: 'text',
        required: true,
        pdf_field_name: 'JobTitle',
        order: 4,
        section: 'Job Information'
      },
      {
        field_key: 'job_description',
        label: 'Job Duties',
        input_type: 'textarea',
        required: true,
        pdf_field_name: 'JobDuties',
        order: 5,
        section: 'Job Information'
      },
      {
        field_key: 'wage_offered',
        label: 'Wage Offered',
        input_type: 'number',
        required: true,
        pdf_field_name: 'WageOffered',
        order: 6,
        section: 'Compensation'
      },
      {
        field_key: 'start_date',
        label: 'Start Date',
        input_type: 'date',
        required: true,
        pdf_field_name: 'StartDate',
        order: 7,
        section: 'Employment Details'
      },
      {
        field_key: 'hours_per_week',
        label: 'Hours Per Week',
        input_type: 'number',
        required: true,
        pdf_field_name: 'HoursPerWeek',
        order: 8,
        section: 'Employment Details'
      },
      {
        field_key: 'employment_type',
        label: 'Employment Type',
        input_type: 'select',
        required: true,
        options: ['Full-time', 'Part-time', 'Temp', 'Seasonal', 'Internship'],
        pdf_field_name: 'EmploymentType',
        order: 9,
        section: 'Employment Details'
      },
      {
        field_key: 'accommodations_needed',
        label: 'Accommodations Needed',
        input_type: 'textarea',
        required: false,
        pdf_field_name: 'Accommodations',
        order: 10,
        section: 'Additional'
      },
      {
        field_key: 'follow_up_plan',
        label: 'Follow-up Plan',
        input_type: 'textarea',
        required: false,
        pdf_field_name: 'FollowUpPlan',
        order: 11,
        section: 'Additional'
      }
    ]
  },

  // ===== JOB COACHING (USOR95) =====
  job_coaching: {
    entry_type_id: 'job_coaching',
    entry_type_code: 'job_coaching',
    form_name: 'Job Coaching Report (USOR95)',
    required_fields: [
      'employer_name',
      'coaching_focus',
      'goals_addressed',
      'client_response',
      'next_step'
    ],
    all_fields: [
      {
        field_key: 'employer_name',
        label: 'Employer Name',
        input_type: 'text',
        required: true,
        pdf_field_name: 'EmployerNameCoaching',
        order: 1,
        section: 'Coaching Session'
      },
      {
        field_key: 'coaching_focus',
        label: 'Coaching Focus',
        input_type: 'select',
        required: true,
        options: [
          'Communication Skills',
          'Job Performance',
          'Attendance/Punctuality',
          'Workplace Behavior',
          'Conflict Resolution',
          'Problem-Solving',
          'Safety',
          'Quality of Work',
          'Other'
        ],
        pdf_field_name: 'CoachingFocus',
        order: 2,
        section: 'Coaching Session'
      },
      {
        field_key: 'goals_addressed',
        label: 'Goals Addressed',
        input_type: 'textarea',
        required: true,
        pdf_field_name: 'GoalsAddressed',
        order: 3,
        section: 'Coaching Session'
      },
      {
        field_key: 'client_response',
        label: 'Client Response',
        input_type: 'select',
        required: true,
        options: [
          'Very Positive',
          'Positive',
          'Neutral',
          'Resistant',
          'Refused'
        ],
        pdf_field_name: 'ClientResponse',
        order: 4,
        section: 'Coaching Session'
      },
      {
        field_key: 'strategies_discussed',
        label: 'Strategies Discussed',
        input_type: 'textarea',
        required: false,
        pdf_field_name: 'StrategiesDiscussed',
        order: 5,
        section: 'Coaching Session'
      },
      {
        field_key: 'next_step',
        label: 'Next Step',
        input_type: 'textarea',
        required: true,
        pdf_field_name: 'NextStep',
        order: 6,
        section: 'Follow-up'
      },
      {
        field_key: 'follow_up_date',
        label: 'Follow-up Date',
        input_type: 'date',
        required: false,
        pdf_field_name: 'FollowUpDate',
        order: 7,
        section: 'Follow-up'
      }
    ]
  },

  // ===== LIFE SKILLS / CBH (USOR148) =====
  life_skills: {
    entry_type_id: 'life_skills',
    entry_type_code: 'life_skills',
    form_name: 'Life Skills / CBH Report (USOR148)',
    required_fields: [
      'skill_area',
      'activity_description',
      'skill_objectives',
      'client_progress',
      'next_session_plan'
    ],
    all_fields: [
      {
        field_key: 'skill_area',
        label: 'Skill Area',
        input_type: 'select',
        required: true,
        options: [
          'Daily Living',
          'Personal Care',
          'Nutrition',
          'Healthcare',
          'Money Management',
          'Time Management',
          'Communication',
          'Social Skills',
          'Safety',
          'Community Resources',
          'Transportation',
          'Household Management',
          'Other'
        ],
        pdf_field_name: 'SkillArea',
        order: 1,
        section: 'Life Skills Activity'
      },
      {
        field_key: 'activity_description',
        label: 'Activity Description',
        input_type: 'textarea',
        required: true,
        pdf_field_name: 'ActivityDescription',
        order: 2,
        section: 'Life Skills Activity'
      },
      {
        field_key: 'skill_objectives',
        label: 'Skill Objectives',
        input_type: 'textarea',
        required: true,
        pdf_field_name: 'SkillObjectives',
        order: 3,
        section: 'Life Skills Activity'
      },
      {
        field_key: 'materials_used',
        label: 'Materials/Resources Used',
        input_type: 'textarea',
        required: false,
        pdf_field_name: 'MaterialsUsed',
        order: 4,
        section: 'Life Skills Activity'
      },
      {
        field_key: 'client_progress',
        label: 'Client Progress',
        input_type: 'select',
        required: true,
        options: [
          'Excellent',
          'Good',
          'Satisfactory',
          'Fair',
          'Limited Progress',
          'No Progress',
          'Regressed'
        ],
        pdf_field_name: 'ClientProgress',
        order: 5,
        section: 'Progress'
      },
      {
        field_key: 'progress_notes',
        label: 'Progress Notes',
        input_type: 'textarea',
        required: false,
        pdf_field_name: 'ProgressNotes',
        order: 6,
        section: 'Progress'
      },
      {
        field_key: 'barriers_encountered',
        label: 'Barriers Encountered',
        input_type: 'textarea',
        required: false,
        pdf_field_name: 'BarriersEncountered',
        order: 7,
        section: 'Progress'
      },
      {
        field_key: 'next_session_plan',
        label: 'Next Session Plan',
        input_type: 'textarea',
        required: true,
        pdf_field_name: 'NextSessionPlan',
        order: 8,
        section: 'Planning'
      },
      {
        field_key: 'client_assigned_tasks',
        label: 'Client Assigned Tasks',
        input_type: 'textarea',
        required: false,
        pdf_field_name: 'ClientTasks',
        order: 9,
        section: 'Planning'
      }
    ]
  },

  // ===== CBH (Community-Based Habilitation) - Alias for Life Skills =====
  cbh: {
    entry_type_id: 'cbh',
    entry_type_code: 'cbh',
    form_name: 'Community-Based Habilitation (CBH) Report (USOR148)',
    required_fields: [
      'skill_area',
      'activity_description',
      'skill_objectives',
      'client_progress',
      'next_session_plan'
    ],
    all_fields: [
      {
        field_key: 'skill_area',
        label: 'Habilitation Focus Area',
        input_type: 'select',
        required: true,
        options: [
          'Community Integration',
          'Social Participation',
          'Independent Living',
          'Health/Wellness',
          'Safety Awareness',
          'Money Management',
          'Transportation',
          'Recreation/Leisure',
          'Other'
        ],
        pdf_field_name: 'SkillArea',
        order: 1,
        section: 'CBH Activity'
      },
      {
        field_key: 'activity_description',
        label: 'Activity Description',
        input_type: 'textarea',
        required: true,
        pdf_field_name: 'ActivityDescription',
        order: 2,
        section: 'CBH Activity'
      },
      {
        field_key: 'skill_objectives',
        label: 'Skill Objectives',
        input_type: 'textarea',
        required: true,
        pdf_field_name: 'SkillObjectives',
        order: 3,
        section: 'CBH Activity'
      },
      {
        field_key: 'materials_used',
        label: 'Materials/Resources Used',
        input_type: 'textarea',
        required: false,
        pdf_field_name: 'MaterialsUsed',
        order: 4,
        section: 'CBH Activity'
      },
      {
        field_key: 'client_progress',
        label: 'Client Progress',
        input_type: 'select',
        required: true,
        options: [
          'Excellent',
          'Good',
          'Satisfactory',
          'Fair',
          'Limited Progress',
          'No Progress',
          'Regressed'
        ],
        pdf_field_name: 'ClientProgress',
        order: 5,
        section: 'Progress'
      },
      {
        field_key: 'progress_notes',
        label: 'Progress Notes',
        input_type: 'textarea',
        required: false,
        pdf_field_name: 'ProgressNotes',
        order: 6,
        section: 'Progress'
      },
      {
        field_key: 'barriers_encountered',
        label: 'Barriers Encountered',
        input_type: 'textarea',
        required: false,
        pdf_field_name: 'BarriersEncountered',
        order: 7,
        section: 'Progress'
      },
      {
        field_key: 'next_session_plan',
        label: 'Next Session Plan',
        input_type: 'textarea',
        required: true,
        pdf_field_name: 'NextSessionPlan',
        order: 8,
        section: 'Planning'
      },
      {
        field_key: 'client_assigned_tasks',
        label: 'Client Assigned Tasks',
        input_type: 'textarea',
        required: false,
        pdf_field_name: 'ClientTasks',
        order: 9,
        section: 'Planning'
      }
    ]
  }
};

/**
 * Get field configuration for an entry type
 */
export function getFieldsForEntryType(entryTypeCode) {
  return VR_FIELDS[entryTypeCode] || null;
}

/**
 * Get required field keys for an entry type
 */
export function getRequiredFieldsForEntryType(entryTypeCode) {
  const config = VR_FIELDS[entryTypeCode];
  return config ? config.required_fields : [];
}

/**
 * Get all fields for an entry type (sorted by order)
 */
export function getAllFieldsForEntryType(entryTypeCode) {
  const config = VR_FIELDS[entryTypeCode];
  if (!config) return [];
  return config.all_fields.sort((a, b) => (a.order || 0) - (b.order || 0));
}

/**
 * Validate that all required fields are present in answers
 */
export function validateRequiredFields(entryTypeCode, answers = {}) {
  const requiredFields = getRequiredFieldsForEntryType(entryTypeCode);
  const missingFields = [];

  requiredFields.forEach(fieldKey => {
    const value = answers[fieldKey];
    // Check if field exists and is not empty
    if (value === undefined || value === null || value === '') {
      missingFields.push(fieldKey);
    }
  });

  return {
    isValid: missingFields.length === 0,
    missingFields,
    requiredFieldsCount: requiredFields.length,
    completedFieldsCount: requiredFields.length - missingFields.length
  };
}

/**
 * Get field by key from an entry type
 */
export function getFieldByKey(entryTypeCode, fieldKey) {
  const fields = getAllFieldsForEntryType(entryTypeCode);
  return fields.find(f => f.field_key === fieldKey) || null;
}

/**
 * Get fields by section for an entry type
 */
export function getFieldsBySection(entryTypeCode) {
  const fields = getAllFieldsForEntryType(entryTypeCode);
  const grouped = {};

  fields.forEach(field => {
    const section = field.section || 'Other';
    if (!grouped[section]) {
      grouped[section] = [];
    }
    grouped[section].push(field);
  });

  return grouped;
}

/**
 * Get form info for entry type
 */
export function getFormInfo(entryTypeCode) {
  const config = VR_FIELDS[entryTypeCode];
  return config ? {
    form_name: config.form_name,
    entry_type_code: config.entry_type_code,
    entry_type_id: config.entry_type_id,
    total_fields: config.all_fields.length,
    required_fields: config.required_fields.length
  } : null;
}

/**
 * Check if field belongs to entry type
 */
export function fieldBelongsToEntryType(entryTypeCode, fieldKey) {
  const fields = getAllFieldsForEntryType(entryTypeCode);
  return fields.some(f => f.field_key === fieldKey);
}

/**
 * Get all VR form codes
 */
export function getAllEntryTypeCodes() {
  return Object.keys(VR_FIELDS);
}

/**
 * Get field's required status in an entry type
 */
export function isFieldRequired(entryTypeCode, fieldKey) {
  const requiredFields = getRequiredFieldsForEntryType(entryTypeCode);
  return requiredFields.includes(fieldKey);
}