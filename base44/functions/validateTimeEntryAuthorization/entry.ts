Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return Response.json(
      { success: false, error: "This route accepts POST requests only." },
      { status: 405 }
    );
  }

  return Response.json({
    success: false,
    error: "This legacy TimeEntry authorization route is disabled during security remediation. Use the authorized TimeEntry workflow instead.",
  });
});
