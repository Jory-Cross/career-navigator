/**
 * Disabled during the security remediation freeze.
 *
 * The prior route created CE tiered plan-feature entitlement mappings and
 * default limits. CE and pricing configuration changes are deferred during
 * remediation, and this dormant seed path must remain unavailable.
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
        "CE tiered plan feature seeding is temporarily unavailable while security remediation is in progress.",
    },
    { status: 503 }
  );
});