import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const payload = await req.json();

        const { data, old_data, event } = payload;

        if (event?.type !== 'update') {
            return Response.json({ message: 'Not an update event, skipping.' });
        }

        const newStatus = data?.status;
        const oldStatus = old_data?.status;

        // Archive if status changed to inactive or completed
        if ((newStatus === 'inactive' || newStatus === 'completed') && oldStatus !== newStatus) {
            await base44.asServiceRole.entities.Client.update(event.entity_id, { is_archived: true });
            console.log(`Client ${event.entity_id} archived due to status change to ${newStatus}`);
            return Response.json({ message: `Client archived.` });
        }

        // Unarchive if status changed back to active
        if (newStatus === 'active' && oldStatus !== 'active' && data?.is_archived) {
            await base44.asServiceRole.entities.Client.update(event.entity_id, { is_archived: false });
            console.log(`Client ${event.entity_id} unarchived due to status change to active`);
            return Response.json({ message: `Client unarchived.` });
        }

        return Response.json({ message: 'No action needed.' });
    } catch (error) {
        console.error('Error in archiveClientOnStatusChange:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});