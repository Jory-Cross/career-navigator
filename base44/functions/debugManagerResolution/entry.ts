Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return Response.json(
      {
        ok: false,
        error: "This cohort-manager diagnostic request must use POST.",
      },
      { status: 405 }
    );
  }

  return Response.json(
    {
      ok: false,
      error:
        "Cohort-manager diagnostics are disabled during security remediation. This legacy debug route could expose organization membership information.",
    },
    { status: 403 }
  );
});
