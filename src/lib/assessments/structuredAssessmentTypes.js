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

import { QUESTION_TYPES } from "@/lib/assessments/structuredAssessmentTypes";

export const BENEFITS_RESOURCES_SECTIONS = [
  {
    id: "benefits_snapshot",
    label: "Section 1: Benefits Snapshot",
    description: "Document all known benefits and funding sources.",
    questions: [
      {
        id: "current_benefits",
        label: "Current Benefits (select all that apply)",
        type: QUESTION_TYPES.SELECT_ALL,
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
        type: QUESTION_TYPES.MULTIPLE_CHOICE,
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
        type: QUESTION_TYPES.NARRATIVE,
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
        type: QUESTION_TYPES.MULTIPLE_CHOICE,
        options: ["Yes", "No", "Unknown"],
      },
      {
        id: "bpqy_request_date",
        label: "BPQY Request Date",
        type: QUESTION_TYPES.DATE,
      },
      {
        id: "bpqy_received",
        label: "BPQY Received",
        type: QUESTION_TYPES.MULTIPLE_CHOICE,
        options: ["Yes", "No", "Pending"],
      },
      {
        id: "bpqy_received_date",
        label: "BPQY Received Date",
        type: QUESTION_TYPES.DATE,
      },
      {
        id: "ssa_3288_completed",
        label: "SSA-3288 Release Completed",
        type: QUESTION_TYPES.MULTIPLE_CHOICE,
        options: ["Yes", "No", "Unknown"],
      },
      {
        id: "ssa_3288_submitted",
        label: "SSA-3288 Submitted",
        type: QUESTION_TYPES.MULTIPLE_CHOICE,
        options: ["Yes", "No", "Unknown"],
      },
      {
        id: "bpqy_notes",
        label: "BPQY Findings / Notes",
        type: QUESTION_TYPES.NARRATIVE,
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
        type: QUESTION_TYPES.MULTIPLE_CHOICE,
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
        type: QUESTION_TYPES.MULTIPLE_CHOICE,
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
        type: QUESTION_TYPES.MULTIPLE_CHOICE,
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
        type: QUESTION_TYPES.MULTIPLE_CHOICE,
        options: [
          "Eligible",
          "Not Eligible",
          "Unknown",
        ],
      },
      {
        id: "other_work_incentives",
        label: "Other Work Incentives",
        type: QUESTION_TYPES.NARRATIVE,
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
        type: QUESTION_TYPES.MULTIPLE_CHOICE,
        options: ["Yes", "No"],
      },
      {
        id: "wipa_referred",
        label: "Referral Made",
        type: QUESTION_TYPES.MULTIPLE_CHOICE,
        options: ["Yes", "No"],
      },
      {
        id: "wipa_referral_date",
        label: "Referral Date",
        type: QUESTION_TYPES.DATE,
      },
      {
        id: "benefits_planner",
        label: "Benefits Planner / Agency",
        type: QUESTION_TYPES.SHORT_TEXT,
      },
      {
        id: "benefits_planning_outcome",
        label: "Benefits Planning Outcome",
        type: QUESTION_TYPES.NARRATIVE,
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
        type: QUESTION_TYPES.NARRATIVE,
      },
      {
        id: "housing_support",
        label: "Housing Support",
        type: QUESTION_TYPES.NARRATIVE,
      },
      {
        id: "transportation_support",
        label: "Transportation Support",
        type: QUESTION_TYPES.NARRATIVE,
      },
      {
        id: "community_resources",
        label: "Community Resources",
        type: QUESTION_TYPES.NARRATIVE,
      },
      {
        id: "financial_resources",
        label: "Financial Resources",
        type: QUESTION_TYPES.NARRATIVE,
      },
      {
        id: "natural_supports",
        label: "Natural Supports",
        type: QUESTION_TYPES.NARRATIVE,
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
        type: QUESTION_TYPES.MULTIPLE_CHOICE,
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
        type: QUESTION_TYPES.MULTIPLE_CHOICE,
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
        type: QUESTION_TYPES.NARRATIVE,
      },
      {
        id: "support_needs",
        label: "Benefits Planning Support Needs",
        type: QUESTION_TYPES.NARRATIVE,
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
        type: QUESTION_TYPES.NARRATIVE,
      },
      {
        id: "recommended_actions",
        label: "Recommended Actions",
        type: QUESTION_TYPES.NARRATIVE,
      },
      {
        id: "outstanding_needs",
        label: "Outstanding Needs",
        type: QUESTION_TYPES.NARRATIVE,
      },
      {
        id: "employment_considerations",
        label: "Employment Considerations",
        type: QUESTION_TYPES.NARRATIVE,
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
