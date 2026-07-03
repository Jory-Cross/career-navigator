Deno.serve(() => {
  return Response.json(
    {
      ok: false,
      error:
        "This legacy endpoint has been retired. WBLE PDFs are generated only through the authorized Pre-ETS WBLE workflow.",
    },
    { status: 410 }
  );
});
