Deno.serve((req) => {
  if (req.method !== "POST") {
    return Response.json(
      {
        success: false,
        error: "This legacy access-request approval route must use POST.",
      },
      { status: 405 }
    );
  }

  return Response.json(
    {
      success: false,
      error:
        "Access-request approval is disabled during security remediation. This app uses the verified staff invitation workflow and does not allow self-service access requests.",
    },
    { status: 410 }
  );
});
