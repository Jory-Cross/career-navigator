import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const { userId, userEmail } = await req.json();

    // Check if there's a Client entity with this email
    const clients = await base44.asServiceRole.entities.Client.filter({ email: userEmail });
    
    if (clients && clients.length > 0) {
      // Update the user's role to 'client'
      await base44.asServiceRole.entities.User.update(userId, { role: 'client' });
      
      return Response.json({ 
        success: true,
        message: 'User role updated to client' 
      });
    }

    return Response.json({ 
      success: true,
      message: 'No matching client found, no action taken' 
    });
  } catch (error) {
    console.error('Error updating client role:', error);
    return Response.json({ 
      error: error.message,
      success: false 
    }, { status: 500 });
  }
});