/**
 * Disabled during the security remediation freeze.
 *
 * The prior route retired PlatformPlan records, deactivated plan-feature
 * mappings, and seeded replacement plans. Pricing and plan configuration
 * changes are deferred during remediation, and this dormant migration path
 * must remain unavailable.
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
        "Tiered plan migration is temporarily unavailable while security remediation is in progress.",
    },
    { status: 503 }
  );
});