/**
 * Legacy O*NET adapter disabled during the security remediation freeze.
 *
 * O*NET search must return only through a reviewed, bounded server workflow.
 */
const REMEDIATION_ERROR =
  "O*NET career search is temporarily unavailable while security remediation is in progress.";

export async function searchOnetCareers() {
  throw new Error(REMEDIATION_ERROR);
}
