/**
 * Legacy browser data layer disabled during the security remediation freeze.
 *
 * This module previously performed broad direct entity reads and writes,
 * including TimeEntry and ReportFieldAnswer mutations. Server-authorized
 * route-specific clients must be used instead.
 */

const REMEDIATION_ERROR =
  "This legacy data-access workflow is unavailable during security remediation.";

export const DataLayer = new Proxy(
  {},
  {
    get() {
      return async () => {
        throw new Error(REMEDIATION_ERROR);
      };
    },
  }
);
