import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { path, params } = await req.json();

    if (!path) {
      return Response.json({ success: false, error: 'Missing required parameter: path' }, { status: 400 });
    }

    const username = Deno.env.get('ONET_USERNAME');
    const password = Deno.env.get('ONET_PASSWORD');

    if (!username || !password) {
      console.error('[onetProxy] Missing ONET credentials in environment');
      return Response.json({ success: false, error: 'Server configuration error: missing credentials' }, { status: 500 });
    }

    // Build query string from params
    let queryString = '';
    if (params && typeof params === 'object' && Object.keys(params).length > 0) {
      queryString = '?' + new URLSearchParams(params).toString();
    }

    const url = `https://services.onetcenter.org/ws/mnm${path}${queryString}`;
    console.log(`[onetProxy] Fetching: ${url}`);

    const credentials = btoa(`${username}:${password}`);

    const response = await fetch(url, {
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[onetProxy] O*NET API error ${response.status}: ${errorText}`);
      return Response.json(
        { success: false, error: `O*NET API returned ${response.status}: ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return Response.json({ success: true, data });

  } catch (error) {
    console.error('[onetProxy] Unexpected error:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});