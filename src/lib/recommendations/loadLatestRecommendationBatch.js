/**
 * Legacy browser recommendation loader disabled during the security
 * remediation freeze.
 *
 * This helper previously queried JobRecommendationBatch directly from the
 * browser using a caller-provided client ID. Restore recommendation history
 * only through a reviewed, server-authorized client workspace route.
 */
const REMEDIATION_ERROR =
  "Saved recommendation history is temporarily unavailable while security remediation is in progress.";

export async function loadLatestRecommendationBatch() {
  throw new Error(REMEDIATION_ERROR);
}
