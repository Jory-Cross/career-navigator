/**
 * Disabled during the security remediation freeze.
 *
 * This legacy audit exposed shared PDF mapping configuration and could
 * reclassify ReportFieldTemplate records through a browser-session role check.
 * Mapping maintenance must use a reviewed, scoped workflow.
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
        "Coaching PDF mapping diagnostics are temporarily unavailable while security remediation is in progress.",
    },
    { status: 503 }
  );
});
