import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { meeting_id } = await req.json();
    if (!meeting_id) {
      return Response.json({ error: "meeting_id is required" }, { status: 400 });
    }

    // Get the meeting from DB
    const meetings = await base44.asServiceRole.entities.Meeting.filter({ id: meeting_id });
    const meeting = meetings[0];
    if (!meeting) {
      return Response.json({ error: "Meeting not found" }, { status: 404 });
    }

    // Get Outlook access token
    const { accessToken } = await base44.asServiceRole.connectors.getConnection("outlook");

    const eventBody = {
      subject: meeting.title,
      body: {
        contentType: "Text",
        content: meeting.description || ""
      },
      start: {
        dateTime: meeting.start_datetime,
        timeZone: "UTC"
      },
      end: {
        dateTime: meeting.end_datetime || meeting.start_datetime,
        timeZone: "UTC"
      },
      location: {
        displayName: meeting.location || ""
      }
    };

    let response;
    let outlookEventId = meeting.outlook_event_id;

    if (outlookEventId) {
      // Update existing Outlook event
      response = await fetch(
        `https://graph.microsoft.com/v1.0/me/events/${outlookEventId}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(eventBody)
        }
      );
    } else {
      // Create new Outlook event
      response = await fetch(
        `https://graph.microsoft.com/v1.0/me/events`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(eventBody)
        }
      );
    }

    if (!response.ok) {
      const err = await response.text();
      console.error("Graph API error:", err);
      return Response.json({ error: "Failed to push to Outlook", details: err }, { status: 500 });
    }

    const outlookEvent = await response.json();
    outlookEventId = outlookEvent.id;

    // Save the outlook_event_id back to the meeting
    await base44.asServiceRole.entities.Meeting.update(meeting.id, {
      outlook_event_id: outlookEventId
    });

    console.log(`Meeting ${meeting.id} pushed to Outlook as event ${outlookEventId}`);
    return Response.json({ success: true, outlook_event_id: outlookEventId });

  } catch (error) {
    console.error("pushMeetingToOutlook error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});