/**
 * Disabled during the security remediation freeze.
 *
 * The prior route exposed cross-tenant pricing schedules, pricing snapshots,
 * and subscription assignments through a legacy PlatformAdmin-only check.
 * Pricing administration remains unavailable until canonical platform-governance
 * controls are reviewed and re-enabled.
 */
Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return Response.json(
      { ok: false, error: "This route accepts POST requests only." },
      { status: 405 }
    );
  }

  return Response.json(
    {
      ok: false,
      error:
        "Platform pricing administration is temporarily unavailable while security remediation is in progress.",
    },
    { status: 503 }
  );
});