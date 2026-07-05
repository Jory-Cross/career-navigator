/**
 * Disabled during the security remediation freeze.
 *
 * The prior route accepted a browser-provided assessment identifier and used
 * service-role reads to export assessment and client data without canonical
 * caller, organization, client-workspace, or assessment authorization. It has
 * no active application caller and must remain unavailable until a fully scoped
 * export replacement is designed and reviewed.
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
        "Assessment PDF generation is temporarily unavailable while security remediation is in progress.",
    },
    { status: 503 }
  );
});