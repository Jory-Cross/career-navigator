/**
 * Stripe settlement may update billing and durable enrollment state, but it
 * must never assign a User role, accept a PendingRoleAssignment, or create a
 * CE cohort membership. Those actions are performed only by the authenticated,
 * tenant-scoped applyPendingRoleIfNeeded login activation workflow.
 */
async function activateExistingPaidCEStudentIfEligible(
  _base44: any,
  _billingRecord: any
) {
  return {
    activated: false,
    reason: "activation_deferred_to_applyPendingRoleIfNeeded",
  };
}
