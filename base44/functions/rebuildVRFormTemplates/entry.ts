/**
 * Disabled during the security remediation freeze.
 *
 * This legacy rebuild could replace shared ReportFieldTemplate definitions
 * through a browser-session role check. Form-definition changes must use a
 * reviewed, scoped administration workflow and cannot run from this utility.
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
        "VR form template rebuilding is temporarily unavailable while security remediation is in progress.",
    },
    { status: 503 }
  );
});
