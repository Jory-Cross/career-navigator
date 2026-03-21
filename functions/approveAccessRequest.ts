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

    // Approve: invite as client
    const nameParts = (full_name || '').trim().split(' ');
    const firstName = nameParts[0] || '';
    const appRole = client_type === 'pre_ets' ? 'pre_ets' : client_type === 'dspd' ? 'dspd' : 'client';

    // Create client record
    const token = Math.random().toString(36).substring(2, 15);
    const client = await base44.asServiceRole.entities.Client.create({
      first_name: firstName,
      last_name: nameParts.slice(1).join(' ') || '',
      email,
      client_type: client_type || 'job_seeker',
      status: 'active',
      access_token: token,
      assigned_employee_id: user.id,
      onboarding_status: 'in_progress'
    });

    // Invite the user - Base44 only accepts 'user' or 'admin', store intended role for auto-assignment
    await base44.users.inviteUser(email, 'user');

    // Store pending role so it gets applied when they register
    await base44.asServiceRole.entities.PendingRoleAssignment.create({ email, role: appRole });

    // Mark request as approved
    await base44.asServiceRole.entities.AccessRequest.update(requestId, { status: 'approved' });

    // Log activity
    await base44.asServiceRole.entities.Activity.create({
      client_id: client.id,
      activity_type: 'email_sent',
      title: 'Access approved',
      description: `Access request from ${email} approved by ${user.full_name || user.email}`
    });

    return Response.json({ success: true, client_id: client.id });
  } catch (error) {
    console.error('approveAccessRequest error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});