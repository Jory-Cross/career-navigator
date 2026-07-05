/**
 * Disabled during the security remediation freeze.
 *
 * The prior route changed PlatformPlan activation state for a trainer-business
 * pilot. Pricing and plan configuration changes are deferred during remediation,
 * and this dormant mutation path must remain unavailable.
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
        "Trainer-business plan activation is temporarily unavailable while security remediation is in progress.",
    },
    { status: 503 }
  );
});