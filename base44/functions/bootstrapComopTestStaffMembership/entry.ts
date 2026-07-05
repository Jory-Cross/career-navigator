/**
 * Disabled during the security remediation freeze.
 *
 * The prior route created or reactivated a COMOP organization membership through
 * a one-off bootstrap path. It has no active application caller and must remain
 * unavailable until a reviewed, auditable membership-governance workflow is
 * explicitly approved.
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
        "Organization membership bootstrap is temporarily unavailable while security remediation is in progress.",
    },
    { status: 503 }
  );
});