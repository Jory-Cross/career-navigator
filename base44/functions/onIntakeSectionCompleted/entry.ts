/**
 * Legacy IntakeSection automation is intentionally disabled during the
 * Security Remediation Freeze. Intake processing must use a reviewed,
 * server-authorized replacement before this route can be re-enabled.
 */
Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return Response.json(
      { error: "This legacy intake automation accepts POST requests only." },
      { status: 405 }
    );
  }

  // Consume an automation payload without trusting or processing any fields.
  await req.text().catch(() => "");

  return Response.json({
    disabled: true,
    message:
      "This legacy intake automation is disabled during the security remediation freeze. No intake data was processed.",
  });
});
