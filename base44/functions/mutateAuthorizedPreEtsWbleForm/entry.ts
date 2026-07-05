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
        "Pre-ETS WBLE management is temporarily unavailable while security remediation is in progress.",
    },
    { status: 403 }
  );
});
