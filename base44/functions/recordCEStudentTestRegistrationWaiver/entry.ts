/**
 * Disabled during the security remediation freeze.
 *
 * The prior route created CE registration billing waivers across tenant data.
 * It has no active application caller and must remain unavailable until a
 * reviewed, canonical platform-governance workflow is explicitly approved.
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
        "CE test registration waivers are temporarily unavailable while security remediation is in progress.",
    },
    { status: 503 }
  );
});