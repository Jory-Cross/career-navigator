/**
 * Disabled during the security remediation freeze.
 *
 * The prior route created PlatformPermission catalog records. Permission
 * configuration is security-sensitive and must not change through a dormant
 * seed path outside a reviewed governance workflow.
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
        "Permission catalog seeding is temporarily unavailable while security remediation is in progress.",
    },
    { status: 503 }
  );
});