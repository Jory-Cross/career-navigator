/**
 * Disabled during the security remediation freeze.
 *
 * This legacy diagnostic exposed WSA template internals to any signed-in
 * account and did not enforce a method or canonical authority boundary.
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
        "WSA field diagnostics are temporarily unavailable while security remediation is in progress.",
    },
    { status: 503 }
  );
});
