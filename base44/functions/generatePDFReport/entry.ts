/**
 * Disabled during the security remediation freeze.
 *
 * This legacy endpoint accepted browser-assembled report data and generated
 * PDFs without the reviewed canonical client, organization, and template
 * authorization model. Reporting must return through a server-authorized
 * report workflow.
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
        "PDF report generation is temporarily unavailable while security remediation is in progress.",
    },
    { status: 503 }
  );
});
