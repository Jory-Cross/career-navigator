/**
 * Disabled during the security remediation freeze.
 *
 * This legacy diagnostic exposed platform plan records through a PlatformAdmin
 * lookup without canonical server-side platform-governance validation. Platform
 * pricing diagnostics remain unavailable until a reviewed, auditable workflow
 * is explicitly approved.
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
        "Platform plan diagnostics are temporarily unavailable while security remediation is in progress.",
    },
    { status: 503 }
  );
});
