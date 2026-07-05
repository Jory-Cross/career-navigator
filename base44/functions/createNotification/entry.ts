/**
 * Disabled during the security remediation freeze.
 *
 * This legacy route created service-role Notification records from arbitrary
 * request content without canonical caller authorization. Notifications must
 * return only through a reviewed, server-authorized workflow.
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
        "Notification creation is temporarily unavailable while security remediation is in progress.",
    },
    { status: 503 }
  );
});
