/**
 * Disabled during the security remediation freeze.
 *
 * This legacy utility could create EntryType records and rewrite shared
 * ReportFieldTemplate validation and mapping configuration through a
 * browser-session role check. Form-definition maintenance must use a reviewed,
 * scoped workflow.
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
        "Report-template refinement is temporarily unavailable while security remediation is in progress.",
    },
    { status: 503 }
  );
});
