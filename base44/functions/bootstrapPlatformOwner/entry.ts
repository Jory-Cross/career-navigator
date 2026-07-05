/**
 * Disabled during the security remediation freeze.
 *
 * This legacy bootstrap route could create the first Platform Owner using a
 * browser-session role label instead of canonical server-side platform
 * governance. Platform Owner provisioning must remain unavailable until a
 * reviewed, auditable, canonical bootstrap workflow is explicitly approved.
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
        "Platform Owner bootstrap is temporarily unavailable while security remediation is in progress.",
    },
    { status: 503 }
  );
});
