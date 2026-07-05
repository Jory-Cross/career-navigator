/**
 * Disabled during the security remediation freeze.
 *
 * The prior route exposed shared ReportFieldTemplate configuration through a
 * browser-session admin check. Diagnostic configuration reads must use a
 * reviewed, scoped platform audit workflow.
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
        "Job Coaching field diagnostics are temporarily unavailable while security remediation is in progress.",
    },
    { status: 503 }
  );
});