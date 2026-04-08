export const FORM_SCHEMAS = {
  simple_time: [
    { key: "date", label: "Date", type: "date", required: true },
    { key: "duration", label: "Duration (minutes)", type: "number", required: false },
    { key: "start_time", label: "Start Time", type: "time", required: false },
    { key: "end_time", label: "End Time", type: "time", required: false },
    { key: "description", label: "Description", type: "textarea", required: true },
  ],

  life_skills: [
    { key: "billable_service_date", label: "Billable Service Date", type: "date", required: true },
    { key: "billable_hours", label: "Billable Hours", type: "number", required: true },
    { 
      key: "life_skills_area", 
      label: "Life Skills Area", 
      type: "select", 
      required: true,
      options: [
        "Personal Hygiene & Grooming",
        "Money Management",
        "Transportation & Mobility",
        "Meal Planning & Food Preparation",
        "Home Management & Cleaning",
        "Health & Wellness",
        "Social & Interpersonal Skills",
        "Communication Skills",
        "Time Management & Organization",
        "Job Readiness & Work Habits",
        "Educational Support",
        "Leisure & Recreation",
        "Community Integration",
        "Safety & Emergency Preparedness",
        "Other"
      ]
    },
    { key: "specific_skill_taught", label: "Specific Skill Taught", type: "text", required: true },
    { key: "client_progress_mastery_level", label: "Client Progress/Mastery Level", type: "text", required: true },
    { key: "practice_homework_assigned", label: "Practice/Homework Assigned", type: "textarea", required: false },
    { key: "activity_description", label: "Activity Description", type: "textarea", required: true },
    { key: "observations_comments", label: "Observations & Comments", type: "textarea", required: false },
  ],

  voc_rehab: [], // Placeholder - always loaded from ReportFieldTemplate for job_coaching, job_development, usor96
};

export function getSchema(schemaKey) {
  return FORM_SCHEMAS[schemaKey] || [];
}

export async function loadVocRehabSchema(entryTypeCode) {
  try {
    // Dynamic import of base44 only when needed
    const { base44 } = await import("@/api/base44Client");
    
    const templates = await base44.entities.ReportFieldTemplate.filter({
      entry_type_code: entryTypeCode,
      is_active: true,
      pdf_context: "row",
      is_internal_only: false
    });

    if (!templates.length) {
      console.warn(`No ReportFieldTemplate found for ${entryTypeCode}`);
      return [];
    }

    // Fetch service codes for primary and secondary code fields
    let serviceCodes = [];
    try {
      serviceCodes = await base44.entities.ServiceCode.filter({
        is_active: true,
        program_type: "vr"
      });
    } catch (err) {
      console.error("Failed to load service codes:", err);
    }

    const primaryCodes = serviceCodes.filter(c => c.is_primary).map(c => ({
      value: c.code,
      label: c.display_label || c.code
    }));

    const secondaryCodes = serviceCodes.filter(c => c.is_secondary).map(c => ({
      value: c.code,
      label: c.display_label || c.code
    }));

    return templates
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map(t => {
        const field = {
          key: t.field_key,
          label: t.label,
          type: t.field_type,
          required: t.is_required || false,
          placeholder: t.placeholder,
          help_text: t.help_text,
          options: t.options || [],
        };

        // Inject service code options for known fields
        if (t.field_key === "primary_service_code" && primaryCodes.length > 0) {
          field.options = primaryCodes;
        } else if (t.field_key === "secondary_service_code" && secondaryCodes.length > 0) {
          field.options = secondaryCodes;
        }

        return field;
      });
  } catch (err) {
    console.error("Failed to load voc_rehab schema:", err);
    return [];
  }
}