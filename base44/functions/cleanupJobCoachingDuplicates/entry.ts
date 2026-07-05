/**
 * Disabled during the security remediation freeze.
 *
 * The prior route removed and altered ReportFieldTemplate records through a
 * browser-session admin check. Historical configuration changes must use a
 * reviewed, scoped migration plan and cannot run through this legacy utility.
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
        "Legacy report-field cleanup is temporarily unavailable while security remediation is in progress.",
    },
    { status: 503 }
  );
});