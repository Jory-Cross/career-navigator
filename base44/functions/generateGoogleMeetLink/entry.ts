/**
 * Disabled during the security remediation freeze.
 *
 * This legacy route created Google Calendar events and Meet links using a
 * shared connector without canonical organization, meeting, or caller
 * authority. It must remain unavailable until a reviewed, scoped integration
 * workflow is approved.
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
        "Google Meet link creation is temporarily unavailable while security remediation is in progress.",
    },
    { status: 503 }
  );
});
