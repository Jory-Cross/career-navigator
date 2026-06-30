import { createClientFromRequest } from "npm:@base44/sdk@0.8.23";

function normalize(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function getClientName(client: any) {
  return (
    `${client.first_name || ""} ${client.last_name || ""}`.trim() ||
    "Unnamed client"
  );
}

function belongsToMember(
  client: any,
  memberIds: Set<string>,
  memberEmails: Set<string>
) {
  const possibleUserIds = [
    client.assigned_employee_id,
    client.created_by_user_id,
  ];

  const possibleEmails = [
    client.created_by,
    client.created_by_email,
  ];

  return (
    possibleUserIds.some(
      (value) => typeof value === "string" && memberIds.has(value)
    ) ||
    possibleEmails.some((value) => memberEmails.has(normalize(value)))
  );
}

async function updateRecords(
  entity: any,
  records: any[],
  orgId: string
) {
  const updated: string[] = [];
  const failed: Array<{ id: string; error: string }> = [];

  for (const record of records) {
    try {
      await entity.update(record.id, { org_id: orgId });
      updated.push(record.id);
    } catch (error: any) {
      failed.push({
        id: record.id,
        error: error?.message || "Unknown update error",
      });
    }
  }

  return { updated, failed };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const platformAdminRecords =
      await base44.asServiceRole.entities.PlatformAdmin.list();

    const platformOwnerRecord = platformAdminRecords.find(
      (record: any) =>
        record.user_id === user.id &&
        record.platform_role === "platform_owner" &&
        record.is_active !== false
    );

    if (!platformOwnerRecord) {
      return Response.json(
        { error: "Only an active Platform Owner can run organization repairs." },
        { status: 403 }
      );
    }

    const body: any = await req.json().catch(() => ({}));

    const organizationId =
      typeof body.organization_id === "string"
        ? body.organization_id.trim()
        : "";

    const memberEmailDomain = normalize(body.member_email_domain).replace(
      /^@/,
      ""
    );

    const additionalMemberEmails = Array.isArray(
      body.additional_member_emails
    )
      ? body.additional_member_emails.map(normalize).filter(Boolean)
      : [];

    const additionalClientIds = Array.isArray(
      body.additional_client_ids
    )
      ? body.additional_client_ids.filter(
          (clientId: unknown) =>
            typeof clientId === "string" && clientId.trim()
        )
      : [];

    const apply = body.apply === true;

    if (!organizationId) {
      return Response.json(
        { error: "organization_id is required." },
        { status: 400 }
      );
    }

    if (!memberEmailDomain || !memberEmailDomain.includes(".")) {
      return Response.json(
        {
          error:
            "member_email_domain must be a valid domain such as comop.org.",
        },
        { status: 400 }
      );
    }

    const [allOrganizations, allUsers, allClients] = await Promise.all([
      base44.asServiceRole.entities.Organization.list(),
      base44.asServiceRole.entities.User.list(),
      base44.asServiceRole.entities.Client.list("-created_date"),
    ]);

    const organization = allOrganizations.find(
      (record: any) => record.id === organizationId
    );

    if (!organization) {
      return Response.json(
        { error: "The requested organization_id does not exist." },
        { status: 404 }
      );
    }

    const domainSuffix = `@${memberEmailDomain}`;

    const domainUsers = allUsers.filter((member: any) => {
      const memberEmail = normalize(member.email);

      return (
        memberEmail.endsWith(domainSuffix) ||
        additionalMemberEmails.includes(memberEmail)
      );
    });

    const conflictingUsers = domainUsers.filter(
      (member: any) =>
        member.org_id && member.org_id !== organizationId
    );

    if (conflictingUsers.length > 0) {
      return Response.json(
        {
          error:
            "Repair stopped because one or more matching users already belong to another organization.",
          conflicting_users: conflictingUsers.map((member: any) => ({
            id: member.id,
            email: member.email || null,
            current_org_id: member.org_id || null,
          })),
        },
        { status: 409 }
      );
    }

    const membersToScope = domainUsers.filter(
      (member: any) => member.org_id !== organizationId
    );

    const memberIds = new Set<string>(
      domainUsers.map((member: any) => member.id).filter(Boolean)
    );

    const memberEmails = new Set<string>(
      domainUsers
        .map((member: any) => normalize(member.email))
        .filter(Boolean)
    );

    const clientsToScope = allClients.filter((client: any) => {
      if (client.org_id === organizationId) {
        return false;
      }

      if (client.org_id && client.org_id !== organizationId) {
        return false;
      }

      return (
        additionalClientIds.includes(client.id) ||
        belongsToMember(client, memberIds, memberEmails)
      );
    });

    const unscopedClientsNotTouched = allClients.filter(
      (client: any) =>
        !client.org_id &&
        !clientsToScope.some(
          (candidate: any) => candidate.id === client.id
        )
    );

    const preview = {
      preview_only: !apply,
      organization: {
        id: organization.id,
        name:
          organization.name ||
          organization.organization_name ||
          "Organization",
        owner_email: organization.owner_email || null,
      },
      member_email_domain: memberEmailDomain,
      additional_member_emails: additionalMemberEmails,
      additional_client_ids: additionalClientIds,
      counts: {
        users_to_scope: membersToScope.length,
        clients_to_scope: clientsToScope.length,
        already_scoped_clients: allClients.filter(
          (client: any) => client.org_id === organizationId
        ).length,
        unscoped_clients_not_touched:
          unscopedClientsNotTouched.length,
      },
      users_to_scope: membersToScope.map((member: any) => ({
        id: member.id,
        email: member.email || null,
        role: member.role || null,
        current_org_id: member.org_id || null,
      })),
      sample_clients_to_scope: clientsToScope.slice(0, 25).map(
        (client: any) => ({
          id: client.id,
          name: getClientName(client),
          assigned_employee_id: client.assigned_employee_id || null,
          created_by: client.created_by || null,
          current_org_id: client.org_id || null,
        })
      ),
      sample_unscoped_clients_not_touched: unscopedClientsNotTouched
        .slice(0, 25)
        .map((client: any) => ({
          id: client.id,
          name: getClientName(client),
          assigned_employee_id: client.assigned_employee_id || null,
          created_by: client.created_by || null,
        })),
    };

    if (!apply) {
      return Response.json(preview);
    }

    const [userRepair, clientRepair] = await Promise.all([
      updateRecords(
        base44.asServiceRole.entities.User,
        membersToScope,
        organizationId
      ),
      updateRecords(
        base44.asServiceRole.entities.Client,
        clientsToScope,
        organizationId
      ),
    ]);

    return Response.json({
      ...preview,
      preview_only: false,
      repair_complete: true,
      repaired: {
        users: userRepair.updated.length,
        clients: clientRepair.updated.length,
      },
      failed: {
        users: userRepair.failed,
        clients: clientRepair.failed,
      },
    });
  } catch (error: any) {
    console.error(
      "backfillClientOrganizationScope error:",
      error?.message
    );

    return Response.json(
      {
        error:
          error?.message || "Organization repair failed.",
      },
      { status: 500 }
    );
  }
});
