import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user || !['admin', 'management', 'employee'].includes(user.role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { requestId, email, full_name, client_type, action } = await req.json();

    if (action === 'deny') {
      await base44.asServiceRole.entities.AccessRequest.update(requestId, { status: 'denied' });
      return Response.json({ success: true });
    }

    // Determine role
    const appRole = client_type === 'pre_ets' ? 'pre_ets' : client_type === 'dspd' ? 'dspd' : 'client';

    // Check if a client record already exists with this email
    const existingClients = await base44.asServiceRole.entities.Client.filter({ email });
    let clientId;

    if (existingClients && existingClients.length > 0) {
      // Link existing client - update assigned employee if not already assigned
      const existing = existingClients[0];
      const updateData = { status: 'active' };
      if (!existing.assigned_employee_id) {
        updateData.assigned_employee_id = user.id;
      }
      await base44.asServiceRole.entities.Client.update(existing.id, updateData);
      clientId = existing.id;
      console.log(`Linked existing client ${existing.id} for email ${email}`);
    } else {
      // Create new client record
      const nameParts = (full_name || '').trim().split(' ');
      const token = Math.random().toString(36).substring(2, 15);
      const client = await base44.asServiceRole.entities.Client.create({
        first_name: nameParts[0] || '',
        last_name: nameParts.slice(1).join(' ') || '',
        email,
        client_type: client_type || 'job_seeker',
        status: 'active',
        access_token: token,
        assigned_employee_id: user.id,
        onboarding_status: 'in_progress'
      });
      clientId = client.id;
      console.log(`Created new client ${clientId} for email ${email}`);
    }

    // Store pending role assignment (so it gets applied when they register)
    await base44.asServiceRole.entities.PendingRoleAssignment.create({ email, role: appRole });

    // Try to invite the user — may fail if non-admin caller or already registered; don't block on it
    try {
      await base44.users.inviteUser(email, 'user');
      console.log(`Invited ${email} to the app`);
    } catch (inviteErr) {
      console.warn(`Could not invite ${email} (may already be registered or insufficient permissions): ${inviteErr.message}`);
    }

    // Mark request as approved — always do this regardless of invite outcome
    await base44.asServiceRole.entities.AccessRequest.update(requestId, { status: 'approved' });

    // Log activity
    await base44.asServiceRole.entities.Activity.create({
      client_id: clientId,
      activity_type: 'email_sent',
      title: 'Access approved',
      description: `Access request from ${email} approved by ${user.full_name || user.email}`
    });

    return Response.json({ success: true, client_id: clientId });
  } catch (error) {
    console.error('approveAccessRequest error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});