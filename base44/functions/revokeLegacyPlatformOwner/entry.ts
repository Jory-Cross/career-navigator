Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return Response.json(
      { error: "This route accepts POST requests only." },
      { status: 405 }
    );
  }

  return Response.json(
    {
      error:
        "This legacy platform-owner repair route is disabled during security remediation.",
    },
    { status: 403 }
  );
});
