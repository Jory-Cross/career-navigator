import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// This function exists solely to call base44.users.inviteUser() in a
// service-role / admin-privileged context. It must ONLY be called internally
// via base44.asServiceRole.functions.invoke('platformInviteUser', ...) from
// other backend functions — never directly from the frontend.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json();
    const { email } = body;

    if (!email) {
      return Response.json({ error: 'email is required' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    console.log(`[platformInviteUser] Attempting base44.users.inviteUser for ${normalizedEmail}`);

    // base44.users.inviteUser must run under a privileged context.
    // When invoked via asServiceRole.functions.invoke from another backend
    // function, this runs with app-owner-level privileges.
    // Try both SDK paths — base44.auth.inviteUser is the documented method
    const inviteFn = base44.auth?.inviteUser
      ? base44.auth.inviteUser.bind(base44.auth)
      : base44.users?.inviteUser?.bind(base44.users);

    if (!inviteFn) {
      throw new Error('inviteUser is not available on this SDK instance');
    }

    const result = await inviteFn(normalizedEmail, 'user');

    console.log(`[platformInviteUser] inviteUser returned:`, JSON.stringify(result ?? 'undefined (normal on success)'));

    return Response.json({
      success: true,
      email: normalizedEmail,
      invite_result: result ?? null,
    });

  } catch (error) {
    console.error(`[platformInviteUser] inviteUser threw:`, error?.message || String(error));
    return Response.json({
      success: false,
      error: error?.message || String(error),
    }, { status: 500 });
  }
});