/**
 * Disabled during the security remediation freeze.
 *
 * This legacy route used a shared O*NET API key with only a session check,
 * lacked a POST boundary, and returned raw provider diagnostics. O*NET lookup
 * must return only through a reviewed, bounded server workflow.
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
        "O*NET career search is temporarily unavailable while security remediation is in progress.",
    },
    { status: 503 }
  );
});
