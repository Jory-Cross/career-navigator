/**
 * Legacy browser recommendation generation disabled during the security
 * remediation freeze.
 *
 * This module previously combined client data in the browser and directly
 * created JobRecommendationBatch records. Restore recommendations only through
 * a reviewed, server-authorized client workspace workflow.
 */
const REMEDIATION_ERROR =
  "AI job recommendation generation is temporarily unavailable while security remediation is in progress.";

export async function generateRecommendationBatch() {
  throw new Error(REMEDIATION_ERROR);
}

export default generateRecommendationBatch;
