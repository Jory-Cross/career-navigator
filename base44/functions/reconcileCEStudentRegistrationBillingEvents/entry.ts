/**
 * Retired security endpoint.
 *
 * This legacy bulk reconciliation path could create CE registration billing
 * records across an organization without the required invitation, cohort,
 * durable-enrollment, and controlled repair safeguards.
 *
 * CE billing repair must use a separately approved, tightly scoped
 * administrator repair workflow.
 */
Deno.serve(() => {
  return Response.json(
    {
      ok: false,
      error:
        "This legacy CE registration reconciliation endpoint has been retired. CE billing repairs require the controlled administrator repair workflow.",
    },
    { status: 410 }
  );
});
