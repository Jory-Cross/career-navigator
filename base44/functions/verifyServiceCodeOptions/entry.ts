/**
 * Disabled during the security remediation freeze.
 *
 * This legacy diagnostic exposed shared ReportFieldTemplate service-code
 * configuration through a browser-session role check and did not require POST.
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
        "Service-code diagnostics are temporarily unavailable while security remediation is in progress.",
    },
    { status: 503 }
  );
});
