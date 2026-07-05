/**
 * Disabled during the security remediation freeze.
 *
 * The prior route could create, clone, activate, retire, and edit platform
 * pricing schedules and locked schedule items through a legacy PlatformAdmin
 * authority check. Pricing configuration remains unavailable until canonical
 * platform-governance controls are reviewed and re-enabled.
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