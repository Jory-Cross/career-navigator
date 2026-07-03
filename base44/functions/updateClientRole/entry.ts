/**
 * Retired security endpoint.
 *
 * Client access is granted only through the authenticated,
 * tenant-scoped applyPendingRoleIfNeeded activation workflow.
 * This legacy endpoint previously trusted caller-supplied identifiers
 * and could change another account's role.
 */
Deno.serve(() => {
  return Response.json(
    {
      success: false,
      error:
        "This legacy client-role endpoint has been retired. Client access is granted through the secure invitation activation process.",
    },
    { status: 410 },
  );
});
