/**
 * Disabled during the security remediation freeze.
 *
 * The prior route performed bulk ReportFieldTemplate mutations from a
 * browser-session role check. It has no active application caller and must
 * remain unavailable until a reviewed, scoped metadata migration workflow is
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
        "Bulk metadata repair is temporarily unavailable while security remediation is in progress.",
    },
    { status: 503 }
  );
});