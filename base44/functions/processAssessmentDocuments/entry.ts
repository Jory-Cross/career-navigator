/**
 * Disabled during the security remediation freeze.
 *
 * The prior route accepted a browser-provided client identifier and performed
 * broad service-role reads across Client, Document, and Assessment records.
 * It must remain unavailable until a fully organization-scoped replacement is
 * designed and reviewed.
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
        "Assessment-document processing is temporarily unavailable while security remediation is in progress.",
    },
    { status: 503 }
  );
});