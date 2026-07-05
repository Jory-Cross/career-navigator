/**
 * Disabled during the security remediation freeze.
 *
 * The prior route rewrote shared ReportFieldTemplate options through a
 * browser-session admin check. Configuration changes must use a reviewed,
 * scoped migration and cannot run through this legacy utility.
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
        "Service-code option population is temporarily unavailable while security remediation is in progress.",
    },
    { status: 503 }
  );
});