Deno.serve(() => {
  return Response.json(
    {
      ok: false,
      error:
        "This legacy assessment autosave endpoint has been retired. Assessments must be saved through authorized server workflows.",
    },
    { status: 410 }
  );
});
