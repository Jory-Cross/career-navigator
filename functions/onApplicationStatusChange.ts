import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// This function is triggered by an entity automation on JobApplication update events.
// It auto-sends follow-up emails when status transitions to interview-related statuses.

const INTERVIEW_STATUSES = ['phone_screen', 'interview', 'final_round'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    const { event, data, old_data } = payload;

    // Only process update events
    if (event?.type !== 'update') {
      return Response.json({ skipped: true, reason: 'Not an update event' });
    }

    const newStatus = data?.status;
    const oldStatus = old_data?.status;

    // Only trigger when status changes TO an interview status
    if (!INTERVIEW_STATUSES.includes(newStatus) || newStatus === oldStatus) {
      return Response.json({ skipped: true, reason: 'Status not an interview trigger' });
    }

    const applicationId = event.entity_id;
    const clientId = data?.client_id;

    if (!applicationId || !clientId) {
      return Response.json({ skipped: true, reason: 'Missing IDs' });
    }

    console.log(`Triggering follow-up for application ${applicationId} — status changed to ${newStatus}`);

    // Invoke the follow-up email function
    const result = await base44.asServiceRole.functions.invoke('sendInterviewFollowUp', {
      applicationId,
      clientId,
      manual: false
    });

    return Response.json({ success: true, result: result?.data ?? null });

  } catch (error) {
    console.error('onApplicationStatusChange error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});