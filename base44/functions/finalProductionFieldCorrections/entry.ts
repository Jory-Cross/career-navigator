/**
 * Disabled during the security remediation freeze.
 *
 * This legacy utility rewrote shared ReportFieldTemplate configuration using a
 * browser-session role check. Production report-field corrections must be made
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
        "Report-field production corrections are temporarily unavailable while security remediation is in progress.",
    },
    { status: 503 }
  );
});
