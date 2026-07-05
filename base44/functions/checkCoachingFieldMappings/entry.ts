/**
 * Disabled during the security remediation freeze.
 *
 * This legacy diagnostic could inspect PDF mapping configuration and silently
 * rewrite shared ReportFieldTemplate records after a browser-session role
 * check. Report mapping changes must use a reviewed, scoped workflow.
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
        "Report mapping diagnostics are temporarily unavailable while security remediation is in progress.",
    },
    { status: 503 }
  );
});
