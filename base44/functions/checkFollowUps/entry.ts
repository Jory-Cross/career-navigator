import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // This function should be called by a scheduled automation
    const applications = await base44.asServiceRole.entities.JobApplication.filter({
      follow_up_enabled: true
    });
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let followUpsCreated = 0;
    
    for (const app of applications) {
      if (!app.follow_up_cadence_days || !app.applied_date) continue;
      
      // Calculate when follow-up is due
      const appliedDate = new Date(app.applied_date);
      const lastFollowUp = app.last_follow_up_date ? new Date(app.last_follow_up_date) : appliedDate;
      
      const daysSinceLastAction = Math.floor((today - lastFollowUp) / (1000 * 60 * 60 * 24));
      
      if (daysSinceLastAction >= app.follow_up_cadence_days) {
        // Check if task already exists for today
        const existingTasks = await base44.asServiceRole.entities.Task.filter({
          client_ids: app.client_id,
          category: "follow_up",
          due_date: today.toISOString().split('T')[0]
        });
        
        const hasFollowUpTask = existingTasks.some(t => 
          t.description?.includes(app.company) && t.status !== 'completed'
        );
        
        if (!hasFollowUpTask) {
          // Create follow-up task
          await base44.asServiceRole.entities.Task.create({
            client_ids: [app.client_id],
            title: `Follow up: ${app.position} at ${app.company}`,
            description: `Follow up on your application for ${app.position} at ${app.company}. This is follow-up #${(app.follow_up_count || 0) + 1}.`,
            category: "follow_up",
            priority: "medium",
            due_date: today.toISOString().split('T')[0],
            status: "pending"
          });
          
          // Update application
          await base44.asServiceRole.entities.JobApplication.update(app.id, {
            last_follow_up_date: today.toISOString().split('T')[0],
            follow_up_count: (app.follow_up_count || 0) + 1
          });
          
          followUpsCreated++;
        }
      }
    }
    
    return Response.json({ 
      success: true, 
      followUpsCreated,
      message: `Created ${followUpsCreated} follow-up tasks` 
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});