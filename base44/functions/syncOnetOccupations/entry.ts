import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

const ONET_BASE_URL = "https://api-v2.onetcenter.org";
const PLATFORM_OWNER_ROLE = "platform_owner";

const JOB_ZONE_TITLES = {
  1: "Little or No Preparation Needed",
  2: "Some Preparation Needed",
  3: "Medium Preparation Needed",
  4: "Considerable Preparation Needed",
  5: "Extensive Preparation Needed",
};

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isActive(record: any) {
  return record?.is_active !== false && record?.is_archived !== true;
}

function isCanonicalPlatformAdmin(user: any) {
  return (
    normalizeText(user?.role).toLowerCase() === "admin" &&
    normalizeText(user?.access_level).toLowerCase() === "admin"
  );
}

async function requirePlatformOwner(base44: any, authenticatedUserId: string) {
  const caller = await base44.asServiceRole.entities.User.get(
    authenticatedUserId
  ).catch(() => null);

  if (!caller || !isActive(caller) || !isCanonicalPlatformAdmin(caller)) {
    throw new Error(
      "Active Platform Owner access is required to synchronize the O*NET catalog."
    );
  }

  const platformAdminRecords =
    await base44.asServiceRole.entities.PlatformAdmin.filter({
      user_id: caller.id,
    });

  const isPlatformOwner = (Array.isArray(platformAdminRecords)
    ? platformAdminRecords
    : []
  ).some(
    (record: any) =>
      isActive(record) &&
      normalizeText(record?.user_id) === normalizeText(caller.id) &&
      normalizeText(record?.platform_role).toLowerCase() ===
        PLATFORM_OWNER_ROLE
  );

  if (!isPlatformOwner) {
    throw new Error(
      "Active Platform Owner access is required to synchronize the O*NET catalog."
    );
  }

  return caller;
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json(
        { success: false, error: "This route accepts POST requests only." },
        { status: 405 }
      );
    }

    const base44 = createClientFromRequest(req);
    const authenticatedUser = await base44.auth.me().catch(() => null);

    if (!authenticatedUser?.id) {
      return Response.json(
        { success: false, error: "Please sign in before synchronizing the O*NET catalog." },
        { status: 401 }
      );
    }

    await requirePlatformOwner(base44, authenticatedUser.id);

    const body = await req.json().catch(() => ({}));
    const action = normalizeText(body?.action).toLowerCase() || "diagnose";
    const start = Number(body?.start ?? 1);
    const requestedLimit = Number(body?.limit ?? 25);

    if (!["diagnose", "preview", "execute"].includes(action)) {
      return Response.json(
        {
          success: false,
          error: "Choose diagnose, preview, or execute for the O*NET catalog sync.",
        },
        { status: 400 }
      );
    }

    if (!Number.isInteger(start) || start < 1) {
      return Response.json(
        { success: false, error: "The O*NET catalog start position must be a positive whole number." },
        { status: 400 }
      );
    }

    if (!Number.isInteger(requestedLimit) || requestedLimit < 1) {
      return Response.json(
        { success: false, error: "The O*NET catalog sync limit must be a positive whole number." },
        { status: 400 }
      );
    }

    const limit = Math.min(requestedLimit, 100);
    const end = start + limit - 1;

    const apiKey =
      Deno.env.get("ONET_API_KEY") ||
      Deno.env.get("VITE_ONET_API_KEY");

    if (!apiKey) {
      return Response.json(
        { success: false, error: "The O*NET catalog key is not configured." },
        { status: 500 }
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
        note: "Diagnose only. No records were written and no detail or job-zone endpoints were called.",
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
      } catch (_error) {
        summary.failed++;
        summary.failures.push({
          onet_code,
          title,
          error: "The O*NET catalog details could not be synchronized for this occupation.",
        });
      }
    }

    return Response.json({
      success: true,
      summary,
      note:
        action === "preview"
          ? "Preview only. No records were written."
          : "Catalog synchronization completed.",
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        error:
          error instanceof Error && error.message
            ? error.message
            : "The O*NET catalog synchronization could not be completed.",
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
    throw new Error("The O*NET catalog service could not be reached.");
  }

  try {
    return text ? JSON.parse(text) : null;
  } catch (_error) {
    throw new Error("The O*NET catalog service returned unusable data.");
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
