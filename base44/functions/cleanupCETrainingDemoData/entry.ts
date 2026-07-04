Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return Response.json(
      {
        ok: false,
        error: "This CE Training demo-cleanup request must use POST.",
      },
      { status: 405 }
    );
  }

  return Response.json(
    {
      ok: false,
      error:
        "CE Training demo cleanup is disabled during security remediation. Do not use this legacy route to delete cohorts, students, invitations, clients, or user records.",
    },
    { status: 403 }
  );
});
