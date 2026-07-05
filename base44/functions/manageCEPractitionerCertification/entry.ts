/**
 * Disabled during the security remediation freeze.
 *
 * The prior route could create, verify, and revoke CE practitioner
 * certifications through a legacy PlatformAdmin authority check. Certification
 * mutations must remain unavailable until canonical Platform Owner validation
 * and complete audit safeguards are reviewed together.
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
        "CE practitioner certification administration is temporarily unavailable while security remediation is in progress.",
    },
    { status: 503 }
  );
});