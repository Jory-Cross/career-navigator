/**
 * Disabled during the security remediation freeze.
 *
 * The prior route could create Stripe checkout sessions and send CE Training
 * instructions while relying on session role fields and a legacy organization
 * owner-email fallback. It has no active application caller and must remain
 * unavailable until a canonical, tenant-scoped resend workflow is reviewed.
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
        "CE Training instruction resend is temporarily unavailable while security remediation is in progress.",
    },
    { status: 503 }
  );
});
