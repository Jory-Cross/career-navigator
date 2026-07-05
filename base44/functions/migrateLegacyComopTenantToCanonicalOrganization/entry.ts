/**
 * Disabled during the security remediation freeze.
 *
 * The prior route could create a canonical organization and rewrite user,
 * invitation, cohort, billing, and subscription tenant scope. Historical tenant
 * migration must use a separately reviewed dry-run and mutation plan, not a
 * callable legacy endpoint.
 */
Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return Response.json(
      {
        ok: false,
        error: "This route accepts POST requests only.",
      },
      { status: 405 }
    );
  }

  return Response.json(
    {
      ok: false,
      error:
        "Legacy tenant migration is temporarily unavailable while security remediation is in progress.",
    },
    { status: 503 }
  );
});
