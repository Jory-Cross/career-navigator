/**
 * Disabled during the security remediation freeze.
 *
 * This legacy route could publish public LinkedIn content through a shared
 * connector with only a browser-session check and no canonical organization
 * authority. Social publishing must return only through a reviewed, scoped
 * integration workflow.
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
        "LinkedIn publishing is temporarily unavailable while security remediation is in progress.",
    },
    { status: 503 }
  );
});
