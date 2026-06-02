import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

const ONET_BASE_URL = "https://api-v2.onetcenter.org";

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

    if (!user) {
      return Response.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (user.role !== "admin") {
      return Response.json(
        { success: false, error: "Admin access required" },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action || "diagnose";
    const start = Number(body.start || 1);
    const limit = Math.min(Number(body.limit || 25), 100);
    const end = start + limit - 1;

    const apiKey =
      Deno.env.get("ONET_API_KEY") ||
      Deno.env.get("VITE_ONET_API_KEY");

    if (!apiKey) {
      return Response.json(
        { success: false, error: "Missing O*NET API key" },
        { status: 500 }
      );
    }

    if (!["diagnose", "preview", "execute"].includes(action)) {
      return Response.json(
        {
          success: false,
          error: "Invalid action. Use diagnose, preview, or execute.",
        },
        { status: 400 }
      );
    }

    const listData = await onetFetch(apiKey, "/online/occupations", {
      start,
      end,
    });

    const occupations = normalizeOccupations(listData);

    if (action === "diagnose") {
      return Response.json({
        success: true,
        action,
        endpoint_tested: "/online/occupations",
        start,
        end,
        total_available: listData?.total || null,
        raw_keys: listData && typeof listData === "object"
          ? Object.keys(listData)
          : [],
        occupation_count: occupations.length,
        sample: occupations.slice(0, 10).map((occupation) => ({
          onet_code: occupation.code,
          title: occupation.title,
          raw_keys: Object.keys(occupation || {}),
        })),
        note: "Diagnose only. No records written and no detail/job-zone endpoints called.",
      });
    }

    const existingRecords =
      await base44.asServiceRole.entities.OnetOccupation.list();

    const existingByCode = new Map();

    for (const record of existingRecords || []) {
      if (record?.onet_code) {
        existingByCode.set(record.onet_code, record);
      }
    }

    const summary = {
      action,
      endpoint_used: "/online/occupations",
      start,
      end,
      total_available: listData?.total || null,
      scanned: occupations.length,
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      failures: [],
      sample: [],
    };

    for (const occupation of occupations) {
      const onet_code = occupation?.code || occupation?.onet_code;
      const title = occupation?.title || occupation?.name;

      if (!onet_code || !title) {
        summary.skipped++;
        continue;
      }

      try {
        const detailData = await onetFetch(
          apiKey,
          `/online/occupations/${onet_code}`,
          {}
        );

        const jobZoneData = await onetFetch(
          apiKey,
          `/online/occupations/${onet_code}/summary/job_zone`,
          {}
        );

        const jobZoneNumber = getJobZoneNumber(jobZoneData);
        const payload = {
          onet_code,
          title,
          description: getDescription(detailData),
          job_zone: jobZoneNumber,
          job_zone_title:
            getJobZoneTitle(jobZoneData) ||
            JOB_ZONE_TITLES[jobZoneNumber] ||
            "",
          bright_outlook: getBooleanTag(detailData, "bright"),
          green: getBooleanTag(detailData, "green"),
          last_synced_at: new Date().toISOString(),
        };

        if (action === "preview") {
          summary.sample.push({
            mode: existingByCode.has(onet_code) ? "update" : "create",
            ...payload,
          });
          continue;
        }

        const existing = existingByCode.get(onet_code);

        if (existing?.id) {
          await base44.asServiceRole.entities.OnetOccupation.update(
            existing.id,
            payload
          );
          summary.updated++;
        } else {
          await base44.asServiceRole.entities.OnetOccupation.create(payload);
          summary.created++;
        }
      } catch (error) {
        summary.failed++;
        summary.failures.push({
          onet_code,
          title,
          error: error?.message || String(error),
        });
      }
    }

    return Response.json({
      success: true,
      summary,
      note:
        action === "preview"
          ? "Preview only. No records written."
          : "Execute complete.",
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: error?.message || "Unexpected error",
      },
      { status: 500 }
    );
  }
});

async function onetFetch(apiKey, path, params = {}) {
  const url = new URL(`${ONET_BASE_URL}${path}`);

  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  console.log("[syncOnetOccupations] GET", url.toString());

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "X-API-Key": apiKey,
    },
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      `O*NET request failed ${response.status}: ${text || response.statusText}`
    );
  }

  try {
    return text ? JSON.parse(text) : null;
  } catch (_error) {
    return text;
  }
}

function normalizeOccupations(data) {
  const occupations =
    data?.occupation ||
    data?.occupations ||
    data?.career ||
    data?.careers ||
    data?.results ||
    [];

  return Array.isArray(occupations) ? occupations : [occupations].filter(Boolean);
}

function getDescription(detailData) {
  return (
    detailData?.description ||
    detailData?.summary ||
    detailData?.occupation?.description ||
    ""
  );
}

function getJobZoneNumber(jobZoneData) {
  const raw =
    jobZoneData?.job_zone ||
    jobZoneData?.code ||
    jobZoneData?.value ||
    jobZoneData?.zone ||
    jobZoneData?.title;

  const match = String(raw || "").match(/[1-5]/);
  return match ? Number(match[0]) : null;
}

function getJobZoneTitle(jobZoneData) {
  return (
    jobZoneData?.job_zone_title ||
    jobZoneData?.title ||
    jobZoneData?.name ||
    ""
  );
}

function getBooleanTag(data, keyword) {
  const text = JSON.stringify(data || "").toLowerCase();
  return text.includes(keyword.toLowerCase());
}