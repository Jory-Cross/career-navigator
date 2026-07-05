/**
 * Disabled during the security remediation freeze.
 *
 * This legacy utility bulk-updated shared ReportFieldTemplate mapping metadata
 * through a browser-session role check. Report mapping maintenance must use a
 * reviewed, scoped administration workflow.
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
        "Report-field mapping maintenance is temporarily unavailable while security remediation is in progress.",
    },
    { status: 503 }
  );
});
