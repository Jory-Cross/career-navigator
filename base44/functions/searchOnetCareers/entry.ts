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

function toBoolean(value: string | null) {
  return String(value || "").toLowerCase() === "true";
}

function basicAuthHeader(username: string, password: string) {
  const encoded = btoa(`${username}:${password}`);
  return `Basic ${encoded}`;
}

function parseCareerNodes(xmlText: string): OnetCareerResult[] {
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");

  if (!doc) {
    throw new Error("Unable to parse O*NET response.");
  }

  const parserError = doc.querySelector("parsererror");
  if (parserError) {
    throw new Error("Invalid XML returned from O*NET.");
  }

  const careerNodes = Array.from(doc.querySelectorAll("career"));

  return careerNodes.map((career) => {
    const code =
      career.querySelector(":scope > code")?.textContent?.trim() ||
      career.getAttribute("code") ||
      "";

    const title =
      career.querySelector(":scope > title")?.textContent?.trim() || "";

    const tagsNode = career.querySelector(":scope > tags");
    const href =
      career.getAttribute("href") ||
      career.querySelector(":scope > links > link")?.getAttribute("href") ||
      career.querySelector(":scope > resources > resource")?.getAttribute("href") ||
      null;

    return {
      onet_code: code,
      title,
      href,
      bright_outlook: toBoolean(tagsNode?.getAttribute("bright_outlook") || null),
      green: toBoolean(tagsNode?.getAttribute("green") || null),
      apprenticeship: toBoolean(tagsNode?.getAttribute("apprenticeship") || null),
    };
  });
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

    const username = Deno.env.get("ONET_USERNAME") || "";
    const password = Deno.env.get("ONET_PASSWORD") || "";

    if (!username || !password) {
      return Response.json(
        {
          error:
            "Missing O*NET credentials. Set ONET_USERNAME and ONET_PASSWORD in Base44 secrets.",
        },
        { status: 500 }
      );
    }

   const url =
  `https://services.onetcenter.org/ws/online/search?keyword=${encodeURIComponent(query)}`;

    const onetResponse = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: basicAuthHeader(username, password),
        Accept: "application/xml",
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

    const items = parseCareerNodes(responseText)
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
