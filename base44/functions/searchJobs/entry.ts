/**
 * Disabled during the security remediation freeze.
 *
 * This legacy route consumed a shared job-search API key with only a session
 * check, accepted arbitrary search input, and returned provider-derived data
 * outside a reviewed client-authorized job-search workflow.
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
        "Live job search is temporarily unavailable while security remediation is in progress.",
    },
    { status: 503 }
  );
});
