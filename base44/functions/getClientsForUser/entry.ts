import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Recursively collect all descendant user IDs under a given user
 * by traversing the manager_id tree.
 */
function getAllDescendantIds(userId, allUsers) {
  const directReports = allUsers.filter(u => u.manager_id === userId);
  if (directReports.length === 0) return [];
  const ids = directReports.map(u => u.id);
  for (const report of directReports) {
    ids.push(...getAllDescendantIds(report.id, allUsers));
  }
  return ids;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { org_id } = body;

    // Fetch all clients for the org using service role
    const allClients = org_id
      ? await base44.asServiceRole.entities.Client.filter({ org_id })
      : await base44.asServiceRole.entities.Client.list();

    // Admin sees everything
    if (user.role === 'admin') {
      return Response.json({ clients: allClients });
    }

    // Fetch all users to resolve hierarchy
    const allUsers = await base44.asServiceRole.entities.User.list();

    if (user.role === 'management') {
      // Get all descendants (direct + recursive) under this manager
      const descendantIds = getAllDescendantIds(user.id, allUsers);
      // Manager also sees their own directly assigned clients
      const visibleIds = new Set([user.id, ...descendantIds]);
      const filtered = allClients.filter(c => visibleIds.has(c.assigned_employee_id));
      return Response.json({ clients: filtered });
    }

    if (user.role === 'employee') {
      const filtered = allClients.filter(c => c.assigned_employee_id === user.id);
      return Response.json({ clients: filtered });
    }

    // Any other role: no access
    return Response.json({ clients: [] });

  } catch (error) {
    console.error('getClientsForUser error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});