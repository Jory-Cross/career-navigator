import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user || !['admin', 'management', 'employee'].includes(user.role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { email, clientId, clientType } = await req.json();

    if (!email) {
      return Response.json({ error: 'Email is required' }, { status: 400 });
    }

    const role = clientType === 'pre_ets' ? 'pre_ets' : clientType === 'dspd' ? 'dspd' : 'client';
    const access_level = 'client_portal';
    const now = new Date().toISOString();

    // Remove any stale pending assignments for this email
    const existing = await base44.asServiceRole.entities.PendingRoleAssignment.filter({ email });
    if (existing && existing.length > 0) {
      for (const old of existing) {
        await base44.asServiceRole.entities.PendingRoleAssignment.delete(old.id);
      }
    }

    // Create PendingRoleAssignment — onUserRegistered will apply role + access_level on signup
    await base44.asServiceRole.entities.PendingRoleAssignment.create({
      email,
      role,
      access_level,
      org_id: user.org_id || null,
      invited_by_id: user.id,
      invited_by_name: user.full_name || user.email,
      invited_at: now,
      client_id: clientId || null,
      status: 'pending',
    });

    console.log(`PendingRoleAssignment created: email=${email} role=${role} access_level=${access_level} client_id=${clientId}`);

    // Mark the client record as in_progress
    if (clientId) {
      await base44.asServiceRole.entities.Client.update(clientId, {
        onboarding_status: 'in_progress',
      });
    }

    // Send the platform invitation email as "user" — onUserRegistered upgrades to correct role
    await base44.users.inviteUser(email, 'user');
    console.log(`Invitation email sent to ${email}`);

    // Log activity on the client record
    if (clientId) {
      await base44.asServiceRole.entities.Activity.create({
        client_id: clientId,
        org_id: user.org_id || null,
        activity_type: 'email_sent',
        title: 'Portal invitation sent',
        description: `Portal access invitation sent to ${email} by ${user.full_name || user.email}`,
      });
    }

    return Response.json({ success: true, message: 'Invitation sent successfully' });
  } catch (error) {
    console.error('inviteClient error:', error);
    return Response.json({ error: error.message, success: false }, { status: 500 });
  }
});