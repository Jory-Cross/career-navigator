/**
 * Disabled during the security remediation freeze.
 *
 * This legacy repair route accepted caller-controlled organization, email-domain,
 * and client inputs, then changed User and Client tenant assignments. Any future
 * migration must be separately designed, previewed, reviewed, and explicitly
 * approved before records are changed.
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
        "Client organization repair is temporarily unavailable while security remediation is in progress.",
    },
    { status: 503 }
  );
});