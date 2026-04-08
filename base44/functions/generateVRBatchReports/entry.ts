import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * generateVRBatchReports
 *
 * Production-safe Utah VR batch report workflow.
 *
 * For each client:
 *   1. Assemble report data using assembleVRReportData
 *   2. Generate PDF using generatePDFReport
 *   3. Create GeneratedReport record with immutable snapshot
 *   4. Create/update Document record for file storage
 *   5. Lock included TimeEntry and ReportFieldAnswer records
 *   6. Record per-client success/failure in ReportBatch.results
 *
 * Batch status rules:
 *   - completed: all succeeded (skipped is OK)
 *   - partial_failure: some succeeded AND some failed
 *   - failed: all failed or no success
 *
 * Required body:
 *   pdf_template_id, entry_type_code, report_mode, client_ids, date_from, date_to
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { pdf_template_id, entry_type_code, report_mode, client_ids, date_from, date_to } = body;

    // Validate required inputs
    if (!pdf_template_id) return Response.json({ error: 'pdf_template_id required' }, { status: 400 });
    if (!entry_type_code) return Response.json({ error: 'entry_type_code required' }, { status: 400 });
    if (!report_mode) return Response.json({ error: 'report_mode required' }, { status: 400 });
    if (!client_ids?.length) return Response.json({ error: 'client_ids (non-empty array) required' }, { status: 400 });
    if (!date_from) return Response.json({ error: 'date_from required' }, { status: 400 });
    if (!date_to) return Response.json({ error: 'date_to required' }, { status: 400 });

    // Verify template exists
    let template;
    try {
      const templates = await base44.entities.PDFTemplate.filter({ id: pdf_template_id });
      template = templates[0] || null;
    } catch (err) {
      console.error('Template fetch error:', err.message);
      return Response.json({ error: 'Failed to fetch PDF template' }, { status: 500 });
    }

    if (!template) {
      return Response.json({ error: 'PDF template not found' }, { status: 404 });
    }

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

    // Batch status logic:
    // - completed: all clients succeeded (skipped clients are OK)
    // - partial_failure: some succeeded AND some failed (do NOT mark completed)
    // - failed: all clients failed or no clients succeeded
    const batchStatus = failed === 0      ? 'completed'
                       : succeeded === 0   ? 'failed'
                       :                    'partial_failure';

    console.log(`[batch ${batch.id}] Final status: ${batchStatus} (${succeeded} success, ${failed} failed, ${skipped} skipped)`);

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

