import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

const ONET_BASE_URL = "https://api-v2.onetcenter.org";

async function onetFetch(path, params, apiKey) {
  const url = new URL(`${ONET_BASE_URL}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    });
  }
  console.log("[syncOnetOccupations] GET", url.toString());
  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json", "X-API-Key": apiKey },
  });
  const text = await res.text();
  if (!res.ok) {
    console.error("[syncOnetOccupations] O*NET error", res.status, text.slice(0, 300));
    return null;
  }
  try { return JSON.parse(text); } catch { return null; }
}

// Job Zone number → title mapping
const JOB_ZONE_TITLES = {
  1: "Little or No Preparation Needed",
  2: "Some Preparation Needed",
  3: "Medium Preparation Needed",
  4: "Considerable Preparation Needed",
  5: "Extensive Preparation Needed",
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ success: false, error: "Forbidden: Admin access required" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const action = body.action || "preview"; // "preview" or "execute"
    const limit = Math.min(Number(body.limit) || 25, 500);
    const start = Number(body.start) || 1;

    const apiKey = Deno.env.get("ONET_API_KEY") || Deno.env.get("VITE_ONET_API_KEY");
    if (!apiKey) {
      console.error("[syncOnetOccupations] Missing ONET_API_KEY");
      return Response.json({ success: false, error: "Missing O*NET API key" }, { status: 500 });
    }

    console.log(`[syncOnetOccupations] action=${action} start=${start} limit=${limit}`);

    // ── Step 1: Fetch occupation list ─────────────────────────────────────
    const listData = await onetFetch("/occupations", { start, end: start + limit - 1 }, apiKey);
    if (!listData) {
      return Response.json({ success: false, error: "Failed to fetch occupation list from O*NET" }, { status: 500 });
    }

    const occupations = listData.occupation || [];
    console.log(`[syncOnetOccupations] Fetched ${occupations.length} occupations from list (total available: ${listData.total})`);

    const summary = {
      scanned: occupations.length,
      total_available: listData.total || 0,
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      failures: [],
      preview_mode: action === "preview",
    };

    if (action === "preview") {
      // Return first 10 as sample without writing anything
      const sample = occupations.slice(0, 10).map(o => ({
        onet_code: o.code,
        title: o.title,
      }));
      return Response.json({
        success: true,
        summary: { ...summary, note: "Preview mode — no records written." },
        sample,
      });
    }

    // ── Step 2: Load existing OnetOccupation records for dedup ────────────
    let existingMap = {};
    try {
      const existing = await base44.asServiceRole.entities.OnetOccupation.list();
      for (const rec of existing) {
        if (rec.onet_code) existingMap[rec.onet_code] = rec;
      }
      console.log(`[syncOnetOccupations] Loaded ${existing.length} existing OnetOccupation records`);
    } catch (e) {
      console.error("[syncOnetOccupations] Failed to load existing records:", e.message);
      return Response.json({ success: false, error: "Failed to load existing OnetOccupation records: " + e.message }, { status: 500 });
    }

    // ── Step 3: Enrich each occupation ────────────────────────────────────
    for (const occ of occupations) {
      const onet_code = occ.code;
      const title = occ.title;

      if (!onet_code || !title) {
        summary.skipped++;
        continue;
      }

      try {
        // Fetch occupation details for description + job zone
        const detailData = await onetFetch(`/occupations/${onet_code}`, {}, apiKey);
        const jobZoneData = await onetFetch(`/occupations/${onet_code}/details/job_zone`, {}, apiKey);

        // Description
        let description = null;
        if (detailData?.description) {
          description = detailData.description;
        }

        // Job Zone
        let job_zone = null;
        let job_zone_title = null;
        if (jobZoneData?.job_zone) {
          const zoneNum = Number(jobZoneData.job_zone);
          if (!isNaN(zoneNum)) {
            job_zone = zoneNum;
            job_zone_title = JOB_ZONE_TITLES[zoneNum] || null;
          }
        }

        // Bright Outlook
        let bright_outlook = false;
        if (detailData?.tags) {
          bright_outlook = Array.isArray(detailData.tags)
            ? detailData.tags.some(t => typeof t === "string" && t.toLowerCase().includes("bright_outlook"))
            : String(detailData.tags).toLowerCase().includes("bright_outlook");
        }

        // Green
        let green = false;
        if (detailData?.tags) {
          green = Array.isArray(detailData.tags)
            ? detailData.tags.some(t => typeof t === "string" && t.toLowerCase().includes("green"))
            : String(detailData.tags).toLowerCase().includes("green");
        }

        const payload = {
          onet_code,
          title,
          ...(description !== null && { description }),
          ...(job_zone !== null && { job_zone }),
          ...(job_zone_title !== null && { job_zone_title }),
          bright_outlook,
          green,
          last_verified_at: new Date().toISOString(),
          source: "onet",
        };

        const existing = existingMap[onet_code];

        if (existing) {
          await base44.asServiceRole.entities.OnetOccupation.update(existing.id, payload);
          summary.updated++;
          console.log(`[syncOnetOccupations] Updated: ${onet_code} ${title}`);
        } else {
          await base44.asServiceRole.entities.OnetOccupation.create(payload);
          summary.created++;
          console.log(`[syncOnetOccupations] Created: ${onet_code} ${title}`);
        }
      } catch (err) {
        const msg = err?.message || String(err);
        console.error(`[syncOnetOccupations] Failed for ${onet_code}: ${msg}`);
        summary.failed++;
        summary.failures.push({ onet_code, title, error: msg });
      }
    }

    console.log("[syncOnetOccupations] Done:", JSON.stringify(summary));
    return Response.json({ success: true, summary });

  } catch (error) {
    const message = error?.message || "Unexpected error";
    console.error("[syncOnetOccupations] Unexpected error:", message);
    return Response.json({ success: false, error: message }, { status: 500 });
  }
});