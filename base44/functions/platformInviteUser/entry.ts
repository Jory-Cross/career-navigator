import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

function normalizeEmail(value: unknown) {
  return typeof value === "string"
    ? value.trim().toLowerCase()
    : "";
}

async function secureEquals(
  suppliedValue: string,
  expectedValue: string
) {
  const encoder = new TextEncoder();

  const [suppliedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest(
      "SHA-256",
      encoder.encode(suppliedValue)
    ),
    crypto.subtle.digest(
      "SHA-256",
      encoder.encode(expectedValue)
    ),
  ]);

  const suppliedBytes = new Uint8Array(suppliedHash);
  const expectedBytes = new Uint8Array(expectedHash);

  let difference = 0;

  for (let index = 0; index < suppliedBytes.length; index += 1) {
    difference |= suppliedBytes[index] ^ expectedBytes[index];
  }

  return difference === 0;
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json(
        {
          success: false,
          error: "Method not allowed.",
        },
        { status: 405 }
      );
    }

    const expectedInternalSecret =
      Deno.env.get("PLATFORM_INVITE_INTERNAL_SECRET") || "";

    if (!expectedInternalSecret) {
      console.error(
        "[platformInviteUser] PLATFORM_INVITE_INTERNAL_SECRET is not configured."
      );

      return Response.json(
        {
          success: false,
          error: "Platform invitation service is unavailable.",
        },
        { status: 503 }
      );
    }

    const requestBody = await req.json().catch(() => ({}));
    const normalizedEmail = normalizeEmail(requestBody?.email);
    const suppliedInternalSecret =
      typeof requestBody?.internal_secret === "string"
        ? requestBody.internal_secret
        : "";

    if (!normalizedEmail) {
      return Response.json(
        {
          success: false,
          error: "email is required.",
        },
        { status: 400 }
      );
    }

    if (
      !suppliedInternalSecret ||
      !(await secureEquals(
        suppliedInternalSecret,
        expectedInternalSecret
      ))
    ) {
      console.warn(
        "[platformInviteUser] Rejected an unauthorized invitation relay request."
      );

      return Response.json(
        {
          success: false,
          error: "Invitation relay access denied.",
        },
        { status: 403 }
      );
    }

    const base44 = createClientFromRequest(req);

    const inviteFn = base44.auth?.inviteUser
      ? base44.auth.inviteUser.bind(base44.auth)
      : base44.users?.inviteUser?.bind(base44.users);

    if (!inviteFn) {
      throw new Error(
        "inviteUser is not available on this SDK instance."
      );
    }

    const inviteResult = await inviteFn(normalizedEmail, "user");

    return Response.json({
      success: true,
      email: normalizedEmail,
      invite_result: inviteResult ?? null,
    });
  } catch (error: any) {
    console.error(
      "[platformInviteUser] Invitation relay failed:",
      error?.message || error
    );

    return Response.json(
      {
        success: false,
        error: "Platform invitation could not be sent.",
      },
      { status: 500 }
    );
  }
});
