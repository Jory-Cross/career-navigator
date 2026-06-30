import { createClientFromRequest } from "npm:@base44/sdk@0.8.23";

const PLATFORM_OWNER_ROLE = "platform_owner";
const INTERNAL_ORG_TENANT_KEY = "ABILITY4HIRE_INTERNAL";
const INTERNAL_ORG_NAME = "Ability4Hire Platform";
const INTERNAL_OWNER_EMAIL = "admin@ability4hire.com";
const TEST_CLIENT_IDS = [
  "6a3af0d1de7caa233ba24c40", // Test Client
  "6a332f852408a884208e6fb5", // test test
  "6a332f60292f496073fa9b5d", // test testing
  "6a0dc94249f9fbe63c3c17aa", // test test
  "6a3b5e0da40cf81b181d835f", // Riley Thompson Demo
  "6a3b5e0db57d1b34cfc781d8", // Casey Nguyen Demo
  "6a3b5e0d13302b6a94b11902", // Jordan Fields Demo
  "6a3b5e0c4313452938c66a7d", // Sarah Martinez Demo
  "6a3b3cfb62df6eea397c9e5f", // Riley Thompson Demo
  "6a3b3cfb7b6bc44271684a2e", // Casey Nguyen Demo
  "6a3b3cfbd054a78e4b214b44", // Jordan Fields Demo
  "6a3b3cfb19411611ffaf46a3", // Sarah Martinez Demo
  "6a3af4dc2f601f1d715acd8c", // Concurrent Test
  "6a3af3bacc42decbdad697c5", // Sequential Dup
];

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const currentUser = await base44.auth.me();

    if (!currentUser) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const apply = body.apply === true;

    const [
      allPlatformAdmins,
      allOrganizations,
      allUsers,
      allClients,
    ] = await Promise.all([
      base44.asServiceRole.entities.PlatformAdmin.list(),
      base44.asServiceRole.entities.Organization.list(),
      base44.asServiceRole.entities.User.list(),
      base44.asServiceRole.entities.Client.list(),
    ]);

    const activePlatformOwner = allPlatformAdmins.find(
      (record) =>
        record.user_id === currentUser.id &&
        record.platform_role === PLATFORM_OWNER_ROLE &&
        record.is_active !== false
    );

    if (!activePlatformOwner) {
      return Response.json(
        {
          error:
            "Active Platform Owner access is required to create the internal Ability4Hire workspace.",
        },
        { status: 403 }
      );
    }

    const internalOwner = allUsers.find(
      (user) => normalizeEmail(user.email) === INTERNAL_OWNER_EMAIL
    );

    if (!internalOwner) {
      return Response.json(
        {
          error: `No User record exists for ${INTERNAL_OWNER_EMAIL}.`,
        },
        { status: 404 }
      );
    }

    const testClient = allClients.find(
      (client) => client.id === TEST_CLIENT_ID
    );

    if (!testClient) {
      return Response.json(
        {
          error: `Test Client record ${TEST_CLIENT_ID} was not found.`,
        },
        { status: 404 }
      );
    }

    let internalOrganization = allOrganizations.find(
      (organization) =>
        organization.tenant_key === INTERNAL_ORG_TENANT_KEY
    );

    const preview = {
      preview_only: !apply,
      internal_organization: internalOrganization
        ? {
            exists: true,
            id: internalOrganization.id,
            name: internalOrganization.name,
            tenant_key: internalOrganization.tenant_key,
          }
        : {
            exists: false,
            name: INTERNAL_ORG_NAME,
            tenant_key: INTERNAL_ORG_TENANT_KEY,
          },
      internal_workspace_owner: {
        id: internalOwner.id,
        email: internalOwner.email,
        current_org_id: internalOwner.org_id || null,
      },
      test_client: {
        id: testClient.id,
        name:
          `${testClient.first_name || ""} ${testClient.last_name || ""}`.trim() ||
          "Test Client",
        current_org_id: testClient.org_id || null,
      },
      changes_to_apply: {
        create_internal_organization: !internalOrganization,
        assign_admin_to_internal_organization:
          internalOwner.org_id !== internalOrganization?.id,
        assign_test_client_to_internal_organization:
          testClient.org_id !== internalOrganization?.id,
      },
    };

    if (!apply) {
      return Response.json(preview);
    }

    if (!internalOrganization) {
      internalOrganization =
        await base44.asServiceRole.entities.Organization.create({
          name: INTERNAL_ORG_NAME,
          tenant_key: INTERNAL_ORG_TENANT_KEY,
          owner_email: INTERNAL_OWNER_EMAIL,
          industry: "Platform Operations",
          subscription_tier: "enterprise",
          subscription_status: "active",
          max_employees: 25,
          max_clients: 250,
          is_active: true,
        });
    }

    const updates = [];

    if (internalOwner.org_id !== internalOrganization.id) {
      await base44.asServiceRole.entities.User.update(internalOwner.id, {
        org_id: internalOrganization.id,
      });

      updates.push({
        type: "user",
        id: internalOwner.id,
        email: internalOwner.email,
        org_id: internalOrganization.id,
      });
    }

    if (testClient.org_id !== internalOrganization.id) {
      await base44.asServiceRole.entities.Client.update(testClient.id, {
        org_id: internalOrganization.id,
      });

      updates.push({
        type: "client",
        id: testClient.id,
        name:
          `${testClient.first_name || ""} ${testClient.last_name || ""}`.trim() ||
          "Test Client",
        org_id: internalOrganization.id,
      });
    }

    return Response.json({
      ...preview,
      preview_only: false,
      setup_complete: true,
      internal_organization: {
        id: internalOrganization.id,
        name: internalOrganization.name,
        tenant_key: internalOrganization.tenant_key,
      },
      updates,
      message:
        "Ability4Hire Platform is ready. admin@ability4hire.com can now use its own internal workspace and view Test Client through the normal Clients page.",
    });
  } catch (error) {
    console.error(
      "ensureAbility4HireInternalOrganization error:",
      error.message
    );

    return Response.json(
      {
        error:
          error.message ||
          "Unable to create the internal Ability4Hire workspace.",
      },
      { status: 500 }
    );
  }
});
