import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// One-shot admin utility: directly patch access_level and linked_client_id on a user by ID.
// Requires caller to be admin.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { userId, access_level, linked_client_id, org_id } = await req.json();
    if (!userId || !access_level) {
      return Response.json({ error: 'userId and access_level required' }, { status: 400 });
    }

    const updateData = { access_level };
    if (linked_client_id) updateData.linked_client_id = linked_client_id;
    if (org_id) updateData.org_id = org_id;

    await base44.asServiceRole.entities.User.update(userId, updateData);
    console.log(`[patchUserAccessLevel] Patched ${userId}:`, updateData);

    return Response.json({ success: true, applied: updateData });
  } catch (error) {
    console.error('[patchUserAccessLevel] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});