/**
 * Disabled during the security remediation freeze.
 *
 * The prior route created PlatformPricingSchedule records. Pricing changes are
 * deferred during remediation, and this dormant bootstrap path must not create
 * platform configuration outside a reviewed release workflow.
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
        "Pricing schedule bootstrap is temporarily unavailable while security remediation is in progress.",
    },
    { status: 503 }
  );
});