import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'admin' && user.role !== 'management' && user.role !== 'ce_instructor') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    let orgId = user.org_id || null;

    if (!orgId) {
      const orgs = await base44.asServiceRole.entities.Organization.filter({
        owner_email: user.email,
      });
      orgId = orgs[0]?.id || null;
    }

    // Use service role to list organization users while preserving frontend access control.
    const allUsers = await base44.asServiceRole.entities.User.list();
    const orgUsers = orgId
      ? allUsers.filter((orgUser) => orgUser.org_id === orgId)
      : [];

    // Separate active vs inactive so the UI can show them differently.
    const activeUsers = orgUsers.filter((orgUser) => orgUser.is_active !== false);
    const inactiveUsers = orgUsers.filter((orgUser) => orgUser.is_active === false);

    return Response.json({ users: activeUsers, inactive_users: inactiveUsers });
  } catch (error) {
    console.error('getOrgUsers error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
