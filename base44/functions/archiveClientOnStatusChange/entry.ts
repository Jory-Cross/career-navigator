Deno.serve((req) => {
  if (req.method !== "POST") {
    return Response.json(
      {
        success: false,
        error: "This legacy client archive automation must use POST.",
      },
      { status: 405 }
    );
  }

  return Response.json(
    {
      success: false,
      error:
        "Automatic client archive processing is disabled during security remediation. Client archiving and portal-access changes must use the secured archive workflow.",
    },
    { status: 410 }
  );
});
