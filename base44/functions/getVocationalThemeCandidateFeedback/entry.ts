/**
 * Disabled during the security remediation freeze.
 *
 * The prior route service-read vocational-theme feedback using browser-session
 * role checks without canonical client, cohort, and organization authorization.
 * It must remain unavailable until a fully scoped feedback-read workflow is
 * reviewed.
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
        "Vocational theme feedback is temporarily unavailable while security remediation is in progress.",
    },
    { status: 503 }
  );
});