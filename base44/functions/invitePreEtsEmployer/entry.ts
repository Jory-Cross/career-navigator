import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Invites a Pre-ETS Employer user — grants access ONLY to PreEtsEmployerPortal
// for a specific assigned Pre-ETS client record.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user || !['admin', 'management', 'employee'].includes(user.role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { email, clientId } = await req.json();

    if (!email) {
      return Response.json({ error: 'Email is required' }, { status: 400 });
    }
    if (!clientId) {
      return Response.json({ error: 'clientId is required — employer must be linked to a specific Pre-ETS client' }, { status: 400 });
    }

    // Verify the client exists and is a pre_ets type
    const clientRecords = await base44.asServiceRole.entities.Client.filter({ id: clientId });
    const client = clientRecords?.[0];
    if (!client) {
      return Response.json({ error: 'Client record not found' }, { status: 404 });
    }
    if (client.client_type !== 'pre_ets') {
      return Response.json({ error: 'Employer portal invitations can only be linked to Pre-ETS clients' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const now = new Date().toISOString();

    // Check if a User account already exists — if so, update in place (no duplicate)
    const existingUsers = await base44.asServiceRole.entities.User.filter({ email: normalizedEmail });
    if (existingUsers && existingUsers.length > 0) {
      const existingUser = existingUsers[0];
      console.log(`[invitePreEtsEmployer] User already exists for ${normalizedEmail} (id=${existingUser.id}), updating role in place.`);
      await base44.asServiceRole.entities.User.update(existingUser.id, {
        role: 'pre_ets_employer',
        access_level: 'pre_ets_employer_portal',
        org_id: user.org_id || null,
        linked_client_id: clientId,
      });
      await base44.asServiceRole.entities.Activity.create({
        client_id: clientId,
        org_id: user.org_id || null,
        activity_type: 'email_sent',
        title: 'Pre-ETS Employer portal access updated',
        description: `Existing account for ${normalizedEmail} updated with employer portal access by ${user.full_name || user.email}`,
      });
      return Response.json({ success: true, message: 'Existing account updated with employer portal access', linked_existing: true });
    }

    // Upsert PendingRoleAssignment — avoid duplicate pending entries
    const existing = await base44.asServiceRole.entities.PendingRoleAssignment.filter({ email: normalizedEmail });
    const existingForClient = (existing || []).find(p =>
      p.status === 'pending' && p.role === 'pre_ets_employer' && p.client_id === clientId
    );

    if (existingForClient) {
      console.log(`[invitePreEtsEmployer] Updating existing pending assignment ${existingForClient.id} for ${normalizedEmail}`);
      await base44.asServiceRole.entities.PendingRoleAssignment.update(existingForClient.id, {
        access_level: 'pre_ets_employer_portal',
        org_id: user.org_id || null,
        invited_by_id: user.id,
        invited_by_name: user.full_name || user.email,
        invited_at: now,
      });
    } else {
      // Remove any stale pending assignments for this email (different client/role)
      for (const old of (existing || [])) {
        await base44.asServiceRole.entities.PendingRoleAssignment.delete(old.id);
      }
      await base44.asServiceRole.entities.PendingRoleAssignment.create({
        email: normalizedEmail,
        role: 'pre_ets_employer',
        access_level: 'pre_ets_employer_portal',
        org_id: user.org_id || null,
        invited_by_id: user.id,
        invited_by_name: user.full_name || user.email,
        invited_at: now,
        client_id: clientId,
        status: 'pending',
      });
    }

    console.log(`[invitePreEtsEmployer] PendingRoleAssignment upserted: email=${normalizedEmail} role=pre_ets_employer client_id=${clientId}`);

    // Send the platform invitation email as "user" — onUserRegistered upgrades to correct role
    await base44.users.inviteUser(normalizedEmail, 'user');
    console.log(`[invitePreEtsEmployer] Invitation email sent to ${normalizedEmail}`);

    // Log activity on the client record
    await base44.asServiceRole.entities.Activity.create({
      client_id: clientId,
      org_id: user.org_id || null,
      activity_type: 'email_sent',
      title: 'Pre-ETS Employer portal invitation sent',
      description: `Employer portal access invitation sent to ${normalizedEmail} by ${user.full_name || user.email}`,
    });

    return Response.json({ success: true, message: 'Pre-ETS Employer invitation sent successfully' });
  } catch (error) {
    console.error('[invitePreEtsEmployer] error:', error);
    return Response.json({ error: error.message, success: false }, { status: 500 });
  }
});