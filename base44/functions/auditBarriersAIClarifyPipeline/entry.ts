/**
 * Legacy barriers AI diagnostic is intentionally disabled during the
 * Security Remediation Freeze. It previously accepted browser-supplied client
 * identifiers, exposed sensitive intake traces, and invoked an unreviewed
 * extraction flow.
 */
Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return Response.json(
      { error: "This legacy diagnostic accepts POST requests only." },
      { status: 405 }
    );
  }

  // Consume the request without trusting, reading, or acting on its payload.
  await req.text().catch(() => "");

  return Response.json({
    disabled: true,
    message:
      "This legacy barriers diagnostic is disabled during the security remediation freeze. No client data was accessed or processed.",
  });
});
