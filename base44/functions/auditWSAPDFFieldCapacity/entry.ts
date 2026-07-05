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
      error: "This diagnostic route is temporarily unavailable during security remediation.",
    },
    { status: 503 }
  );
});