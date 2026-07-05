/**
 * Disabled during the security remediation freeze.
 *
 * The prior route created PlatformPlan records. Pricing and plan configuration
 * changes are deferred during remediation, and this dormant seed path must
 * remain unavailable outside a reviewed release workflow.
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
        "Initial platform plan seeding is temporarily unavailable while security remediation is in progress.",
    },
    { status: 503 }
  );
});