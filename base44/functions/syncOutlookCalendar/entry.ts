Deno.serve(() => {
  return Response.json(
    {
      ok: false,
      error:
        "This legacy Outlook calendar sync endpoint has been retired pending a tenant-scoped Outlook integration.",
    },
    { status: 410 }
  );
});
