/**
 * Disabled during the security remediation freeze.
 *
 * This legacy diagnostic read shared ReportFieldTemplate configuration through
 * a browser-session role check and returned raw error details. Configuration
 * diagnostics must return only through a reviewed, scoped workflow.
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
        "Report-field diagnostics are temporarily unavailable while security remediation is in progress.",
    },
    { status: 503 }
  );
});
