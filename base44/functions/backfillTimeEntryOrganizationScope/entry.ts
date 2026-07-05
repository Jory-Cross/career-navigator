/**
 * Disabled during the security remediation freeze.
 *
 * Historical TimeEntry organization repair must not be applied through a
 * caller-controlled mutation route. Use auditTimeEntryOrganizationScope for
 * Platform Owner preview only; any repair requires a separately reviewed,
 * explicitly approved, deterministic migration plan.
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
        "TimeEntry organization repair is temporarily unavailable while security remediation is in progress.",
    },
    { status: 503 }
  );
});