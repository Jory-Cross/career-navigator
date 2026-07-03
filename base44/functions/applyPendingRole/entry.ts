Deno.serve(() => {
  return Response.json(
    {
      ok: false,
      error:
        "This legacy global pending-role processor has been retired. Pending-role application must use the authenticated, user-specific workflow.",
    },
    { status: 410 }
  );
});
