/**
 * Disabled during the security remediation freeze.
 *
 * The prior route accepted a browser-provided client identifier and exposed raw
 * completed-assessment evidence through a debug response. It has no active
 * caller and must remain unavailable until a scoped diagnostic audit is
 * explicitly approved.
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
        "Vocational-theme evidence diagnostics are temporarily unavailable while security remediation is in progress.",
    },
    { status: 503 }
  );
});