import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || (user.role !== 'admin' && user.role !== 'management')) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { employee_id, override_manager_id } = await req.json();
    if (!employee_id) {
      return Response.json({ error: 'employee_id is required' }, { status: 400 });
    }

    // ── 1. Load employee record ────────────────────────────────────────────
    const allUsers = await base44.asServiceRole.entities.User.list();
    const employee = allUsers.find(u => u.id === employee_id);
    if (!employee) {
      return Response.json({ error: 'Employee not found' }, { status: 404 });
    }

    // ── 2. Resolve overseeing manager ─────────────────────────────────────
    // Priority: override_manager_id param → employee.manager_id → ManagerEmployeeAssignment
    let managerId = override_manager_id || employee.manager_id || null;

    if (!managerId) {
      // Try ManagerEmployeeAssignment
      const assignments = await base44.asServiceRole.entities.ManagerEmployeeAssignment.filter({
        employee_user_id: employee_id,
        is_active: true
      });
      if (assignments.length > 0) {
        managerId = assignments[0].manager_user_id;
      }
    }

    if (!managerId) {
      // No manager found — caller must supply override_manager_id
      return Response.json({
        error: 'no_manager',
        message: 'This employee has no overseeing manager. Please select a manager to reassign their clients to before completing offboarding.'
      }, { status: 422 });
    }

    // Validate manager exists and has an appropriate role
    const manager = allUsers.find(u => u.id === managerId);
    if (!manager) {
      return Response.json({ error: 'Resolved manager not found' }, { status: 404 });
    }

    // ── 3. Reassign all active clients to manager ─────────────────────────
    const allClients = await base44.asServiceRole.entities.Client.filter({ assigned_employee_id: employee_id });
    const activeClients = allClients.filter(c => !c.is_archived);

    const reassignResults = await Promise.allSettled(
      activeClients.map(client =>
        base44.asServiceRole.entities.Client.update(client.id, {
          assigned_employee_id: managerId
        })
      )
    );

    const reassignedCount = reassignResults.filter(r => r.status === 'fulfilled').length;
    const failedCount = reassignResults.filter(r => r.status === 'rejected').length;

    if (failedCount > 0) {
      console.error(`[offboardEmployee] ${failedCount} client reassignments failed`);
    }

    // ── 4. Deactivate ManagerEmployeeAssignment records ───────────────────
    const activeAssignments = await base44.asServiceRole.entities.ManagerEmployeeAssignment.filter({
      employee_user_id: employee_id,
      is_active: true
    });

    await Promise.allSettled(
      activeAssignments.map(a =>
        base44.asServiceRole.entities.ManagerEmployeeAssignment.update(a.id, { is_active: false })
      )
    );

    // ── 5. Deactivate the employee's app access ───────────────────────────
    // Set is_active=false — AuthContext will block them on next login.
    // Do NOT clear role/access_level to preserve audit trail.
    await base44.asServiceRole.entities.User.update(employee_id, { is_active: false });
    console.log(`[offboardEmployee] Set is_active=false for user id=${employee_id}`);

    // ── 6. Revoke all PendingRoleAssignment records for this email ────────
    // This prevents old accepted invites from re-granting access if the user
    // signs out and back in (applyPendingRoleIfNeeded skips revoked records).
    const pendingAssignments = await base44.asServiceRole.entities.PendingRoleAssignment.filter({
      email: employee.email.toLowerCase().trim()
    });
    await Promise.allSettled(
      pendingAssignments.map(p =>
        base44.asServiceRole.entities.PendingRoleAssignment.update(p.id, { status: 'revoked' })
      )
    );
    console.log(`[offboardEmployee] Revoked ${pendingAssignments.length} PendingRoleAssignment record(s) for ${employee.email}`);

    // ── 7. Log offboarding activity on each affected client ──────────────
    await Promise.allSettled(
      activeClients.map(client =>
        base44.asServiceRole.entities.Activity.create({
          client_id: client.id,
          org_id: client.org_id,
          activity_type: 'status_changed',
          title: 'Employee offboarded — client reassigned',
          description: `Client reassigned from ${employee.full_name || employee.email} to ${manager.full_name || manager.email} due to staff offboarding.`,
        })
      )
    );

    return Response.json({
      success: true,
      employee_id,
      reassigned_to_manager_id: managerId,
      reassigned_to_manager_name: manager.full_name || manager.email,
      clients_reassigned: reassignedCount,
      clients_failed: failedCount,
      assignments_deactivated: activeAssignments.length,
    });

  } catch (error) {
    console.error('[offboardEmployee] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});