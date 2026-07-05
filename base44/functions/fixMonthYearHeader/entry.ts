/**
 * Disabled during the security remediation freeze.
 *
 * This legacy repair rewrote shared ReportFieldTemplate configuration using a
 * browser-session role check. Report-field changes must remain unavailable
 * until a reviewed, scoped administration workflow is approved.
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
        "Report-field maintenance is temporarily unavailable while security remediation is in progress.",
    },
    { status: 503 }
  );
});
