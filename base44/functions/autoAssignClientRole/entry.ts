import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Triggered by entity automation on Client create.
// If the client's email already has a registered User, ensure they have role=client.
// Does NOT create PendingRoleAssignment — that is handled exclusively by inviteClient.
// Creating incomplete PendingRoleAssignments here was causing bad duplicates.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    const client = payload.data;
    if (!client?.email) {
      console.log('[autoAssignClientRole] No email on client record, skipping.');
      return Response.json({ skipped: true });
    }

    const email = client.email.toLowerCase().trim();

    // Check if user already exists and has wrong role
    const users = await base44.asServiceRole.entities.User.filter({ email });
    if (users.length > 0) {
      const existing = users[0];
      if (existing.role !== 'client') {
        await base44.asServiceRole.entities.User.update(existing.id, { role: 'client' });
        console.log(`[autoAssignClientRole] Updated role to 'client' for ${email}`);
      } else {
        console.log(`[autoAssignClientRole] User ${email} already has client role, no action needed.`);
      }
    } else {
      // User doesn't exist yet — do NOT create a PendingRoleAssignment here.
      // The proper invite flow (inviteClient function) handles that with all required fields.
      console.log(`[autoAssignClientRole] No user account found for ${email}. Skipping — use inviteClient to send a portal invitation.`);
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('[autoAssignClientRole] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});