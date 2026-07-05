/**
 * Disabled during the security remediation freeze.
 *
 * This legacy metadata audit exposed shared ReportFieldTemplate configuration
 * through a browser-session role check and did not enforce a method boundary.
 * Configuration audits must use a reviewed, scoped workflow.
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
        "Report-field metadata diagnostics are temporarily unavailable while security remediation is in progress.",
    },
    { status: 503 }
  );
});
