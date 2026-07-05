/**
 * Legacy browser O*NET client disabled during the security remediation freeze.
 *
 * This module previously forwarded arbitrary provider paths and assessment
 * answers to a proxy route. O*NET functionality must return only through a
 * reviewed, bounded server-authorized workflow.
 */
const REMEDIATION_ERROR =
  "O*NET lookup is temporarily unavailable while security remediation is in progress.";

function unavailable() {
  throw new Error(REMEDIATION_ERROR);
}

export async function getInterestProfilerQuestions() {
  return unavailable();
}

export async function getInterestProfilerResults() {
  return unavailable();
}

export async function getInterestProfilerJobZones() {
  return unavailable();
}

export async function getInterestProfilerCareers() {
  return unavailable();
}

export async function searchOnetCareersByKeyword() {
  return unavailable();
}

export async function getOnetOccupationOverview() {
  return unavailable();
}

export async function getOnetOccupationSkills() {
  return unavailable();
}

export async function getOnetOccupationEducation() {
  return unavailable();
}

export async function getOnetOccupationTechnology() {
  return unavailable();
}

export async function getOnetOccupationJobZone() {
  return unavailable();
}

export async function getOnetOccupationTasks() {
  return unavailable();
}

export async function getOnetOccupationDetailedSkills() {
  return unavailable();
}

export async function getOnetOccupationTechnologySkills() {
  return unavailable();
}

export async function getOnetOccupationDetails() {
  return unavailable();
}

export function buildOnetRecommendationProfile() {
  return null;
}

export async function testOnetConnection() {
  return false;
}
