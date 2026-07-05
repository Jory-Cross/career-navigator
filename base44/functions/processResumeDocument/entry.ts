/**
 * Disabled during the security remediation freeze.
 *
 * The prior route accepted a browser-provided document identifier, fetched the
 * referenced file, sent extracted content to AI, and updated the Document record
 * using service-role authority without canonical caller, organization, client,
 * or document-workspace authorization. It must remain unavailable until a fully
 * scoped replacement is designed and reviewed.
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
        "Resume document processing is temporarily unavailable while security remediation is in progress.",
    },
    { status: 503 }
  );
});