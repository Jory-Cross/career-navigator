/**
 * Disabled during the security remediation freeze.
 *
 * The prior route could create pricing schedules, pricing items, and an
 * organization subscription through a legacy platform-owner workflow. Billing
 * configuration changes are deferred until a reviewed, auditable lifecycle is
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
        "Pilot CE billing provisioning is temporarily unavailable while security remediation is in progress.",
    },
    { status: 503 }
  );
});