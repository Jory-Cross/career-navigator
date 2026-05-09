import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Entity automation trigger: IntakeSection created/updated
 * 
 * Checks if status changed to "in_progress", "completed", or "reviewed".
 * If so, calls extractVFPFromIntake to normalize intake data into VFP signals.
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { event, data, old_data, changed_fields } = payload;

    // Trigger on status change to in_progress, completed, or reviewed
    // (skip only assigned and not_started)
    const isProcessable = (changed_fields || []).includes('status') &&
      (data?.status === 'in_progress' || data?.status === 'completed' || data?.status === 'reviewed');

    if (!isProcessable) {
      return Response.json({ skipped: true, reason: 'Not a processable event' });
    }

    const { client_id } = data;
    if (!client_id) {
      return Response.json({ error: 'No client_id in intake section' }, { status: 400 });
    }

    // Call the VFP extraction function
    const result = await base44.functions.invoke('extractVFPFromIntake', {
      client_id,
    });

    return Response.json({
      triggered: true,
      section_id: data.id,
      client_id,
      extraction_result: result,
      status: 'success',
    });
  } catch (error) {
    console.error('[onIntakeSectionCompleted]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});