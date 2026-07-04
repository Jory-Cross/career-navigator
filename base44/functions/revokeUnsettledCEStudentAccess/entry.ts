import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return Response.json(
      {
        ok: false,
        error:
          "This CE access-remediation request must use POST.",
      },
      { status: 405 }
    );
  }

  const base44 = createClientFromRequest(req);
  const authenticatedUser = await base44.auth.me().catch(
    () => null
  );

  if (!authenticatedUser?.id) {
    return Response.json(
      {
        ok: false,
        error:
          "Please sign in before using CE access-remediation tools.",
      },
      { status: 401 }
    );
  }

  return Response.json(
    {
      ok: false,
      error:
        "This legacy CE access-cleanup function is disabled during security remediation. Do not change CE student access through email-based batch cleanup.",
    },
    { status: 410 }
  );
});
