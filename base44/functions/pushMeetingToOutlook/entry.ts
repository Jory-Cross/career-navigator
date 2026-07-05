/**
 * Disabled during the security remediation freeze.
 *
 * This legacy route created or updated Outlook events through a shared
 * connector using a browser-provided meeting ID without canonical tenant or
 * meeting authority. Calendar synchronization must return only through a
 * reviewed, scoped integration workflow.
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
        "Outlook meeting synchronization is temporarily unavailable while security remediation is in progress.",
    },
    { status: 503 }
  );
});
