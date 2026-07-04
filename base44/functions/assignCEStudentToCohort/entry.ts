import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json(
        {
          ok: false,
          error:
            "This CE student-assignment request must use POST.",
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
            "Please sign in before managing CE cohort membership.",
        },
        { status: 401 }
      );
    }

    return Response.json(
      {
        ok: false,
        error:
          "This legacy direct CE student-assignment route is disabled during security remediation. CE Training membership may only be created through the verified invitation, payment settlement, registration, and durable enrollment workflow.",
      },
      { status: 409 }
    );
  } catch (error: unknown) {
    console.error(
      "[assignCEStudentToCohort] Unexpected error:",
      error instanceof Error ? error.message : error
    );

    return Response.json(
      {
        ok: false,
        error:
          "CE student cohort assignment could not be completed. Please try again or contact an organization administrator.",
      },
      { status: 500 }
    );
  }
});
