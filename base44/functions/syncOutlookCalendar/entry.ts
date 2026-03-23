import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Get Outlook access token
    const { accessToken } = await base44.asServiceRole.connectors.getConnection("outlook");

    // Fetch Outlook calendar events for the next 60 days
    const now = new Date();
    const future = new Date();
    future.setDate(future.getDate() + 60);

    const startISO = now.toISOString();
    const endISO = future.toISOString();

    const graphRes = await fetch(
      `https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=${startISO}&endDateTime=${endISO}&$top=100&$select=id,subject,bodyPreview,start,end,location,onlineMeetingUrl`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        }
      }
    );

    if (!graphRes.ok) {
      const err = await graphRes.text();
      console.error("Graph API error:", err);
      return Response.json({ error: "Failed to fetch Outlook events", details: err }, { status: 500 });
    }

    const { value: outlookEvents } = await graphRes.json();
    console.log(`Fetched ${outlookEvents.length} Outlook events`);

    // Get existing meetings from the app
    const existingMeetings = await base44.asServiceRole.entities.Meeting.list();

    // Build a map of outlook_event_id -> existing meeting
    const existingByOutlookId = {};
    for (const m of existingMeetings) {
      if (m.outlook_event_id) {
        existingByOutlookId[m.outlook_event_id] = m;
      }
    }

    let created = 0;
    let updated = 0;

    for (const event of outlookEvents) {
      const startDt = event.start?.dateTime
        ? new Date(event.start.dateTime + (event.start.dateTime.endsWith('Z') ? '' : 'Z')).toISOString()
        : null;
      const endDt = event.end?.dateTime
        ? new Date(event.end.dateTime + (event.end.dateTime.endsWith('Z') ? '' : 'Z')).toISOString()
        : null;

      const meetingData = {
        title: event.subject || "(No Title)",
        description: event.bodyPreview || "",
        start_datetime: startDt,
        end_datetime: endDt,
        location: event.location?.displayName || event.onlineMeetingUrl || "",
        status: "scheduled",
        outlook_event_id: event.id
      };

      if (existingByOutlookId[event.id]) {
        // Update existing
        await base44.asServiceRole.entities.Meeting.update(existingByOutlookId[event.id].id, meetingData);
        updated++;
      } else {
        // Create new
        await base44.asServiceRole.entities.Meeting.create(meetingData);
        created++;
      }
    }

    console.log(`Sync complete: ${created} created, ${updated} updated`);
    return Response.json({ success: true, created, updated, total: outlookEvents.length });

  } catch (error) {
    console.error("syncOutlookCalendar error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});