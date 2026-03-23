import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        // Only admin or manager can assign clients
        if (!user || (user.role !== 'admin' && user.role !== 'management' && user.role !== 'manager')) {
            return Response.json({ error: 'Forbidden: Admin or manager access required' }, { status: 403 });
        }

        const { client_id, employee_id } = await req.json();

        if (!client_id || !employee_id) {
            return Response.json({ error: 'client_id and employee_id are required' }, { status: 400 });
        }

        // Verify employee exists and has appropriate role
        const employee = await base44.asServiceRole.entities.User.get(employee_id);
        if (!employee) {
            return Response.json({ error: 'Employee not found' }, { status: 404 });
        }

        if (employee.role === 'client') {
            return Response.json({ error: 'Cannot assign client to another client' }, { status: 400 });
        }

        // Update client with assigned employee
        const updatedClient = await base44.asServiceRole.entities.Client.update(client_id, {
            assigned_employee_id: employee_id
        });

        // Log activity
        await base44.asServiceRole.entities.Activity.create({
            client_id: client_id,
            activity_type: 'status_changed',
            title: 'Client assigned',
            description: `Client assigned to ${employee.full_name || employee.email}`
        });

        return Response.json({ 
            success: true, 
            client: updatedClient,
            assigned_to: employee.full_name || employee.email
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});