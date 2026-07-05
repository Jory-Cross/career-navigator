/**
 * Disabled during the security remediation freeze.
 *
 * The prior route exposed vocational-theme feedback using role/access fallback
 * checks and legacy client creator-email visibility. It must remain unavailable
 * until a fully scoped client, cohort, and organization authorization model is
 * reviewed for the consensus workflow.
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
        "Vocational theme consensus is temporarily unavailable while security remediation is in progress.",
    },
    { status: 503 }
  );
});