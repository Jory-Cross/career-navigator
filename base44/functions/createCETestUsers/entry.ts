Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return Response.json(
      {
        ok: false,
        error: "This CE test-user request must use POST.",
      },
      { status: 405 }
    );
  }

  return Response.json(
    {
      ok: false,
      error:
        "CE test-user creation is disabled during security remediation. Use the verified staff invitation or CE student invitation, payment-settlement, registration, and enrollment workflow for test accounts.",
    },
    { status: 403 }
  );
});
