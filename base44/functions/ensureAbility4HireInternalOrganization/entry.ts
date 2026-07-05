/**
 * Disabled during the security remediation freeze.
 *
 * The prior route could create an internal organization and reassign a hard-coded
 * user and client records across tenant boundaries. It has no active application
 * caller and must remain unavailable until a reviewed, auditable migration plan
 * is explicitly approved.
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
        "Internal organization migration is temporarily unavailable while security remediation is in progress.",
    },
    { status: 503 }
  );
});