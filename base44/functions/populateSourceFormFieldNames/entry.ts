import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Populate source_form_field_name for all reportable fields
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const allFields = await base44.entities.ReportFieldTemplate.filter({
      is_active: true
    });

    let updated = 0;
    const batchSize = 10;

    for (let i = 0; i < allFields.length; i += batchSize) {
      const batch = allFields.slice(i, i + batchSize);

      for (const field of batch) {
        const isReportable = field.is_reportable !== false;

        if (!isReportable) {
          continue; // Skip internal-only fields
        }

        if (!field.source_form_field_name) {
          // Generate canonical field name from pdf_context + field_key
          const pdfContext = field.pdf_context || 'row';
          const canonical = `${pdfContext}_${field.field_key}`;

          try {
            await base44.entities.ReportFieldTemplate.update(field.id, {
              source_form_field_name: canonical
            });
            updated++;
            console.log(`[UPDATE] ${field.field_key} → ${canonical}`);
          } catch (e) {
            console.error(`[ERROR] Failed to update ${field.field_key}:`, e.message);
          }
        }
      }

      // Delay between batches
      if (i + batchSize < allFields.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`[COMPLETE] Updated ${updated} fields`);

    // Re-verify
    const verify = await base44.entities.ReportFieldTemplate.filter({
      is_active: true
    });

    const reportable = verify.filter(f => f.is_reportable !== false);
    const stillMissing = reportable.filter(f => !f.source_form_field_name);

    return Response.json({
      updated_count: updated,
      reportable_fields: reportable.length,
      missing_source_form_field_name: stillMissing.length,
      status: stillMissing.length === 0 ? '✅ COMPLETE' : '⚠️ CHECK'
    });

  } catch (error) {
    console.error('[ERROR]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});