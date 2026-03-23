import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // This should be called by automations or other backend functions
    const { title, message, type, related_client_id, related_entity_type, related_entity_id, action_url } = await req.json();
    
    if (!title || !message) {
      return Response.json({ error: 'title and message required' }, { status: 400 });
    }

    await base44.asServiceRole.entities.Notification.create({
      title,
      message,
      type: type || 'info',
      related_client_id,
      related_entity_type,
      related_entity_id,
      action_url,
      is_read: false
    });

    return Response.json({ success: true });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});