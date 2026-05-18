import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * submitAccessRequest — DISABLED
 *
 * This app uses invite-only access. Self-service access requests are not permitted.
 * The only valid approval path is a PendingRoleAssignment created by an admin/manager invite.
 */
Deno.serve(async (req) => {
  console.log('[submitAccessRequest] Blocked — invite-only access is enforced. No self-service requests allowed.');
  return Response.json(
    { error: 'Access requests are not accepted. Please contact your manager or administrator for an invitation.' },
    { status: 403 }
  );
});