/**
 * Disabled during the security remediation freeze.
 *
 * This legacy seeder created shared ReportFieldTemplate configuration using a
 * browser-session role check. TimeEntry configuration changes must remain
 * unavailable until a reviewed, canonical administration workflow is approved.
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
        "TimeEntry configuration seeding is temporarily unavailable while security remediation is in progress.",
    },
    { status: 503 }
  );
});
