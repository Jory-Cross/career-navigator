Deno.serve(() => {
  return Response.json(
    {
      ok: false,
      error:
        "This legacy automatic client-role processor has been retired. Client portal access must use the authorized invitation and authenticated activation workflow.",
    },
    { status: 410 }
  );
});
