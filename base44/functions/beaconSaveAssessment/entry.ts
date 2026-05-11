/**
 * beaconSaveAssessment
 *
 * Lightweight endpoint called via navigator.sendBeacon() on page unload.
 * Accepts a JSON blob and upserts the Assessment record.
 * No auth enforcement needed — the session token is passed in the body.
 *
 * Body shape:
 *   { recordId, clientId, assessmentType, responses, completedBy }
 */
import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => null);
    if (!body) return new Response("bad request", { status: 400 });

    const { recordId, clientId, assessmentType, responses, completedBy } = body;

    if (!clientId || !assessmentType || !responses) {
      return new Response("missing fields", { status: 400 });
    }

    // Check there is at least one non-empty response
    const hasAny = Object.values(responses).some(
      (v) => v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0)
    );
    if (!hasAny) return new Response("no data", { status: 204 });

    const base44 = createClientFromRequest(req);

    const payload = {
      client_id: clientId,
      assessment_type: assessmentType,
      status: "in_progress",
      responses,
      completed_by: completedBy || "",
    };

    if (recordId) {
      await base44.asServiceRole.entities.Assessment.update(recordId, payload);
    } else {
      await base44.asServiceRole.entities.Assessment.create(payload);
    }

    return new Response("ok", { status: 200 });
  } catch (err) {
    console.error("beaconSaveAssessment error:", err.message);
    return new Response("error", { status: 500 });
  }
});