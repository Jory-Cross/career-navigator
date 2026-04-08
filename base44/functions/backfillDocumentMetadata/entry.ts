import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Backfill Document metadata for generated reports
 * - Identify generated PDF reports (via GeneratedReport or ReportBatch links)
 * - Mark category = 'generated_report' when appropriate
 * - Set is_generated = true when appropriate
 * - Populate document_subtype, reporting_period_start, reporting_period_end, source metadata
 * - Preserve user-uploaded documents unless clearly identified as generated
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Admin-only check
    if (!user || user.role !== 'admin') {
      return Response.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    console.log('Starting Document metadata backfill...');

    // Fetch all documents
    const documents = await base44.asServiceRole.entities.Document.list();
    console.log(`Found ${documents.length} Document records`);

    // Fetch GeneratedReport records for reference
    const generatedReports = await base44.asServiceRole.entities.GeneratedReport.list();
    const generatedReportMap = {};
    generatedReports.forEach(gr => {
      generatedReportMap[gr.generated_document_id] = gr;
    });
    console.log(`Loaded ${generatedReports.length} GeneratedReport records`);

    // Fetch ReportBatch records for reference
    const reportBatches = await base44.asServiceRole.entities.ReportBatch.list();
    const reportBatchMap = {};
    reportBatches.forEach(rb => {
      if (rb.results && Array.isArray(rb.results)) {
        rb.results.forEach(result => {
          if (result.document_id) {
            reportBatchMap[result.document_id] = rb;
          }
        });
      }
    });
    console.log(`Loaded ${reportBatches.length} ReportBatch records`);

    const results = {
      updated: [],
      skipped: [],
      errors: []
    };

    // Process each document
    for (const doc of documents) {
      try {
        const updates = {};
        let isLikelyGenerated = false;
        let hasChanges = false;

        // Check if document is linked to GeneratedReport
        const linkedGeneratedReport = generatedReportMap[doc.id];
        if (linkedGeneratedReport) {
          isLikelyGenerated = true;
          
          // Set category to generated_report if not already
          if (doc.category !== 'generated_report') {
            updates.category = 'generated_report';
            hasChanges = true;
          }

          // Set is_generated = true
          if (!doc.is_generated) {
            updates.is_generated = true;
            hasChanges = true;
          }

          // Populate document_subtype from report mode if missing
          if (!doc.document_subtype && linkedGeneratedReport.template_version) {
            updates.document_subtype = linkedGeneratedReport.template_version;
            hasChanges = true;
          }

          // Populate reporting period dates
          if (!doc.reporting_period_start && linkedGeneratedReport.report_start_date) {
            updates.reporting_period_start = linkedGeneratedReport.report_start_date;
            hasChanges = true;
          }

          if (!doc.reporting_period_end && linkedGeneratedReport.report_end_date) {
            updates.reporting_period_end = linkedGeneratedReport.report_end_date;
            hasChanges = true;
          }

          // Set source metadata
          if (!doc.source_type) {
            updates.source_type = 'GeneratedReport';
            hasChanges = true;
          }

          if (!doc.source_id) {
            updates.source_id = linkedGeneratedReport.id;
            hasChanges = true;
          }

          if (!doc.generated_report_id) {
            updates.generated_report_id = linkedGeneratedReport.id;
            hasChanges = true;
          }

          if (!doc.entry_type_code && linkedGeneratedReport.entry_type_code) {
            updates.entry_type_code = linkedGeneratedReport.entry_type_code;
            hasChanges = true;
          }
        }

        // Check if document is linked to ReportBatch
        const linkedReportBatch = reportBatchMap[doc.id];
        if (linkedReportBatch && !isLikelyGenerated) {
          isLikelyGenerated = true;

          if (doc.category !== 'generated_report') {
            updates.category = 'generated_report';
            hasChanges = true;
          }

          if (!doc.is_generated) {
            updates.is_generated = true;
            hasChanges = true;
          }

          if (!doc.report_batch_id) {
            updates.report_batch_id = linkedReportBatch.id;
            hasChanges = true;
          }

          if (!doc.source_type) {
            updates.source_type = 'ReportBatch';
            hasChanges = true;
          }

          if (!doc.source_id) {
            updates.source_id = linkedReportBatch.id;
            hasChanges = true;
          }

          if (!doc.reporting_period_start && linkedReportBatch.date_range_start) {
            updates.reporting_period_start = linkedReportBatch.date_range_start;
            hasChanges = true;
          }

          if (!doc.reporting_period_end && linkedReportBatch.date_range_end) {
            updates.reporting_period_end = linkedReportBatch.date_range_end;
            hasChanges = true;
          }

          if (!doc.entry_type_code && linkedReportBatch.entry_type_code) {
            updates.entry_type_code = linkedReportBatch.entry_type_code;
            hasChanges = true;
          }
        }

        // Heuristic: infer from naming patterns (e.g., "USOR-95", "Report", "PDF")
        if (!isLikelyGenerated && doc.file_name && /^USOR|report|vr.*pdf/i.test(doc.file_name)) {
          if (doc.category !== 'generated_report') {
            updates.category = 'generated_report';
            hasChanges = true;
          }

          if (!doc.is_generated) {
            updates.is_generated = true;
            hasChanges = true;
          }

          // Try to infer document_subtype from filename
          const match = doc.file_name.match(/USOR[-_]?(\d{2,3})/i);
          if (!doc.document_subtype && match) {
            updates.document_subtype = `usor${match[1]}`;
            hasChanges = true;
          }

          if (!doc.source_type) {
            updates.source_type = 'unknown';
            hasChanges = true;
          }
        }

        // Update if there are changes
        if (hasChanges) {
          await base44.asServiceRole.entities.Document.update(doc.id, updates);
          results.updated.push({
            id: doc.id,
            changes: Object.keys(updates)
          });
          console.log(`Updated ${doc.id}: ${Object.keys(updates).join(', ')}`);
        } else {
          results.skipped.push({
            id: doc.id,
            reason: 'No changes needed or not a generated report'
          });
        }
      } catch (error) {
        results.errors.push({
          id: doc.id,
          error: error.message
        });
        console.error(`Error processing ${doc.id}: ${error.message}`);
      }
    }

    console.log('Backfill complete:', results);

    return Response.json({
      success: true,
      summary: {
        total_processed: documents.length,
        updated: results.updated.length,
        skipped: results.skipped.length,
        errors: results.errors.length
      },
      results
    });
  } catch (error) {
    console.error('backfillDocumentMetadata error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});