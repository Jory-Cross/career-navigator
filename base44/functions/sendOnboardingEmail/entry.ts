/**
 * Disabled during the security remediation freeze.
 *
 * The prior route accepted a browser-provided client identifier and sent email
 * without canonical caller, organization, or client-workspace authorization.
 * It must remain unavailable until a fully scoped outbound-email workflow is
 * reviewed.
 */
Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return Response.json(
      {
        ok: false,
        success: false,
        error: "This route accepts POST requests only.",
      },
      { status: 405 }
    );
  }

  return Response.json(
    {
      ok: false,
      success: false,
      error:
        "Onboarding email is temporarily unavailable while security remediation is in progress.",
    },
    { status: 503 }
  );
});