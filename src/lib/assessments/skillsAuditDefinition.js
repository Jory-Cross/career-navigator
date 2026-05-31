/**
 * Skills Audit — Structured Assessment Definition
 *
 * Structured skills-evidence assessment for:
 * - documenting client-reported and observed work skills
 * - preserving the source and strength of skill evidence
 * - identifying training and skill-development needs
 * - supporting later FACTS/VFP and recommendation review
 *
 * This assessment is different from the Work Performance & Support
 * Observation. The Skills Audit documents current skills and evidence
 * across sources. The observation assessment documents performance during
 * a specific dated worksite observation.
 *
 * assessment_type: "skills_audit"
 */

import {
  defineSection,
  defineQuestion,
  defineImplication,
  QUESTION_TYPES,
  EVIDENCE_CATEGORY,
  IMPLICATION_TYPE,
} from "./structuredAssessmentSchema";

// ─────────────────────────────────────────────────────────────────────────────
// Section 1: Skills Assessment Context and Evidence Sources
// ─────────────────────────────────────────────────────────────────────────────

const SECTION_SKILLS_CONTEXT_EVIDENCE_SOURCES = defineSection({
  id: "skills_context_evidence_sources",
  label: "Skills Assessment Context & Evidence Sources",
  description:
    "Document why the Skills Audit is being completed, what work direction is being considered, and what sources support the skills information recorded in this assessment.",
  guidance:
    "This section establishes the evidence context for the Skills Audit. Record client-reported skills, directly observed skills, and documentation reviewed separately. A claimed or reported skill should not be treated as verified ability unless supported by observation, documentation, or other reliable evidence.",
  questions: [
    defineQuestion({
      id: "skills_audit_purpose",
      label: "What is the primary purpose of this Skills Audit?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "Initial vocational exploration",
        "Preparing for job recommendations",
        "Identifying strengths for job search",
        "Identifying skill-development needs",
        "Reviewing readiness for a specific job direction",
        "Supporting Work Strategy Assessment development",
        "Current employment support or retention review",
        "Updating previously known skills evidence",
        "Other",
      ],
      evidenceCategory: EVIDENCE_CATEGORY.VOCATIONAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.VOCATIONAL,
          description:
            "Identifies how the skills evidence may later be used in vocational exploration, job recommendations, WSA drafting, or employment-support review.",
        }),
      ],
    }),

    defineQuestion({
      id: "skills_audit_context",
      label: "What is the client's current employment or vocational exploration context?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "Not employed - beginning exploration",
        "Not employed - actively identifying job directions",
        "Preparing for job search",
        "Participating in situational or community-based assessment",
        "Trial work or work experience",
        "Newly employed",
        "Currently employed - support or retention review",
        "Currently employed - exploring advancement or different work",
        "Unable to determine",
        "Other",
      ],
      evidenceCategory: EVIDENCE_CATEGORY.VOCATIONAL,
      evidenceWeight: "high",
    }),

    defineQuestion({
      id: "skills_audit_completed_by",
      label: "Who is completing or contributing to this Skills Audit?",
      type: QUESTION_TYPES.SELECT_ALL,
      options: [
        "Client",
        "Employment specialist",
        "Job coach",
        "Vocational rehabilitation counselor",
        "Parent, guardian, or family support",
        "Employer or supervisor",
        "Teacher or transition staff",
        "Other support provider",
        "Other",
      ],
      guidance:
        "Select all individuals who contributed information to this audit. Use the narrative evidence fields below to clarify the source of specific skill information.",
      evidenceCategory: EVIDENCE_CATEGORY.VOCATIONAL,
      evidenceWeight: "medium",
    }),

    defineQuestion({
      id: "skills_evidence_sources_used",
      label: "Which evidence sources were used when completing this Skills Audit?",
      type: QUESTION_TYPES.SELECT_ALL,
      options: [
        "Client self-report",
        "Employment specialist or job-coach observation",
        "Work Performance & Support Observation",
        "Resume",
        "Prior employment history",
        "Training record",
        "Certification or credential document",
        "School or transition documentation",
        "Employer or supervisor report",
        "Family or support-provider report",
        "Other assessment results",
        "Work sample or completed task",
        "No supporting evidence available yet",
        "Other",
      ],
      guidance:
        "Select sources actually reviewed or relied upon in this assessment. Later sections should distinguish verified evidence from skills requiring further confirmation.",
      evidenceCategory: EVIDENCE_CATEGORY.VOCATIONAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.VOCATIONAL,
          description:
            "Identifies the evidence sources supporting skill claims and observed abilities documented in this assessment.",
        }),
      ],
    }),

    defineQuestion({
      id: "jobs_or_task_areas_being_considered",
      label: "Which jobs, occupational areas, or work-task areas are being considered during this Skills Audit?",
      type: QUESTION_TYPES.NARRATIVE,
      placeholder:
        "Example: custodial work, stocking and inventory, laundry services, office support, food preparation, groundskeeping, customer service, warehouse tasks, computer-based work, or no specific direction identified yet.",
      guidance:
        "Document job directions or task areas being considered. It is acceptable to state that the client is still exploring and no target area has been selected.",
      evidenceCategory: EVIDENCE_CATEGORY.VOCATIONAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.VOCATIONAL,
          description:
            "Connects skills evidence to possible work-task areas or occupational directions being explored.",
        }),
      ],
    }),

    defineQuestion({
      id: "client_reported_skills_or_experience",
      label: "What skills, abilities, or relevant experience does the client report having?",
      type: QUESTION_TYPES.NARRATIVE,
      placeholder:
        "Document skills or experience the client identifies, including work tasks, household activities, volunteer activities, school activities, technology use, hobbies with transferable skills, or previous employment experience.",
      guidance:
        "Record this as client-reported evidence unless it is verified elsewhere. Do not treat self-report alone as demonstrated performance.",
      evidenceCategory: EVIDENCE_CATEGORY.VOCATIONAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.VOCATIONAL,
          description:
            "Preserves client-reported skills and experience for later verification and vocational exploration.",
        }),
      ],
    }),

    defineQuestion({
      id: "staff_observed_skills_or_evidence",
      label: "What work-related skills or abilities have staff directly observed?",
      type: QUESTION_TYPES.NARRATIVE,
      placeholder:
        "Document directly observed skills and the context in which they were seen. Example: client accurately sorted supplies during a community-based observation using a visual checklist with one reminder.",
      guidance:
        "Identify what was directly observed, where it was observed, and any supports needed. Avoid general conclusions that are not supported by specific evidence.",
      evidenceCategory: EVIDENCE_CATEGORY.VOCATIONAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.VOCATIONAL,
          description:
            "Captures direct observed evidence of work-related skills for later FACTS/VFP and vocational planning review.",
        }),
      ],
    }),

    defineQuestion({
      id: "resume_training_or_documented_skill_evidence",
      label: "What skills are supported by resumes, training records, certifications, school records, employer reports, or other documentation?",
      type: QUESTION_TYPES.NARRATIVE,
      placeholder:
        "Document the skill, the source supporting it, and any limits on interpretation. Example: food handler certification documented; prior cashier experience listed on resume but current accuracy and customer-interaction skill not yet observed.",
      guidance:
        "Identify documented skill evidence separately from direct observation and client report.",
      evidenceCategory: EVIDENCE_CATEGORY.VOCATIONAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.VOCATIONAL,
          description:
            "Preserves documented skill and credential evidence while identifying what may still require functional verification.",
        }),
      ],
    }),

    defineQuestion({
      id: "skill_evidence_current_verification_status",
      label: "What is the overall verification status of currently available skills evidence?",
      type: QUESTION_TYPES.MULTIPLE_CHOICE,
      options: [
        "Strong direct observation and/or documentation is available for key skills",
        "Some skills are supported by evidence and others require verification",
        "Most skills are currently client-reported and require verification",
        "Documentation exists but functional performance still requires observation",
        "Insufficient information is available to identify current work skills",
        "Unable to determine",
      ],
      guidance:
        "Rate the strength of the evidence available now, not the client's potential ability.",
      evidenceCategory: EVIDENCE_CATEGORY.VOCATIONAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.SUPPORT,
          description:
            "Identifies whether additional observation, documentation review, or assessment is needed before relying on skill evidence in vocational planning.",
        }),
      ],
    }),

    defineQuestion({
      id: "skills_evidence_limitations_or_unknowns",
      label: "What limitations, missing information, or unknowns affect interpretation of the client's current skills?",
      type: QUESTION_TYPES.NARRATIVE,
      placeholder:
        "Document information still needed, such as lack of direct observation, unclear skill level, outdated work history, unverified certification, limited work sample, unknown support need, or task areas not yet evaluated.",
      guidance:
        "Use this field to prevent unverified claims from being treated as confirmed skills evidence.",
      evidenceCategory: EVIDENCE_CATEGORY.VOCATIONAL,
      evidenceWeight: "high",
      implications: [
        defineImplication({
          type: IMPLICATION_TYPE.SUPPORT,
          description:
            "Identifies additional evidence or assessment needed before using uncertain skill information in job planning or recommendations.",
        }),
      ],
    }),
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// Exported Definition — Initial build includes Section 1 only
// Additional structured skill-evidence sections will be added and verified
// incrementally before downstream FACTS/VFP or recommendation integration.
// ─────────────────────────────────────────────────────────────────────────────

export const SKILLS_AUDIT_SECTIONS = [
  SECTION_SKILLS_CONTEXT_EVIDENCE_SOURCES,
];

export const SKILLS_AUDIT_META = {
  assessment_type: "skills_audit",
  label: "Skills Audit",
  description:
    "Structured skills-evidence assessment for work abilities, training needs, verification status, and vocational planning relevance.",
  version: 1,
  repeatable: false,
};