async function processClient({
  base44, user, template, clientId,
  entry_type_code, report_mode, date_from, date_to, batch_id
}) {
  try {
    // Step 1 — Assemble report data using assembleVRReportData
    console.log(`[batch ${batch_id}] Assembling for client ${clientId}...`);
    const assembleRes = await base44.functions.invoke('assembleVRReportData', {
      client_id: clientId,
      entry_type_code,
      date_from,
      date_to,
      report_mode
    });

    if (!assembleRes?.data?.success) {
      const msg = assembleRes?.data?.error || 'Data assembly failed';
      return { status: 'failed', message: msg };
    }

    const assembled = assembleRes.data.data;

    // Skip clients with no entries
    if (!assembled.totals?.entry_count || assembled.totals.entry_count === 0) {
      return { status: 'skipped', message: 'No entries in period' };
    }

    console.log(`[batch ${batch_id}] Generating PDF for client ${clientId} (${assembled.totals.entry_count} entries)...`);

    // Step 2 — Generate PDF using generatePDFReport
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

    // Step 3 — Determine version number for this period
    const existingReports = await base44.entities.GeneratedReport.filter({
      client_id: clientId,
      entry_type_code
    });

    const periodReports = existingReports.filter(r =>
      r.report_start_date === date_from && r.report_end_date === date_to
    );

    const versionNumber = periodReports.length + 1;
    const supersedes = periodReports.length > 0
      ? periodReports.sort((a, b) => (b.version_number || 1) - (a.version_number || 1))[0].id
      : null;

    const clientHeader = assembled.header;
    const clientName = clientHeader.client_full_name || clientId;
    const fileName = `${entry_type_code}-${clientHeader.client_last_name || clientId}-${date_from}-${date_to}-v${versionNumber}.pdf`;
    const title = `${entry_type_code.replace(/_/g, ' ').toUpperCase()} — ${clientName} (${date_from} to ${date_to})`;

    // Step 4 — Create GeneratedReport record (immutable snapshot)
    console.log(`[batch ${batch_id}] Creating GeneratedReport for client ${clientId}, version ${versionNumber}...`);
    const generatedReport = await base44.entities.GeneratedReport.create({
      client_id: clientId,
      report_batch_id: batch_id,
      entry_type_code,
      pdf_template_id: template.id,
      template_version: template.template_version || 'v1',
      report_start_date: date_from,
      report_end_date: date_to,
      included_time_entry_ids: assembled.included_time_entry_ids || [],
      included_answer_ids: assembled.included_answer_ids || [],
      assembled_report_snapshot: assembled,
      version_number: versionNumber,
      supersedes_report_id: supersedes,
      generated_by: user.email,
      generated_at: generatedAt,
      locked: false,
      is_final: false
    });

    // Step 5 — Create or update Document record
    console.log(`[batch ${batch_id}] Creating Document for client ${clientId}...`);
    const existingDocs = await base44.entities.Document.filter({
      client_id: clientId,
      entry_type_code,
      category: 'generated_report',
      reporting_period_start: date_from,
      reporting_period_end: date_to
    });

    let document;
    if (existingDocs.length > 0 && versionNumber > 1) {
      // Update existing document for new version
      const prevDoc = existingDocs[0];
      document = await base44.entities.Document.update(prevDoc.id, {
        file_url: pdfUrl,
        file_name: fileName,
        document_subtype: report_mode,
        generated_report_id: generatedReport.id,
        report_version: versionNumber,
        parent_document_id: prevDoc.id,
        notes: `Batch ${batch_id} — ${assembled.totals.entry_count} entries, v${versionNumber}`
      });
    } else {
      // Create new document
      document = await base44.entities.Document.create({
        client_id: clientId,
        title,
        file_url: pdfUrl,
        file_name: fileName,
        category: 'generated_report',
        document_subtype: report_mode,
        entry_type_code,
        source_type: 'GeneratedReport',
        source_id: generatedReport.id,
        generated_report_id: generatedReport.id,
        is_generated: true,
        generated_from_template_id: template.id,
        report_batch_id: batch_id,
        report_version: versionNumber,
        reporting_period_start: date_from,
        reporting_period_end: date_to,
        tags: [entry_type_code, report_mode, 'vr-report'],
        notes: `Batch ${batch_id} — ${assembled.totals.entry_count} entries, v${versionNumber}`
      });
    }

    // Update GeneratedReport with document FK
    await base44.entities.GeneratedReport.update(generatedReport.id, {
      generated_document_id: document.id
    });

    // Step 6 — Lock TimeEntry and ReportFieldAnswer records
    console.log(`[batch ${batch_id}] Locking entries for client ${clientId}...`);

    // Fetch actual entries to check is_billable/is_reportable
    const entriesToLock = await base44.entities.TimeEntry.filter({
      id: { $in: assembled.included_time_entry_ids }
    });

    const billableOrReportable = entriesToLock
      .filter(e => e.is_billable || e.is_reportable)
      .map(e => e.id);

    if (billableOrReportable.length > 0) {
      for (const entryId of billableOrReportable) {
        await base44.entities.TimeEntry.update(entryId, {
          locked_in_report_id: generatedReport.id,
          report_ready: true
        });
      }
    }

    // Lock field answers
    if (assembled.included_answer_ids?.length > 0) {
      for (const answerId of assembled.included_answer_ids) {
        await base44.entities.ReportFieldAnswer.update(answerId, {
          locked_in_report_id: generatedReport.id,
          report_ready: true
        });
      }
    }

    console.log(`[batch ${batch_id}] ✓ Client ${clientId} success (${assembled.totals.entry_count} entries, ${billableOrReportable.length} locked)`);

    return {
      status: 'success',
      generated_report_id: generatedReport.id,
      document_id: document.id,
      pdf_url: pdfUrl,
      version_number: versionNumber,
      entry_count: assembled.totals.entry_count,
      total_hours: assembled.totals.total_hours,
      locked_entry_count: billableOrReportable.length
    };
  } catch (error) {
    console.error(`[batch ${batch_id}] ✗ Client ${clientId} error:`, error.message);
    return {
      status: 'failed',
      message: error.message
    };
  }
}