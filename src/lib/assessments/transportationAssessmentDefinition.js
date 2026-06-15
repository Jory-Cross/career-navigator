/**
 * Transportation Assessment — Definition
 *
 * Comprehensive transportation evaluation covering:
 * - Current transportation profile & methods
 * - Reliability & consistency
 * - Barriers & challenges
 * - Transportation skills & self-management
 * - Training needs
 * - Resource needs
 * - Employment impact & restrictions
 * - Staff observations
 *
 * Produces direct evidence for WSA transportation_observations field.
 * One active assessment per client.
 * assessment_type: "transportation"
 */

export const TRANSPORTATION_ASSESSMENT_SECTIONS = [
  {
    id: "current_profile",
    label: "Section 1: Current Transportation Profile",
    description: "Document current transportation methods and access.",
    questions: [
      {
        id: "transportation_methods",
        label: "Transportation Methods Used (select all that apply)",
        type: "select_multiple",
        options: [
          "Drives self",
          "Family transportation",
          "Friend transportation",
          "Employer transportation",
          "Co-worker transportation",
          "Public transportation",
          "Paratransit",
          "Ride share",
          "Taxi",
          "Bicycle",
          "Walking",
          "Manual wheelchair",
          "Motorized wheelchair",
          "Power scooter / mobility device",
          "Community transportation service",
          "Transportation provider",
          "Other",
        ],
      },
      {
        id: "primary_transportation_method",
        label: "Primary Transportation Method",
        type: "select_single",
        dependsOn: { field: "transportation_methods", requiresAnswer: true },
        options: [
          "Drives self",
          "Family transportation",
          "Friend transportation",
          "Employer transportation",
          "Co-worker transportation",
          "Public transportation",
          "Paratransit",
          "Ride share",
          "Taxi",
          "Bicycle",
          "Walking",
          "Manual wheelchair",
          "Motorized wheelchair",
          "Power scooter / mobility device",
          "Community transportation service",
          "Transportation provider",
          "Other",
        ],
      },
      {
        id: "local_independent_mobility",
        label: "Local Independent Mobility",
        type: "select_single",
        options: [
          "Independent within community",
          "Independent within walking/wheelchair distance only",
          "Requires transportation beyond local area",
          "Not independently mobile",
        ],
      },
      {
        id: "driver_status",
        label: "Driver Status",
        type: "select_single",
        options: [
          "Valid driver's license",
          "Learner permit",
          "Previously licensed",
          "No license",
          "Not pursuing license",
        ],
      },
      {
        id: "vehicle_access",
        label: "Vehicle Access",
        type: "select_single",
        options: [
          "Own vehicle",
          "Family vehicle available",
          "Shared vehicle available",
          "Vehicle available with permission",
          "No vehicle access",
        ],
      },
      {
        id: "public_transit_access",
        label: "Public Transportation Access",
        type: "select_single",
        options: [
          "Public transportation available",
          "Limited public transportation access",
          "No public transportation available",
          "Unknown",
        ],
      },
      {
        id: "paratransit_status",
        label: "Paratransit Status",
        type: "select_single",
        options: [
          "Currently approved",
          "Previously approved",
          "Application in process",
          "Eligible but not applied",
          "Not eligible",
          "Unknown",
        ],
      },
    ],
  },

  {
    id: "reliability",
    label: "Section 2: Transportation Reliability",
    description: "Assess consistency and reliability of transportation.",
    questions: [
      {
        id: "reliability_rating",
        label: "Transportation Reliability Rating",
        type: "scale",
        scaleMin: 1,
        scaleMax: 5,
        scaleLabels: [
          "1 = Severe Concerns (unavailable most days, frequent absences, prevents employment)",
          "2 = Significant Concerns (inconsistent, frequent missed rides, limited opportunities)",
          "3 = Moderate Concerns (usually available, occasional concerns, some limitations)",
          "4 = Minor Concerns (generally reliable, rare delays, minor restrictions)",
          "5 = Reliable (consistently available, no concerns, supports employment)",
        ],
      },
      {
        id: "transportation_availability",
        label: "How consistently is transportation available when needed?",
        type: "select_single",
        options: [
          "Always available",
          "Usually available",
          "Sometimes available",
          "Frequently unavailable",
          "Rarely available",
        ],
      },
      {
        id: "absences_past_12_months",
        label: "Transportation-Related Absences (Past 12 Months)",
        type: "select_single",
        options: [
          "None",
          "1–2",
          "3–5",
          "More than 5",
          "Unknown",
        ],
      },
      {
        id: "provider_reliability",
        label: "How often does transportation itself cause lateness? (transit delays, cancellations, delays)",
        type: "select_single",
        options: [
          "Never",
          "Rarely",
          "Sometimes",
          "Frequently",
          "Almost always",
        ],
      },
      {
        id: "client_readiness",
        label: "How often is the client ready when transportation arrives?",
        type: "select_single",
        options: [
          "Always ready",
          "Usually ready",
          "Sometimes ready",
          "Frequently not ready",
          "Rarely ready",
        ],
      },
      {
        id: "availability_by_schedule",
        label: "Transportation Availability By Schedule (select all that apply)",
        type: "select_multiple",
        options: [
          "Morning shifts",
          "Afternoon shifts",
          "Evening shifts",
          "Overnight shifts",
          "Weekends",
          "Holidays",
        ],
      },
    ],
  },

  {
    id: "barriers",
    label: "Section 3: Transportation Barriers",
    description: "Assess barriers impacting transportation access.",
    introText:
      "For each barrier, rate using: 0 = No Barrier, 1 = Mild, 2 = Moderate, 3 = Significant",
    questions: [
      {
        id: "physical_barriers",
        label: "Physical Barriers (mobility limitations, endurance, sensory, medical)",
        type: "scale",
        scaleMin: 0,
        scaleMax: 3,
      },
      {
        id: "cognitive_barriers",
        label:
          "Cognitive Barriers (route planning, memory, problem-solving, directions, schedules)",
        type: "scale",
        scaleMin: 0,
        scaleMax: 3,
      },
      {
        id: "financial_barriers",
        label: "Financial Barriers (costs, fuel, maintenance, transit fees)",
        type: "scale",
        scaleMin: 0,
        scaleMax: 3,
      },
      {
        id: "scheduling_barriers",
        label:
          "Scheduling Barriers (scheduling conflicts, limited availability, advance requirements)",
        type: "scale",
        scaleMin: 0,
        scaleMax: 3,
      },
      {
        id: "geographic_barriers",
        label:
          "Geographic Barriers (rural location, long distances, limited infrastructure)",
        type: "scale",
        scaleMin: 0,
        scaleMax: 3,
      },
      {
        id: "confidence_emotional_barriers",
        label:
          "Confidence / Emotional Barriers (anxiety, fear of public transit, fear of getting lost, low confidence)",
        type: "scale",
        scaleMin: 0,
        scaleMax: 3,
      },
      {
        id: "safety_concerns",
        label:
          "Safety Concerns (personal safety, community safety, environmental safety)",
        type: "scale",
        scaleMin: 0,
        scaleMax: 3,
      },
    ],
  },

  {
    id: "skills",
    label: "Section 4: Transportation Skills & Self-Management",
    description: "Assess transportation-related competencies.",
    introText: "Rate ability using: 1 = Dependent, 2 = Requires Significant Support, 3 = Some Support, 4 = Mostly Independent, 5 = Independent",
    questions: [
      {
        id: "skills_section",
        label: "Rate ability to:",
        type: "skill_matrix",
        skills: [
          "Schedule rides independently",
          "Arrange transportation alternatives",
          "Use public transportation",
          "Use paratransit services",
          "Read transportation schedules",
          "Understand route maps",
          "Plan routes",
          "Follow routes",
          "Use navigation apps",
          "Request transportation assistance",
          "Communicate transportation needs",
          "Adapt to transportation changes",
          "Manage transportation emergencies",
        ],
        scaleMin: 1,
        scaleMax: 5,
      },
      {
        id: "self_management_section",
        label: "Transportation Self-Management",
        type: "skill_matrix",
        skills: [
          "Remembers transportation schedules",
          "Prepares for transportation independently",
          "Arrives at pickup location on time",
          "Maintains transportation routines",
          "Follows transportation plans consistently",
        ],
        scaleMin: 1,
        scaleMax: 5,
      },
      {
        id: "support_level_section",
        label: "Transportation Support Level",
        type: "support_matrix",
        supportCategories: [
          "Route Planning",
          "Ride Scheduling",
          "Transportation Problem Solving",
          "Transportation Follow Through",
        ],
        supportLevels: [
          "Independent",
          "Occasional Support",
          "Regular Support",
          "Extensive Support",
        ],
      },
      {
        id: "prompting_requirement",
        label: "Transportation Prompting Requirement",
        type: "select_single",
        options: [
          "Independent",
          "Occasional reminder",
          "Daily reminder",
          "Multiple reminders required",
          "Full support required",
        ],
      },
    ],
  },

  {
    id: "training_needs",
    label: "Section 5: Transportation Training Needs",
    description: "Identify training and instruction needs.",
    introText: "For each item: Not Needed, May Benefit, Recommended, Strongly Recommended",
    questions: [
      {
        id: "training_needs_matrix",
        label: "Rate Training Need Level",
        type: "training_matrix",
        trainingItems: [
          "Travel training",
          "Public transportation training",
          "Paratransit training",
          "Route planning training",
          "Ride scheduling training",
          "Navigation technology training",
          "Transportation self-advocacy",
          "Transportation problem-solving",
          "Community mobility training",
          "Transportation safety training",
        ],
        levels: [
          "Not Needed",
          "May Benefit",
          "Recommended",
          "Strongly Recommended",
        ],
      },
    ],
  },

  {
    id: "resource_needs",
    label: "Section 6: Transportation Resource Needs",
    description: "Identify resource support and services needed.",
    introText: "For each item: Not Needed, Consider, Recommended, Immediate Need",
    questions: [
      {
        id: "resource_matrix",
        label: "Rate Resource Need Level",
        type: "resource_matrix",
        resourceItems: [
          "Paratransit application assistance",
          "Reduced fare program enrollment",
          "Transportation vouchers",
          "Mobility services",
          "Travel training services",
          "Community transportation resources",
          "Ride coordination assistance",
          "Transportation funding resources",
          "Vehicle access resources",
          "Employment transportation supports",
        ],
        levels: [
          "Not Needed",
          "Consider",
          "Recommended",
          "Immediate Need",
        ],
      },
    ],
  },

  {
    id: "employment_impact",
    label: "Section 7: Employment Impact",
    description: "Assess how transportation affects employment.",
    questions: [
      {
        id: "employment_support",
        label: "Transportation Supports Employment",
        type: "select_single",
        options: [
          "Fully supports employment",
          "Supports employment with minor limitations",
          "Supports employment with moderate limitations",
          "Significant employment limitations",
          "Transportation currently prevents employment",
        ],
      },
      {
        id: "geographic_restrictions",
        label: "Geographic Employment Restrictions",
        type: "select_single",
        options: [
          "No restrictions",
          "Minor restrictions",
          "Moderate restrictions",
          "Significant restrictions",
        ],
      },
      {
        id: "shift_restrictions",
        label: "Shift Restrictions",
        type: "select_single",
        options: [
          "No restrictions",
          "Minor restrictions",
          "Moderate restrictions",
          "Significant restrictions",
        ],
      },
      {
        id: "attendance_risk",
        label: "Attendance Risk",
        type: "select_single",
        options: [
          "Low",
          "Mild",
          "Moderate",
          "High",
        ],
      },
      {
        id: "accommodations_needed",
        label: "Transportation Accommodations Needed (select all that apply)",
        type: "select_multiple",
        options: [
          "Flexible scheduling",
          "Predictable scheduling",
          "Extended arrival window",
          "Transportation coordination support",
          "Transportation training support",
          "Remote work consideration",
          "Other",
        ],
      },
    ],
  },

  {
    id: "staff_observations",
    label: "Section 8: Staff Transportation Observations",
    description: "Document staff observations and recommendations.",
    questions: [
      {
        id: "observed_strengths",
        label: "Observed Strengths",
        type: "textarea",
        placeholder: "Document transportation strengths, reliable patterns, positive factors...",
      },
      {
        id: "observed_barriers",
        label: "Observed Barriers",
        type: "textarea",
        placeholder: "Document transportation challenges, unreliable patterns, barriers...",
      },
      {
        id: "supports_working",
        label: "Transportation Supports Currently Working",
        type: "textarea",
        placeholder: "Document which supports are effective, what helps the client...",
      },
      {
        id: "recommended_supports",
        label: "Recommended Transportation Supports",
        type: "textarea",
        placeholder: "Document recommended supports, services, or accommodations...",
      },
      {
        id: "employment_considerations",
        label: "Employment Considerations",
        type: "textarea",
        placeholder: "Document employment planning considerations related to transportation...",
      },
    ],
  },
];

