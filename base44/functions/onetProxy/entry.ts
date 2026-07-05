/**
 * Disabled during the security remediation freeze.
 *
 * This legacy proxy allowed any signed-in account to select arbitrary O*NET
 * provider paths and parameters, while returning raw provider responses and
 * diagnostics. O*NET lookup must return only through a reviewed, bounded
 * server workflow.
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
        "O*NET lookup is temporarily unavailable while security remediation is in progress.",
    },
    { status: 503 }
  );
});
