/**
 * Disabled during the security remediation freeze.
 *
 * The prior route created PlatformPlan records. Pricing and plan changes are
 * deferred during remediation, and this dormant seed path must not create or
 * alter platform configuration outside a reviewed release workflow.
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
        "Business plan seeding is temporarily unavailable while security remediation is in progress.",
    },
    { status: 503 }
  );
});