/**
 * Disabled during the security remediation freeze.
 *
 * This legacy automation created Tasks and updated JobApplication records
 * across all organizations without a canonical scheduler, organization, or
 * caller boundary. Follow-up automation must return only through a reviewed,
 * tenant-scoped scheduled workflow.
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
        "Application follow-up automation is temporarily unavailable while security remediation is in progress.",
    },
    { status: 503 }
  );
});
