import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Entity automation trigger: IntakeSection created/updated
 * 
 * Checks if status changed to "in_progress", "completed", or "reviewed".
 * If so, calls extractVFPFromIntake to normalize intake data into VFP signals.
 */

Deno.serve(async (req) => {
  const logs = [];
  logs.push(`[onIntakeSectionCompleted] Function entered`);
  
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { event, data, old_data, changed_fields } = payload;
    
    logs.push(`[onIntakeSectionCompleted] Payload received: section_id=${data?.id}, client_id=${data?.client_id}, status=${data?.status}, changed_fields=${JSON.stringify(changed_fields)}`);
    console.log(logs.join('\n'));

    // Trigger on status change to in_progress, completed, or reviewed
    // (skip only assigned and not_started)
    const isProcessable = (changed_fields || []).includes('status') &&
      (data?.status === 'in_progress' || data?.status === 'completed' || data?.status === 'reviewed');

    logs.push(`[onIntakeSectionCompleted] isProcessable=${isProcessable}`);
    if (!isProcessable) {
      logs.push(`[onIntakeSectionCompleted] Skipped - not a processable event`);
      console.log(logs.join('\n'));
      return Response.json({ skipped: true, reason: 'Not a processable event', logs });
    }

    const { client_id } = data;
    if (!client_id) {
      logs.push(`[onIntakeSectionCompleted] Error: No client_id in intake section`);
      console.log(logs.join('\n'));
      return Response.json({ error: 'No client_id in intake section' }, { status: 400 });
    }

    // Create activity log for extraction start
    logs.push(`[onIntakeSectionCompleted] Calling extractVFPFromIntake for client_id=${client_id}`);
    console.log(logs.join('\n'));
    
    try {
      const result = await base44.functions.invoke('extractVFPFromIntake', {
        client_id,
      });

      logs.push(`[onIntakeSectionCompleted] extractVFPFromIntake completed successfully`);
      logs.push(`[onIntakeSectionCompleted] Result: status=${result.data?.status}, signals_extracted=${Object.keys(result.data?.extracted_signals || {}).length}`);
      
      // Log activity
      try {
        await base44.entities.Activity.create({
          client_id,
          activity_type: 'onboarding_step',
          title: 'VFP Extraction Started',
          description: `Extraction triggered from intake section ${data.id}. Status=${data.status}. Signals extracted: ${Object.keys(result.data?.extracted_signals || {}).length}`,
        });
      } catch (actErr) {
        logs.push(`[onIntakeSectionCompleted] Activity log failed: ${actErr.message}`);
      }
      
      console.log(logs.join('\n'));
      return Response.json({
        triggered: true,
        section_id: data.id,
        client_id,
        extraction_result: result.data,
        status: 'success',
        logs,
      });
    } catch (invokeErr) {
      logs.push(`[onIntakeSectionCompleted] ERROR calling extractVFPFromIntake: ${invokeErr.message}`);
      console.error(logs.join('\n'));
      return Response.json({ 
        error: `Extraction failed: ${invokeErr.message}`, 
        status: 500,
        logs 
      });
    }
  } catch (error) {
    logs.push(`[onIntakeSectionCompleted] FATAL ERROR: ${error.message}`);
    console.error(logs.join('\n'));
    return Response.json({ error: error.message, logs }, { status: 500 });
  }
});