/**
 * Disabled during the security remediation freeze.
 *
 * This legacy repair rewrote shared ReportFieldTemplate source-form metadata
 * and exposed the full report mapping through a browser-session role check.
 * Report configuration changes require a reviewed, scoped workflow.
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
        "Report-field form-code maintenance is temporarily unavailable while security remediation is in progress.",
    },
    { status: 503 }
  );
});
