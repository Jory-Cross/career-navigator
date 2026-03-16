import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    const client = payload.data;
    if (!client?.email) {
      console.log("No email on client record, skipping.");
      return Response.json({ skipped: true });
    }

    // Check if user already exists
    const users = await base44.asServiceRole.entities.User.filter({ email: client.email });
    if (users.length > 0) {
      const existing = users[0];
      if (existing.role !== 'client') {
        await base44.asServiceRole.entities.User.update(existing.id, { role: 'client' });
        console.log(`Updated role to 'client' for ${client.email}`);
      } else {
        console.log(`User ${client.email} already has client role`);
      }
    } else {
      await base44.users.inviteUser(client.email, 'client');
      console.log(`Invited ${client.email} as client`);
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("autoAssignClientRole error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});