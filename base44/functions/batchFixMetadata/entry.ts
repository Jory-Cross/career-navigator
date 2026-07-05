/**
 * Disabled during the security remediation freeze.
 *
 * This legacy batch utility could update every active ReportFieldTemplate using
 * a browser-session role check. Shared report configuration must be changed
 * only through a reviewed, scoped administration workflow.
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
        "Report-field metadata maintenance is temporarily unavailable while security remediation is in progress.",
    },
    { status: 503 }
  );
});
