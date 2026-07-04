Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return Response.json(
      {
        ok: false,
        error: "This portal-access repair request must use POST.",
      },
      { status: 405 }
    );
  }

  return Response.json(
    {
      ok: false,
      error:
        "Portal-access repair is disabled during security remediation. This legacy utility could modify access records outside the selected organization.",
    },
    { status: 403 }
  );
});
