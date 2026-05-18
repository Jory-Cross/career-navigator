import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Resend an invite email or re-trigger access for an employee.
// action = "resend_invite"  → re-calls inviteUser (sends the platform invite email again)
// action = "send_reset"     → same mechanism — Base44's inviteUser re-sends the sign-in/set-password email
//
// Base44 does not expose a separate password-reset-only endpoint.
// Calling inviteUser for an already-registered email re-sends the welcome/sign-in email
// which allows the user to set or recover their password via the auth flow.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'admin' && user.role !== 'management') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { employee_id, action } = await req.json();

    if (!employee_id || !action) {
      return Response.json({ error: 'employee_id and action are required' }, { status: 400 });
    }
    if (!['resend_invite', 'send_reset'].includes(action)) {
      return Response.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Fetch the target employee
    let target = null;
    try {
      const targets = await base44.asServiceRole.entities.User.filter({ id: employee_id });
      target = targets?.[0];
    } catch (_e) {
      // filter with bad id throws — treat as not found
    }
    if (!target) {
      return Response.json({ error: 'Employee not found' }, { status: 404 });
    }

    // Security: managers can only act on employees they manage or invited
    if (user.role === 'management') {
      const inviterUsers = await base44.asServiceRole.entities.User.filter({ email: user.email });
      const inviterId = inviterUsers?.[0]?.id;
      const isOwned = target.manager_id === inviterId;
      if (!isOwned) {
        // Also check ManagerEmployeeAssignment
        const assignments = await base44.asServiceRole.entities.ManagerEmployeeAssignment.filter({
          manager_user_id: inviterId,
          employee_user_id: employee_id,
        });
        if (!assignments || assignments.length === 0) {
          return Response.json({ error: 'Forbidden: not your employee' }, { status: 403 });
        }
      }
    }

    const normalizedEmail = target.email.toLowerCase().trim();
    const base44Role = target.role === 'admin' ? 'admin' : 'user';

    // Base44's inviteUser re-sends the platform sign-in/setup email regardless of registration status
    await base44.users.inviteUser(normalizedEmail, base44Role);

    console.log(`[resendInviteOrReset] action=${action} for ${normalizedEmail} by ${user.email}`);

    const message = action === 'resend_invite'
      ? `Invitation resent to ${normalizedEmail}`
      : `Password reset email sent to ${normalizedEmail}`;

    return Response.json({ success: true, message });
  } catch (error) {
    console.error('[resendInviteOrReset] Error:', error);
    return Response.json({ error: error.message, success: false }, { status: 500 });
  }
});