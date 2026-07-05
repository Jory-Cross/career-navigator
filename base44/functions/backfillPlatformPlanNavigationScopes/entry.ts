/**
 * Disabled during the security remediation freeze.
 *
 * This legacy maintenance route could update every PlatformPlan through a
 * PlatformAdmin lookup without canonical server-side platform-governance
 * validation. Shared plan configuration must not change through an unreviewed
 * backfill path.
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
        "Platform plan maintenance is temporarily unavailable while security remediation is in progress.",
    },
    { status: 503 }
  );
});
