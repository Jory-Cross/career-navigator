Deno.serve(() => {
  return Response.json(
    {
      ok: false,
      error:
        "This legacy endpoint has been retired. Training Progress Report PDFs are generated only through authorized Pre-ETS workflows.",
    },
    { status: 410 }
  );
});
