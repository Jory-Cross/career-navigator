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
        "Pre-ETS employer invitations are temporarily unavailable while security remediation is in progress.",
    },
    { status: 403 }
  );
});
