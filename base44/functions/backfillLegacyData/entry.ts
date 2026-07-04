Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return Response.json(
      { success: false, error: "This route accepts POST requests only." },
      { status: 405 }
    );
  }

  return Response.json({
    success: false,
    error:
      "This legacy bulk backfill route is disabled during security remediation. A scoped dry-run review is required before any data repair.",
  });
});