export const TRANSPORTATION_ASSESSMENT_META = {
  assessment_type: "transportation",
  label: "Transportation Assessment",
  description:
    "Comprehensive assessment of client's transportation situation, reliability, barriers, skills, training needs, resource needs, and employment impact.",
  version: 1,
  is_repeatable: false,
  one_per_client: true,
};

// Scoring helper
export function calculateTransportationScores(responses) {
  // Transportation Independence Score (based on skills, self-management, support level)
  const skillsScore = calculateAverageSkillsScore(responses);
  const selfMgmtScore = calculateSelfManagementScore(responses);
  const supportScore = calculateSupportLevelScore(responses);

  const independenceScore = Math.round((skillsScore + selfMgmtScore + supportScore) / 3);

  // Transportation Barrier Severity Score (based on barrier ratings)
  const barrierScore = calculateBarrierSeverityScore(responses);

  // Employment Transportation Risk (based on reliability, attendance, restrictions, barriers)
  const riskScore = calculateEmploymentRiskScore(responses, barrierScore);

  return {
    transportation_independence_score: mapIndependenceScore(independenceScore),
    transportation_barrier_severity: mapBarrierScore(barrierScore),
    employment_transportation_risk: mapRiskScore(riskScore),
  };
}

function calculateAverageSkillsScore(responses) {
  const skillsData = responses.skills_section || {};
  if (!skillsData || Object.keys(skillsData).length === 0) return 0;
  const values = Object.values(skillsData)
    .map((v) => Number(v))
    .filter((v) => !isNaN(v));
  return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function calculateSelfManagementScore(responses) {
  const selfMgmtData = responses.self_management_section || {};
  if (!selfMgmtData || Object.keys(selfMgmtData).length === 0) return 0;
  const values = Object.values(selfMgmtData)
    .map((v) => Number(v))
    .filter((v) => !isNaN(v));
  return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function calculateSupportLevelScore(responses) {
  // Map support levels to numeric: Independent=5, Occasional=4, Regular=3, Extensive=2
  const supportData = responses.support_level_section || {};
  const mapping = {
    Independent: 5,
    "Occasional Support": 4,
    "Regular Support": 3,
    "Extensive Support": 2,
  };
  const values = Object.values(supportData)
    .map((v) => mapping[v] || 0)
    .filter((v) => v > 0);
  return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function calculateBarrierSeverityScore(responses) {
  const barriers = [
    responses.physical_barriers,
    responses.cognitive_barriers,
    responses.financial_barriers,
    responses.scheduling_barriers,
    responses.geographic_barriers,
    responses.confidence_emotional_barriers,
    responses.safety_concerns,
  ]
    .map((v) => Number(v))
    .filter((v) => !isNaN(v));
  return barriers.length > 0 ? barriers.reduce((a, b) => a + b, 0) / barriers.length : 0;
}

function calculateEmploymentRiskScore(responses, barrierScore) {
  let riskScore = 0;

  // Reliability rating (inverse: 5=low risk, 1=high risk)
  const reliabilityRating = Number(responses.reliability_rating) || 3;
  riskScore += (6 - reliabilityRating) * 2;

  // Attendance risk
  const attendanceRiskMap = { Low: 0, Mild: 1, Moderate: 2, High: 3 };
  const attendanceRisk = attendanceRiskMap[responses.attendance_risk] || 1;
  riskScore += attendanceRisk * 2;

  // Shift restrictions
  const shiftRestrictionsMap = {
    "No restrictions": 0,
    "Minor restrictions": 1,
    "Moderate restrictions": 2,
    "Significant restrictions": 3,
  };
  const shiftRestrictions = shiftRestrictionsMap[responses.shift_restrictions] || 1;
  riskScore += shiftRestrictions;

  // Geographic restrictions
  const geoRestrictionsMap = {
    "No restrictions": 0,
    "Minor restrictions": 1,
    "Moderate restrictions": 2,
    "Significant restrictions": 3,
  };
  const geoRestrictions = geoRestrictionsMap[responses.geographic_restrictions] || 1;
  riskScore += geoRestrictions;

  // Barrier severity influence
  riskScore += barrierScore;

  return riskScore;
}

function mapIndependenceScore(score) {
  if (score >= 4.5) return "Independent";
  if (score >= 3.5) return "Mostly Independent";
  if (score >= 2.5) return "Needs Intermittent Support";
  if (score >= 1.5) return "Needs Regular Support";
  return "Highly Dependent";
}

function mapBarrierScore(score) {
  if (score < 0.5) return "Minimal";
  if (score < 1.5) return "Mild";
  if (score < 2.5) return "Moderate";
  return "Significant";
}

function mapRiskScore(score) {
  if (score < 3) return "Low Risk";
  if (score < 6) return "Mild Risk";
  if (score < 10) return "Moderate Risk";
  return "High Risk";
}