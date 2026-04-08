import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * generateVRBatchReports
 *
 * For each client:
 *   1. Assemble report via getReportAggregation (invoke)
 *   2. Generate PDF via generatePDFReport (invoke)
 *   3. Create GeneratedReport record
 *   4. Create Document record
 *   5. Report per-client success/failure into ReportBatch.results
 *
 * Required body params:
 *   pdf_template_id, entry_type_code, report_mode, client_ids, date_from, date_to
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { pdf_template_id, entry_type_code, report_mode, client_ids, date_from, date_to } = body;

    if (!pdf_template_id || !entry_type_code || !report_mode || !client_ids?.length || !date_from || !date_to) {
      return Response.json({
        error: 'Missing required: pdf_template_id, entry_type_code, report_mode, client_ids, date_from, date_to'
      }, { status: 400 });
    }

    // Verify template exists once
    const template = await base44.entities.PDFTemplate.filter({ id: pdf_template_id }).then(r => r[0] || null);
    if (!template) return Response.json({ error: 'PDF template not found' }, { status: 404 });

    // Create ReportBatch tracking record
    const batch = await base44.entities.ReportBatch.create({
      pdf_template_id,
      entry_type_code,
      date_range_start:  date_from,
      date_range_end:    date_to,
      client_ids,
      status:            'processing',
      total_clients:     client_ids.length,
      template_version:  template.template_version || 'v1',
      created_by:        user.email,
      created_at:        new Date().toISOString()
    });

    console.log(`[batch ${batch.id}] Starting — ${client_ids.length} clients, ${entry_type_code}, ${date_from}→${date_to}`);

    const results = [];

    for (const clientId of client_ids) {
      try {
        const result = await processClient({
          base44, user, template, clientId,
          entry_type_code, report_mode, date_from, date_to, batch_id: batch.id
        });
        results.push({ client_id: clientId, ...result });
        console.log(`[batch ${batch.id}] client ${clientId}: ${result.status}`);
      } catch (err) {
        console.error(`[batch ${batch.id}] client ${clientId} fatal:`, err.message);
        results.push({ client_id: clientId, status: 'failed', message: err.message });
      }
    }

    const succeeded = results.filter(r => r.status === 'success').length;
    const failed    = results.filter(r => r.status === 'failed').length;
    const skipped   = results.filter(r => r.status === 'skipped').length;

    const batchStatus = failed === 0      ? 'completed'
                      : succeeded === 0   ? 'failed'
                      :                    'partial_failure';

    await base44.entities.ReportBatch.update(batch.id, {
      status:          batchStatus,
      results,
      success_count:   succeeded,
      failure_count:   failed,
      completed_at:    new Date().toISOString()
    });

    return Response.json({
      batch_id: batch.id,
      status:   batchStatus,
      total:    client_ids.length,
      succeeded,
      failed,
      skipped,
      results
    });

  } catch (error) {
    console.error('generateVRBatchReports fatal:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// ─── Per-Client Processing ────────────────────────────────────────────────────

async function processClient({ base44, user, template, clientId, entry_type_code, report_mode, date_from, date_to, batch_id }) {
  // Step 1 — Assemble report via getReportAggregation
  const assembleRes = await base44.functions.invoke('getReportAggregation', {
    action:          'assemble_report',
    client_id:       clientId,
    entry_type_code,
    report_mode,
    date_from,
    date_to
  });

  if (!assembleRes?.data?.success) {
    const msg = assembleRes?.data?.error || 'Assembly failed';
    return { status: 'failed', message: msg };
  }

  const assembled = assembleRes.data.data;

  // Skip clients with no entries
  if (!assembled.totals?.entry_count || assembled.totals.entry_count === 0) {
    return { status: 'skipped', message: 'No entries in period' };
  }

  // Step 2 — Generate PDF via generatePDFReport
  const pdfRes = await base44.functions.invoke('generatePDFReport', {
    templateId: template.id,
    assembled
  });

  if (!pdfRes?.data?.success || !pdfRes?.data?.pdf_url) {
    const msg = pdfRes?.data?.error || 'PDF generation failed';
    return { status: 'failed', message: msg };
  }

  const pdfUrl = pdfRes.data.pdf_url;
  const generatedAt = new Date().toISOString();

  // Step 3 — Determine version number (superseding any existing for this period)
  const existingReports = await base44.entities.GeneratedReport.filter({
    client_id: clientId,
    entry_type_code
  });
  const periodReports = existingReports.filter(r =>
    r.report_start_date === date_from && r.report_end_date === date_to
  );
  const versionNumber = periodReports.length + 1;
  const supersedes    = periodReports.length > 0
    ? periodReports.sort((a, b) => (b.version_number || 1) - (a.version_number || 1))[0].id
    : null;

  const clientHeader = assembled.header;
  const clientName   = clientHeader.client_full_name || clientId;
  const fileName     = `${entry_type_code}-${clientHeader.client_last_name || clientId}-${date_from}-${date_to}-v${versionNumber}.pdf`;
  const title        = `${entry_type_code.replace(/_/g, ' ').toUpperCase()} — ${clientName} (${date_from} to ${date_to})`;

  // Step 4 — Create GeneratedReport record (stores immutable snapshot of assembled data)
  const generatedReport = await base44.entities.GeneratedReport.create({
    client_id:                   clientId,
    report_batch_id:             batch_id,
    entry_type_code,
    pdf_template_id:             template.id,
    template_version:            template.template_version || 'v1',
    report_start_date:           date_from,
    report_end_date:             date_to,
    included_time_entry_ids:     assembled.included_time_entry_ids || [],
    included_answer_ids:         assembled.included_answer_ids     || [],
    assembled_report_snapshot:   assembled,
    version_number:              versionNumber,
    supersedes_report_id:        supersedes,
    generated_by:                user.email,
    generated_at:                generatedAt,
    locked:                      false,
    is_final:                    false
  });

  // Step 5 — Create Document record (for client file view)
  const document = await base44.entities.Document.create({
    client_id:                   clientId,
    title,
    file_url:                    pdfUrl,
    file_name:                   fileName,
    category:                    'generated_report',
    document_subtype:            report_mode,
    entry_type_code,
    source_type:                 'GeneratedReport',
    source_id:                   generatedReport.id,
    generated_report_id:         generatedReport.id,
    is_generated:                true,
    generated_from_template_id:  template.id,
    report_batch_id:             batch_id,
    report_version:              versionNumber,
    reporting_period_start:      date_from,
    reporting_period_end:        date_to,
    tags:                        [entry_type_code, report_mode, 'vr-report'],
    notes:                       `Batch ${batch_id} — ${assembled.totals.entry_count} entries, v${versionNumber}`
  });

  // Update GeneratedReport with the document FK
  await base44.entities.GeneratedReport.update(generatedReport.id, {
    generated_document_id: document.id
  });

  return {
    status:               'success',
    generated_report_id:  generatedReport.id,
    document_id:          document.id,
    pdf_url:              pdfUrl,
    version_number:       versionNumber,
    entry_count:          assembled.totals.entry_count,
    total_hours:          assembled.totals.total_hours
  };
}