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
        "This legacy ReportFieldAnswer backfill route is disabled during security remediation. A scoped dry-run review is required before any data repair.",
    },
    { status: 403 }
  );
});
