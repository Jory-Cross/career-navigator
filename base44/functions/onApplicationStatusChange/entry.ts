/**
 * Disabled during the security remediation freeze.
 *
 * The prior entity automation trusted event payload data and invoked an outbound
 * follow-up sender without an authenticated staff caller or canonical client
 * workspace authorization. Automatic interview follow-ups must remain disabled
 * until a reviewed, server-authorized workflow is implemented.
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

  return Response.json({
    ok: false,
    error:
      "Automatic interview follow-ups are temporarily unavailable while security remediation is in progress.",
  });
});