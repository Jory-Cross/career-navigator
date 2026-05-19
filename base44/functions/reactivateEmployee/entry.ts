import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admin or management can reactivate
    if (!['admin', 'management'].includes(user.role)) {
      return Response.json({ error: 'Forbidden: Admin/Management access required' }, { status: 403 });
    }

    const { employee_id, manager_id } = await req.json();

    if (!employee_id) {
      return Response.json({ error: 'employee_id required' }, { status: 400 });
    }

    // Fetch the employee
    const employees = await base44.asServiceRole.entities.User.filter({ id: employee_id });
    if (employees.length === 0) {
      return Response.json({ error: 'Employee not found' }, { status: 404 });
    }

    const employee = employees[0];
    const employeeData = employee.data || {};

    // Reactivate: set is_active=true, access_level=staff
    const updatePayload = {
      data: {
        ...employeeData,
        is_active: true,
        access_level: 'staff'
      }
    };

    await base44.asServiceRole.entities.User.update(employee_id, updatePayload);

    // Create/reactivate manager assignment if manager_id provided
    let managerAssignmentCreated = false;
    if (manager_id) {
      // Check if assignment already exists and is inactive
      const existingAssignments = await base44.asServiceRole.entities.ManagerEmployeeAssignment.filter({
        manager_user_id: manager_id,
        employee_user_id: employee_id
      });

      if (existingAssignments.length > 0) {
        // Reactivate existing
        await base44.asServiceRole.entities.ManagerEmployeeAssignment.update(existingAssignments[0].id, {
          is_active: true
        });
      } else {
        // Create new assignment
        await base44.asServiceRole.entities.ManagerEmployeeAssignment.create({
          manager_user_id: manager_id,
          employee_user_id: employee_id,
          is_active: true,
          org_id: employeeData.org_id
        });
      }
      managerAssignmentCreated = true;
    }

    // Create Activity log if available
    try {
      const clients = await base44.asServiceRole.entities.Client.filter({
        assigned_employee_id: employee_id
      });

      for (const client of clients) {
        await base44.asServiceRole.entities.Activity.create({
          org_id: employeeData.org_id,
          client_id: client.id,
          activity_type: 'status_changed',
          title: 'Employee Reactivated',
          description: `Employee ${employee.full_name} (${employee.email}) was reactivated${manager_id ? ' and assigned to a manager' : ''}.`,
          metadata: {
            related_entity_id: employee_id,
            related_entity_type: 'User',
            old_value: 'deactivated',
            new_value: 'active'
          }
        });
      }
    } catch (e) {
      // Activity logging failed, but reactivation succeeded
      console.warn('Activity log creation failed:', e.message);
    }

    return Response.json({
      success: true,
      employee_id,
      employee_name: employee.full_name,
      email: employee.email,
      manager_assigned: managerAssignmentCreated,
      manager_id: manager_id || null
    });
  } catch (error) {
    console.error('Reactivation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});