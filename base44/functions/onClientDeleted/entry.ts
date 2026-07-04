Deno.serve((req) => {
  if (req.method !== "POST") {
    return Response.json(
      {
        success: false,
        error: "This legacy client-deletion automation must use POST.",
      },
      { status: 405 }
    );
  }

  return Response.json(
    {
      success: false,
      error:
        "Automatic client-deletion cleanup is disabled during security remediation. Client deletion and portal-access changes must use secured server-authorized workflows.",
    },
    { status: 410 }
  );
});
