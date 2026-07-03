Deno.serve(() => {
  return Response.json(
    {
      ok: false,
      error:
        "This legacy registration role processor has been retired. Pending-role activation must use the authenticated, user-specific login workflow.",
    },
    { status: 410 }
  );
});
