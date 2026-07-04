Deno.serve((req) => {
  if (req.method !== "POST") {
    return Response.json(
      {
        success: false,
        error: "This legacy access-request route must use POST.",
      },
      { status: 405 }
    );
  }

  return Response.json(
    {
      success: false,
      error:
        "Access requests are disabled during security remediation. Staff access must be granted through the verified invitation workflow.",
    },
    { status: 410 }
  );
});
