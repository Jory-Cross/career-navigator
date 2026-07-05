/**
 * Disabled during the security remediation freeze.
 *
 * The prior route accepted a browser-provided client identifier and used
 * service-role reads across Client, Assessment, Document, and InterviewSession
 * records without canonical caller, organization, and client-workspace
 * authorization. It must remain unavailable until a fully scoped replacement
 * is designed and reviewed.
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
        "WSA AI generation is temporarily unavailable while security remediation is in progress.",
    },
    { status: 503 }
  );
});