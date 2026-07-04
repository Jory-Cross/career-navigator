import { createClientFromRequest } from "npm:@base44/sdk@0.8.23";

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isActive(record: any) {
  return record?.is_active !== false && record?.is_archived !== true;
}

function projectOrganization(organization: any) {
  return {
    id: normalizeText(organization?.id),
    name: normalizeText(organization?.name),
    subscription_status: normalizeText(organization?.subscription_status),
    subscription_tier: normalizeText(organization?.subscription_tier),
    is_active: organization?.is_active !== false,
  };
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json(
        { ok: false, error: "This request must use POST." },
        { status: 405 }
      );
    }

    await req.json().catch(() => ({}));

    const base44 = createClientFromRequest(req);
    const authenticatedUser = await base44.auth.me().catch(() => null);

    if (!authenticatedUser?.id) {
      return Response.json(
        { ok: false, error: "You must be signed in to load organization context." },
        { status: 401 }
      );
    }

    const caller = await base44.asServiceRole.entities.User.get(
      authenticatedUser.id
    ).catch(() => null);

    if (!caller || !isActive(caller)) {
      return Response.json(
        { ok: false, error: "Your account is inactive or unavailable." },
        { status: 403 }
      );
    }

    const organizationId = normalizeText(caller?.org_id);

    if (!organizationId) {
      return Response.json({ ok: true, organization: null });
    }

    const organization = await base44.asServiceRole.entities.Organization.get(
      organizationId
    ).catch(() => null);

    if (!organization || !isActive(organization)) {
      return Response.json(
        { ok: false, error: "Your organization is inactive or unavailable." },
        { status: 403 }
      );
    }

    return Response.json({
      ok: true,
      organization: projectOrganization(organization),
    });
  } catch (error: any) {
    console.error(
      "getAuthorizedOrganizationContext error:",
      error?.message || error
    );

    return Response.json(
      { ok: false, error: "Organization context could not be loaded." },
      { status: 500 }
    );
  }
});
