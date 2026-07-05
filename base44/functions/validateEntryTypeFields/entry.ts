/**
 * Disabled during the security remediation freeze.
 *
 * This legacy configuration audit exposed shared EntryType and
 * ReportFieldTemplate records through a browser-session role check and carried
 * a dormant auto-deactivation path. Configuration audits must remain
 * unavailable until a reviewed, scoped workflow is approved.
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
        "Entry-type field diagnostics are temporarily unavailable while security remediation is in progress.",
    },
    { status: 503 }
  );
});
