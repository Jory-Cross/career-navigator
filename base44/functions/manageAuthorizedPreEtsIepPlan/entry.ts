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
        "This legacy Pre-ETS IEP route is disabled during security remediation. Use the authorized IEP workflow instead.",
    },
    { status: 403 }
  );
});
