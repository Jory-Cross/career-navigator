/**
 * Disabled during the security remediation freeze.
 *
 * Client archive and portal-revocation changes are being consolidated into a
 * reviewed server-authorized lifecycle. The legacy route remains unavailable
 * until its complete assignment, rollback, and audit controls are revalidated.
 */
Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return Response.json(
      { success: false, error: "This route accepts POST requests only." },
      { status: 405 }
    );
  }

  return Response.json(
    {
      success: false,
      error:
        "Client archiving is temporarily unavailable while security remediation is in progress.",
    },
    { status: 503 }
  );
});
