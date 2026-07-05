/**
 * Disabled during the security remediation freeze.
 *
 * This legacy audit exposed shared ReportFieldTemplate definitions and raw
 * diagnostic error details through a browser-session role check. Configuration
 * audits must use a reviewed, scoped workflow.
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
        "Report-field duplicate diagnostics are temporarily unavailable while security remediation is in progress.",
    },
    { status: 503 }
  );
});
