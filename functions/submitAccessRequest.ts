import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { email, full_name, message, client_type } = await req.json();

    if (!email || !full_name) {
      return Response.json({ error: 'Email and name are required' }, { status: 400 });
    }

    // Use service role so unregistered users can submit requests
    const existing = await base44.asServiceRole.entities.AccessRequest.filter({ email, status: 'pending' });
    if (existing.length > 0) {
      return Response.json({ success: true, already_exists: true });
    }

    await base44.asServiceRole.entities.AccessRequest.create({
      email,
      full_name,
      message: message || '',
      client_type: client_type || 'job_seeker',
      status: 'pending'
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('submitAccessRequest error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});