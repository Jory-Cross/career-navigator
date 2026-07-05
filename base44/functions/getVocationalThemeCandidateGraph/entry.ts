/**
 * Disabled during the security remediation freeze.
 *
 * The prior route accepted browser-provided client and theme identifiers and
 * returned persisted discovery evidence without canonical tenant or client
 * authorization. It must remain unavailable until a scoped graph-read workflow
 * is reviewed.
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
        "Vocational evidence graphs are temporarily unavailable while security remediation is in progress.",
    },
    { status: 503 }
  );
});