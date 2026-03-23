import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { title, start_datetime, end_datetime, description, meeting_id } = await req.json();

    if (!title || !start_datetime) {
      return Response.json({ error: 'title and start_datetime are required' }, { status: 400 });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar');

    // Build end time (default 1 hour after start if not provided)
    const startISO = new Date(start_datetime).toISOString();
    const endISO = end_datetime
      ? new Date(end_datetime).toISOString()
      : new Date(new Date(start_datetime).getTime() + 60 * 60 * 1000).toISOString();

    const eventPayload = {
      summary: title,
      description: description || '',
      start: { dateTime: startISO },
      end: { dateTime: endISO },
      conferenceData: {
        createRequest: {
          requestId: `meet-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' }
        }
      }
    };

    const res = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(eventPayload)
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error('Google Calendar API error:', err);
      return Response.json({ error: 'Failed to create Google Calendar event', details: err }, { status: 500 });
    }

    const event = await res.json();
    const meetLink = event.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video')?.uri;
    const calendarEventId = event.id;

    // If a meeting_id was passed, update the meeting's location with the Meet link
    if (meeting_id && meetLink) {
      await base44.asServiceRole.entities.Meeting.update(meeting_id, {
        location: meetLink,
        google_calendar_event_id: calendarEventId
      });
    }

    console.log(`Created Google Meet event: ${calendarEventId}, link: ${meetLink}`);

    return Response.json({ meet_link: meetLink, calendar_event_id: calendarEventId });
  } catch (error) {
    console.error('generateGoogleMeetLink error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});