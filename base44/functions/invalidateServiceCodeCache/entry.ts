/**
 * Disabled during the security remediation freeze.
 *
 * The prior "cache" route rewrote shared ReportFieldTemplate options and was
 * callable through an event-triggered path using only a browser-session role
 * check. Service-code configuration changes are frozen until a reviewed,
 * scoped configuration workflow is approved.
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
        "Service-code cache refresh is temporarily unavailable while security remediation is in progress.",
    },
    { status: 503 }
  );
});