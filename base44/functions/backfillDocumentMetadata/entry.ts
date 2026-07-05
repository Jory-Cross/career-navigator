/**
 * Disabled during the security remediation freeze.
 *
 * The prior route enumerated and rewrote Document metadata across the platform
 * through a browser-session admin check. Historical document remediation must
 * use a reviewed, scoped migration plan and cannot run through this legacy
 * utility.
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
        "Document metadata backfill is temporarily unavailable while security remediation is in progress.",
    },
    { status: 503 }
  );
});