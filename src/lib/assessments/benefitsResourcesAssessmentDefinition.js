/**
 * Benefits & Resources Assessment
 *
 * Customized Employment / DSR Stage One
 *
 * Captures:
 * - Benefit programs
 * - BPQY process
 * - SSA release process
 * - Work incentives
 * - WIPA referral
 * - Financial resources
 * - Benefits concerns
 * - Employment impact
 */

export const BENEFITS_RESOURCES_SECTIONS = [
  {
    id: "benefits_snapshot",
    label: "Section 1: Benefits Snapshot",
    description: "Document all known benefits and funding sources.",
    questions: [
      {
        id: "current_benefits",
        label: "Current Benefits (select all that apply)",
        type: "select_all",
        options: [
          "SSI",
          "SSDI",
          "Medicaid",
          "Medicare",
          "DSPD Services",
          "SNAP",
          "Housing Assistance",
          "Veterans Benefits",
          "Private Insurance",
          "Other",
          "Unknown",
        ],
      },
      {
        id: "benefits_verified",
        label: "Benefits Verified",
        type: "multiple_choice",
        options: [
          "Fully Verified",
          "Partially Verified",
          "Reported Only",
          "Unknown",
        ],
      },
      {
        id: "benefits_notes",
        label: "Benefits Notes",
        type: "narrative",
      },
    ],
  },

  {
    id: "bpqy",
    label: "Section 2: Benefits Verification & BPQY",
    description: "Track BPQY and SSA information gathering.",
    questions: [
           {
        id: "bpqy_requested",
        label: "BPQY Requested",
        type: "multiple_choice",
        helpText:
          "BPQY means Benefits Planning Query. It is a Social Security report that shows current benefits, work history, earnings records, Medicare/Medicaid status, and work incentives. It helps staff understand how employment may affect benefits.",
        options: ["Yes", "No", "Unknown"],
      },
      {
        id: "bpqy_request_date",
        label: "BPQY Request Date",
        type: "date",
      },
      {
        id: "bpqy_received",
        label: "BPQY Received",
        type: "multiple_choice",
        options: ["Yes", "No", "Pending"],
      },
      {
        id: "bpqy_received_date",
        label: "BPQY Received Date",
        type: "date",
      },
           {
        id: "ssa_3288_completed",
        label: "SSA-3288 Release Completed",
        type: "multiple_choice",
        helpText:
          "SSA-3288 is the Social Security consent form that allows SSA to release benefit information to an approved person or agency. It is usually needed before requesting or reviewing detailed benefits information.",
        options: ["Yes", "No", "Unknown"],
      },
      {
        id: "ssa_3288_submitted",
        label: "SSA-3288 Submitted",
        type: "multiple_choice",
        options: ["Yes", "No", "Unknown"],
      },
      {
        id: "bpqy_notes",
        label: "BPQY Findings / Notes",
        type: "narrative",
      },
    ],
  },

  {
    id: "work_incentives",
    label: "Section 3: Work Incentives",
    description: "Identify work incentive opportunities.",
    questions: [
          {
        id: "pass_potential",
        label: "PASS Potential",
        type: "multiple_choice",
        helpText:
          "PASS means Plan to Achieve Self-Support. It is an SSA work incentive that may allow a person receiving SSI to set aside income or resources for an approved employment goal.",
        options: [
          "Strong Potential",
          "Possible",
          "Unlikely",
          "Not Reviewed",
        ],
      },
          {
        id: "irwe_potential",
        label: "IRWE Potential",
        type: "multiple_choice",
        helpText:
          "IRWE means Impairment-Related Work Expense. These are disability-related expenses a person pays out of pocket that may be deducted when SSA calculates countable earnings.",
        options: [
          "Strong Potential",
          "Possible",
          "Unlikely",
          "Not Reviewed",
        ],
      },
           {
        id: "able_account",
        label: "ABLE Account",
        type: "multiple_choice",
        helpText:
          "An ABLE account is a tax-advantaged savings account for eligible people with disabilities. It can help save money for qualified disability expenses without automatically counting against certain benefit limits.",
        options: [
          "Current Account",
          "Potential Candidate",
          "Not Applicable",
          "Unknown",
        ],
      },
      {
        id: "student_earned_income_exclusion",
        label: "Student Earned Income Exclusion",
        type: "multiple_choice",
        options: [
          "Eligible",
          "Not Eligible",
          "Unknown",
        ],
      },
      {
        id: "other_work_incentives",
        label: "Other Work Incentives",
        type: "narrative",
      },
    ],
  },

  {
    id: "wipa",
    label: "Section 4: WIPA / Benefits Counseling",
    description: "Track benefits planning referrals.",
    questions: [
          {
        id: "wipa_referral_needed",
        label: "WIPA Referral Needed",
        type: "multiple_choice",
        helpText:
          "WIPA means Work Incentives Planning and Assistance. WIPA programs provide benefits counseling to help people understand how work and earnings may affect Social Security, Medicaid, Medicare, and other benefits.",
        options: ["Yes", "No"],
      },
      {
        id: "wipa_referred",
        label: "Referral Made",
        type: "multiple_choice",
        options: ["Yes", "No"],
      },
      {
        id: "wipa_referral_date",
        label: "Referral Date",
        type: "date",
      },
      {
        id: "benefits_planner",
        label: "Benefits Planner / Agency",
        type: "short_text",
      },
      {
        id: "benefits_planning_outcome",
        label: "Benefits Planning Outcome",
        type: "narrative",
      },
    ],
  },

  {
    id: "resources",
    label: "Section 5: Financial & Resource Supports",
    description: "Document resources supporting employment success.",
    questions: [
      {
        id: "family_support",
        label: "Family Support",
        type: "narrative",
      },
      {
        id: "housing_support",
        label: "Housing Support",
        type: "narrative",
      },
      {
        id: "transportation_support",
        label: "Transportation Support",
        type: "narrative",
      },
      {
        id: "community_resources",
        label: "Community Resources",
        type: "narrative",
      },
      {
        id: "financial_resources",
        label: "Financial Resources",
        type: "narrative",
      },
      {
        id: "natural_supports",
        label: "Natural Supports",
        type: "narrative",
      },
    ],
  },

  {
    id: "benefit_concerns",
    label: "Section 6: Benefits Concerns",
    description: "Identify concerns that may affect employment.",
    questions: [
      {
        id: "fear_of_losing_benefits",
        label: "Fear of Losing Benefits",
        type: "multiple_choice",
        options: [
          "None",
          "Mild",
          "Moderate",
          "Significant",
        ],
      },
      {
        id: "fear_of_losing_healthcare",
        label: "Fear of Losing Healthcare",
        type: "multiple_choice",
        options: [
          "None",
          "Mild",
          "Moderate",
          "Significant",
        ],
      },
      {
        id: "employment_concerns",
        label: "Employment Related Concerns",
        type: "narrative",
      },
      {
        id: "support_needs",
        label: "Benefits Planning Support Needs",
        type: "narrative",
      },
    ],
  },

  {
    id: "staff_summary",
    label: "Section 7: Staff Summary",
    description: "Summarize findings and recommended actions.",
    questions: [
      {
        id: "benefits_summary",
        label: "Benefits Planning Summary",
        type: "narrative",
      },
      {
        id: "recommended_actions",
        label: "Recommended Actions",
        type: "narrative",
      },
      {
        id: "outstanding_needs",
        label: "Outstanding Needs",
        type: "narrative",
      },
      {
        id: "employment_considerations",
        label: "Employment Considerations",
        type: "narrative",
      },
    ],
  },
];

export const BENEFITS_RESOURCES_META = {
  assessment_type: "benefits_resources",
  label: "Benefits & Resources Assessment",
  description:
    "Customized Employment benefits planning, BPQY, work incentives, WIPA referral, and resource assessment.",
  version: 1,
  is_repeatable: false,
  one_per_client: true,
  client_category: "customized_employment",
};
