/**
 * Disabled during the security remediation freeze.
 *
 * The prior route could promote a hard-coded user to Platform Owner and mutate
 * both User and PlatformAdmin records. Its authorization relied on session role
 * fields rather than canonical server-validated platform-owner authority. There
 * is no active application caller. Keep this route unavailable until a reviewed,
 * explicit platform-governance workflow is implemented.
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
        "Platform-owner bootstrap is temporarily unavailable while security remediation is in progress.",
    },
    { status: 503 }
  );
});