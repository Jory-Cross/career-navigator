import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { PDFDocument } from 'npm:pdf-lib@1.17.1';

/**
 * Generate Versioned Report
 * 
 * Creates PDFs with version tracking and period locking. This is the main entry point
 * for all PDF report generation.
 * 
 * Steps:
 * 1. Fetch source records (TimeEntry, ReportFieldAnswer, etc.)
 * 2. Assemble structured report object
 * 3. Fill PDF from report object
 * 4. Create new ReportVersion record to track generation
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      client_id,
      entry_type_code,
      pdf_template_id,
      template_version = 'current',
      report_start_date,
      report_end_date,
      supersedes_report_id // Optional, for regeneration
    } = await req.json();

    // Validate inputs
    if (!client_id || !entry_type_code || !pdf_template_id || !report_start_date || !report_end_date) {
      return Response.json({
        error: 'Missing required: client_id, entry_type_code, pdf_template_id, report_start_date, report_end_date'
      }, { status: 400 });
    }

    // Step 1: Fetch source records
    const [template, mappings, client, timeEntries, allAnswers, authorizations] = await Promise.all([
      base44.entities.PDFTemplate.filter({ id: pdf_template_id }).then(r => r[0]),
      base44.entities.PDFFieldMap.filter({ pdf_template_id }),
      base44.entities.Client.filter({ id: client_id }).then(r => r[0]),
      base44.entities.TimeEntry.filter({
        client_id: client_id,
        date: { $gte: report_start_date, $lte: report_end_date },
        entry_type_code: entry_type_code
      }),
      base44.entities.ReportFieldAnswer.list(),
      base44.entities.ServiceAuthorization.filter({ client_id })
    ]);

    // Validate records
    if (!template) return Response.json({ error: 'Template not found' }, { status: 404 });
    if (!client) return Response.json({ error: 'Client not found' }, { status: 404 });
    if (timeEntries.length === 0) return Response.json({ error: 'No entries in period' }, { status: 404 });

    const readyEntries = timeEntries.filter(e => {
      const answer = allAnswers.find(a => a.time_entry_id === e.id);
      return answer && answer.report_ready;
    });

    if (readyEntries.length === 0) {
      return Response.json({ error: 'No report-ready entries found' }, { status: 400 });
    }

    // Step 2: Assemble structured report
    const answersMap = new Map(allAnswers.map(a => [a.time_entry_id, a]));
    const report = assembleReport(readyEntries, answersMap, client, authorizations, report_start_date, report_end_date);

    // Step 3: Fill PDF
    const pdfFileUrl = await fillPDF(base44, template, mappings, report);

    // Step 4: Create new ReportVersion record
    const nextVersionNumber = await getNextVersionNumber(base44, client_id, entry_type_code, report_start_date, report_end_date);
    
    const newVersion = await base44.entities.ReportVersion.create({
      client_id,
      entry_type_code,
      template_id: pdf_template_id,
      template_version,
      report_start_date,
      report_end_date,
      included_time_entry_ids: readyEntries.map(e => e.id),
      included_answer_record_ids: readyEntries.map(e => answersMap.get(e.id)?.id).filter(Boolean),
      time_entry_count: readyEntries.length,
      generated_file_url: pdfFileUrl,
      generated_file_name: `${entry_type_code}_${client_id}_${report_start_date}.pdf`,
      total_hours: report.summary.total_hours,
      version_number: nextVersionNumber,
      supersedes_report_id: supersedes_report_id || null,
      generated_at: new Date().toISOString(),
      generated_by: user.email,
      locked: false,
      is_final: false
    });

    return Response.json({
      success: true,
      report_version_id: newVersion.id,
      version_number: newVersion.version_number,
      pdf_url: pdfFileUrl,
      entries_included: readyEntries.length,
      message: `Report generated (version ${newVersion.version_number})`
    });

  } catch (error) {
    console.error('generateVersionedReport error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// --- Helper functions ---

async function fillPDF(base44, template, mappings, report) {
  const pdfRes = await fetch(template.pdf_file_url);
  if (!pdfRes.ok) throw new Error('Failed to fetch PDF template');

  const pdfBytes = await pdfRes.arrayBuffer();
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const form = pdfDoc.getForm();

  // Refactored to use pdfFieldMapper logic (assuming it exists)
  const { buildFieldInstructions } = await import('@/lib/pdfFieldMapper.js');
  const instructions = buildFieldInstructions(mappings, report);

  instructions.forEach(({ fieldName, value }) => {
    try {
      const field = form.getField(fieldName);
      field.setText(String(value || ''));
    } catch (e) {
      console.warn(`Could not fill ${fieldName}: ${e.message}`);
    }
  });

  form.flatten();
  const filledBytes = await pdfDoc.save();

  const base64 = btoa(String.fromCharCode(...new Uint8Array(filledBytes)));
  const dataUrl = `data:application/pdf;base64,${base64}`;

  const { file_url } = await base44.integrations.Core.UploadFile({ file: dataUrl });
  return file_url;
}

async function getNextVersionNumber(base44, clientId, entryTypeCode, startDate, endDate) {
  const previous = await base44.entities.ReportVersion.filter({
    client_id: clientId,
    entry_type_code: entryTypeCode,
    report_start_date: startDate,
    report_end_date: endDate
  });

  return Math.max(0, ...previous.map(v => v.version_number || 0)) + 1;
}

function assembleReport(timeEntries, answersMap, client, authorizations, startDate, endDate) {
  const totalMin = timeEntries.reduce((sum, e) => sum + (e.duration_minutes || 0), 0);
  const sorted = [...timeEntries].sort((a, b) => a.date.localeCompare(b.date));
  
  const authorization = authorizations.find(a =>
    a.status === 'active' &&
    a.service_type_code === sorted[0]?.entry_type_code &&
    a.authorization_start_date <= startDate &&
    a.authorization_end_date >= endDate
  );

  return {
    header: {
      client_first_name: client.first_name || '',
      client_last_name: client.last_name || '',
      client_full_name: `${client.first_name || ''} ${client.last_name || ''}`.trim(),
      authorization_number: authorization?.authorization_number || '',
    },
    rows: timeEntries.map((entry, idx) => {
      const fieldAnswer = answersMap.get(entry.id);
      const answers = fieldAnswer?.answers || {};
      return {
        ...entry,
        ...answers,
        row_number: idx + 1,
        duration_hours: ((entry.duration_minutes || 0) / 60).toFixed(2),
      };
    }),
    summary: {
      total_entries: timeEntries.length,
      total_minutes: totalMin,
      total_hours: (totalMin / 60).toFixed(2),
    }
  };
}