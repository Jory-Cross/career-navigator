import { createClientFromRequest } from "npm:@base44/sdk@0.8.6";

type SearchOnetBody = {
  query?: string;
  limit?: number;
};

type OnetCareerResult = {
  onet_code: string;
  title: string;
  href: string | null;
  bright_outlook: boolean;
  green: boolean;
  apprenticeship: boolean;
};

function toBoolean(value: unknown) {
  return String(value || "").toLowerCase() === "true";
}

function toArray(value: unknown): any[] {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return [value];
}

function normalizeCareer(item: any): OnetCareerResult {
  return {
    onet_code: item?.code || item?.onet_code || "",
    title: item?.title || item?.occupation || "",
    href: item?.href || item?.link || null,
    bright_outlook: toBoolean(item?.tags?.bright_outlook || item?.bright_outlook),
    green: toBoolean(item?.tags?.green || item?.green),
    apprenticeship: toBoolean(item?.tags?.apprenticeship || item?.apprenticeship),
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as SearchOnetBody;
    const query = String(body?.query || "").trim();
    const limit = Math.min(Math.max(Number(body?.limit || 10), 1), 25);

    if (!query) {
      return Response.json(
        { error: "Missing required field: query" },
        { status: 400 }
      );
    }

    const apiKey = Deno.env.get("ONET_API_KEY") || "";

    if (!apiKey) {
      return Response.json(
        {
          error: "Missing O*NET API key. Set ONET_API_KEY in Base44 secrets.",
        },
        { status: 500 }
      );
    }

    const url =
      `https://services.onetcenter.org/ws/online/search?keyword=${encodeURIComponent(query)}`;

    const onetResponse = await fetch(url, {
      method: "GET",
      headers: {
        "X-API-Key": apiKey,
        Accept: "application/json",
      },
    });

    const responseText = await onetResponse.text();

    if (!onetResponse.ok) {
      return Response.json(
        {
          error: "O*NET request failed",
          status: onetResponse.status,
          details: responseText.slice(0, 1000),
        },
        { status: 502 }
      );
    }

    const data = JSON.parse(responseText);

    const rawItems = [
      ...toArray(data?.occupation),
      ...toArray(data?.occupations),
      ...toArray(data?.career),
      ...toArray(data?.careers),
      ...toArray(data?.results),
    ];

    const items = rawItems
      .map(normalizeCareer)
      .filter((item) => item.onet_code && item.title)
      .slice(0, limit);

    return Response.json({
      source: "onet",
      query,
      total: items.length,
      items,
    });
  } catch (error) {
    console.error("searchOnetCareers error:", error);

    return Response.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
});
