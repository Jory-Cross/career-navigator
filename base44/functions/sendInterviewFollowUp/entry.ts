/**
 * Disabled during the security remediation freeze.
 *
 * The prior route could generate and send external email, create tasks, and
 * update JobApplication records while relying on non-canonical staff checks
 * and legacy client ownership fallbacks. It has no direct user-interface caller
 * and must remain unavailable until a fully scoped, reviewed workflow exists.
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
        "Interview follow-up processing is temporarily unavailable while security remediation is in progress.",
    },
    { status: 503 }
  );
});