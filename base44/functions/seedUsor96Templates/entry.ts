/**
 * Disabled during the security remediation freeze.
 *
 * This legacy utility deleted and recreated shared USOR96 ReportFieldTemplate
 * records for any signed-in account. Form-template changes must return only
 * through a reviewed, scoped administration workflow.
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
        "USOR96 template seeding is temporarily unavailable while security remediation is in progress.",
    },
    { status: 503 }
  );
});
