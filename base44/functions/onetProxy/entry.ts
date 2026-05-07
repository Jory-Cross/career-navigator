import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
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

    const onetUsername = Deno.env.get("ONET_USERNAME") || Deno.env.get("VITE_ONET_USERNAME");
    const onetPassword = Deno.env.get("ONET_PASSWORD") || Deno.env.get("VITE_ONET_PASSWORD");

    if (!onetUsername || !onetPassword) {
      console.error("[onetProxy] Missing ONET_USERNAME or ONET_PASSWORD in environment");
      return Response.json(
        { success: false, error: "Server configuration error: missing O*NET credentials" },
        { status: 500 }
      );
    }

    const basicAuth = btoa(`${onetUsername}:${onetPassword}`);

    const baseUrl = "https://services.onetcenter.org/ws/mnm";

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
        Authorization: `Basic ${basicAuth}`,
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

    return Response.json({ success: true, data });

  } catch (error) {
    console.error("[onetProxy] Unexpected error:", error?.message || error);
    return Response.json(
      { success: false, error: error?.message || "Unexpected error" },
      { status: 500 }
    );
  }
});