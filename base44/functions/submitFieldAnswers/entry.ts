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
        "This legacy field-answer submission route is disabled during security remediation. Use the authorized TimeEntry workflow instead.",
    },
    { status: 403 }
  );
});
