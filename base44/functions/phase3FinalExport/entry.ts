/**
 * Disabled during the security remediation freeze.
 *
 * The prior route exposed broad ReportFieldTemplate metadata behind a
 * browser-session role check. It has no active application caller and must
 * remain unavailable until a reviewed, scoped reporting-audit workflow is
 * explicitly approved.
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
        "Legacy report metadata export is temporarily unavailable while security remediation is in progress.",
    },
    { status: 503 }
  );
});