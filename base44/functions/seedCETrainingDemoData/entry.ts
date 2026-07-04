Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return Response.json(
      {
        ok: false,
        error: "This CE Training demo-seeding request must use POST.",
      },
      { status: 405 }
    );
  }

  return Response.json(
    {
      ok: false,
      error:
        "CE Training demo seeding is disabled during security remediation. Use the verified CE invitation, payment-settlement, registration, and enrollment workflow for any test records.",
    },
    { status: 403 }
  );
});
