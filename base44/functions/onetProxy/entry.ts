import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

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

    const { path, params = {} } = await req.json();

    if (!path) {
      return Response.json(
        { success: false, error: "Missing required parameter: path" },
        { status: 400 }
      );
    }

    if (!path.startsWith("/")) {
      return Response.json(
        { success: false, error: "Invalid O*NET path" },
        { status: 400 }
      );
    }

    const apiKey = Deno.env.get("ONET_API_KEY");

    if (!apiKey) {
      console.error("[onetProxy] Missing ONET_API_KEY in environment");
      return Response.json(
        {
          success: false,
          error: "Server configuration error: missing ONET_API_KEY",
        },
        { status: 500 }
      );
    }

    const baseUrl = path.startsWith("/ip/")
      ? "https://services.onetcenter.org/ws/mnm"
      : "https://api-v2.onetcenter.org";

    const url = new URL(`${baseUrl}${path}`);

    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });

    console.log("[onetProxy] Fetching:", url.toString());

    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "X-API-Key": apiKey,
      },
    });

    const text = await response.text();

    if (!response.ok) {
      console.error("[onetProxy] O*NET API error:", {
        status: response.status,
        body: text,
      });

      return Response.json(
        {
          success: false,
          status: response.status,
          error: text || response.statusText,
        },
        { status: response.status }
      );
    }

    let data = null;

    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    return Response.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("[onetProxy] Unexpected error:", error?.message || error);

    return Response.json(
      {
        success: false,
        error: error?.message || "Unexpected error",
      },
      { status: 500 }
    );
  }
});