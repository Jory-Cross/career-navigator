/**
 * Disabled during the security remediation freeze.
 *
 * This legacy relay accepted an internal secret in request content and could
 * issue arbitrary platform invitations outside the reviewed organization and
 * pending-role invitation workflows.
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
        "Platform invitation relay is temporarily unavailable while security remediation is in progress.",
    },
    { status: 503 }
  );
});
