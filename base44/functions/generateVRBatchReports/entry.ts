import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { PDFDocument } from 'npm:pdf-lib@1.17.1';

/**
 * Generate VR Batch Reports
 * 
 * Architecture:
 * Step 1: Fetch source records (TimeEntry, ReportFieldAnswer, Client, ServiceAuthorization)
 * Step 2: Assemble structured reports (never writes to TimeEntry)
 * Step 3: Fill and generate PDFs from assembled reports
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      pdf_template_id,
      entry_type,
      client_ids,
      date_from,
      date_to,
    } = await req.json();

    if (!pdf_template_id || !entry_type || !client_ids?.length || !date_from || !date_to) {
      return Response.json({
        error: 'Missing required: pdf_template_id, entry_type, client_ids, date_from, date_to'
      }, { status: 400 });
    }

    // Create ReportBatch record
    const batch = await base44.entities.ReportBatch.create({
      pdf_template_id,
      entry_type,
      date_range_start: date_from,
      date_range_end: date_to,
      client_ids,
      status: "processing",
      created_by: user.email,
      created_at: new Date().toISOString(),
    });

    // Process each client individually
    const generatedDocuments = [];

    for (const clientId of client_ids) {
      try {
        const result = await generateClientReport(
          base44,
          user,
          pdf_template_id,
          entry_type,
          clientId,
          date_from,
          date_to
        );

        if (result.success) {
          generatedDocuments.push({
            client_id: clientId,
            document_id: result.document_id,
            pdf_url: result.pdf_url,
            status: "success"
          });
        } else {
          generatedDocuments.push({
            client_id: clientId,
            status: "failed",
            error: result.error
          });
        }
      } catch (e) {
        generatedDocuments.push({
          client_id: clientId,
          status: "failed",
          error: e.message
        });
      }
    }

    // Update batch
    const successful = generatedDocuments.filter(d => d.status === "success").length;
    await base44.entities.ReportBatch.update(batch.id, {
      status: successful === client_ids.length ? "completed" : "completed",
      generated_documents: generatedDocuments,
    });

    return Response.json({
      batch_id: batch.id,
      status: "completed",
      total_clients: client_ids.length,
      successful: successful,
      failed: client_ids.length - successful,
      documents: generatedDocuments
    });

  } catch (error) {
    console.error('Batch generation error:', error);
    return Response.json({
      error: error.message || 'Failed to generate reports'
    }, { status: 500 });
  }
});

/**
 * Generate report for single client
 * Orchestrates Step 1 (fetch), Step 2 (assemble), Step 3 (PDF)
 */
async function generateClientReport(base44, user, templateId, entryType, clientId, dateFrom, dateTo) {
  try {
    // Step 1: Fetch source records
    const [template, mappings, client, timeEntries, allAnswers, authorizations] = await Promise.all([
      base44.entities.PDFTemplate.filter({ id: templateId }).then(r => r[0]),
      base44.entities.PDFFieldMap.filter({ pdf_template_id: templateId }),
      base44.entities.Client.filter({ id: clientId }).then(r => r[0]),
      base44.entities.TimeEntry.filter({
        client_id: clientId,
        date: { $gte: dateFrom, $lte: dateTo },
        entry_type_code: entryType  // Use code instead of id
      }),
      base44.entities.ReportFieldAnswer.list(),
      base44.entities.ServiceAuthorization.filter({ client_id: clientId })
    ]);

    // Validate
    if (!template) return { success: false, error: 'Template not found' };
    if (!client) return { success: false, error: 'Client not found' };
    if (!timeEntries.length) return { success: false, error: 'No entries found' };

    // Step 2: Assemble structured report (NEVER writes back to TimeEntry)
    const answersMap = {};
    allAnswers.forEach(a => {
      answersMap[a.time_entry_id] = a;
    });

    const authorization = authorizations.find(a =>
      a.status === 'active' &&
      a.service_type_code === entryType &&
      a.authorization_start_date <= dateFrom &&
      a.authorization_end_date >= dateTo
    );

    const report = assembleReport(timeEntries, answersMap, client, authorization, dateFrom, dateTo);

    // Step 3: Fill PDF from assembled report
    const pdfUrl = await fillAndUploadPDF(base44, template, mappings, report);

    // Save as Document record
    const document = await base44.entities.Document.create({
      client_id: clientId,
      title: `${entryType.toUpperCase()} Report - ${new Date(dateFrom).toLocaleDateString()} to ${new Date(dateTo).toLocaleDateString()}`,
      file_url: pdfUrl,
      file_name: `report-${entryType}-${clientId}.pdf`,
      category: 'reference',
      tags: [entryType, 'vr-report', new Date(dateFrom).getFullYear().toString()],
      notes: `Auto-generated ${new Date().toISOString()} by ${user.email}. ${timeEntries.length} entries.`
    });

    return {
      success: true,
      document_id: document.id,
      pdf_url: pdfUrl
    };
  } catch (e) {
    console.error(`Error generating report for ${clientId}:`, e);
    return { success: false, error: e.message };
  }
}

/**
 * Step 2: Assemble structured report from source records
 * NEVER writes back to TimeEntry
 */
function assembleReport(timeEntries, answersMap, client, authorization, dateFrom, dateTo) {
  const totalMin = timeEntries.reduce((sum, e) => sum + (e.duration_minutes || 0), 0);
  const sorted = [...timeEntries].sort((a, b) => a.date.localeCompare(b.date));

  const byEntryType = {};
  timeEntries.forEach(e => {
    const key = e.entry_type_code || 'unknown';
    if (!byEntryType[key]) byEntryType[key] = { count: 0, total_minutes: 0 };
    byEntryType[key].count++;
    byEntryType[key].total_minutes += e.duration_minutes || 0;
  });

  return {
    metadata: {
      client_id: client.id,
      generated_at: new Date().toISOString(),
      reporting_period_start: dateFrom,
      reporting_period_end: dateTo,
      total_entries: timeEntries.length
    },
    header: {
      client_first_name: client.first_name || '',
      client_last_name: client.last_name || '',
      client_full_name: `${client.first_name || ''} ${client.last_name || ''}`.trim(),
      client_email: client.email || '',
      client_phone: client.phone || '',
      client_address: client.address || '',
      reporting_period_start: dateFrom,
      reporting_period_end: dateTo,
      actual_period_start: sorted[0].date,
      actual_period_end: sorted[sorted.length - 1].date,
      total_entries: timeEntries.length,
      total_minutes: totalMin,
      total_hours: (totalMin / 60).toFixed(2),
      authorization_number: authorization?.authorization_number || '',
      vr_counselor_name: authorization?.vr_counselor_name || '',
      job_goal: authorization?.job_goal || '',
      employer_name: authorization?.employer_name || '',
      total_authorized_hours: authorization?.total_authorized_hours || 0,
      hours_used: authorization?.used_hours || 0,
      hours_remaining: authorization?.remaining_hours || 0,
      report_generated_date: new Date().toISOString().split('T')[0]
    },
    rows: timeEntries.map((entry, idx) => {
      const fieldAnswer = answersMap[entry.id];
      const answers = fieldAnswer?.answers || {};
      return {
        row_number: idx + 1,
        entry_id: entry.id,
        date: entry.date,
        duration_minutes: entry.duration_minutes || 0,
        duration_hours: ((entry.duration_minutes || 0) / 60).toFixed(2),
        start_time: entry.start_time || '',
        end_time: entry.end_time || '',
        entry_type_code: entry.entry_type_code || '',
        description: entry.description || '',
        general_notes: entry.general_notes || '',
        service_authorization_id: entry.service_authorization_id || '',
        ...answers
      };
    }),
    summary: {
      total_entries: timeEntries.length,
      total_minutes: totalMin,
      total_hours: (totalMin / 60).toFixed(2),
      average_hours_per_entry: ((totalMin / 60) / Math.max(timeEntries.length, 1)).toFixed(2),
      by_entry_type: Object.entries(byEntryType).reduce((acc, [k, v]) => {
        acc[k] = {
          count: v.count,
          total_minutes: v.total_minutes,
          total_hours: (v.total_minutes / 60).toFixed(2)
        };
        return acc;
      }, {}),
      authorization_hours_used: authorization?.used_hours || 0,
      authorization_hours_remaining: authorization?.remaining_hours || 0
    }
  };
}

/**
 * Step 3: Fill PDF from assembled report
 */
async function fillAndUploadPDF(base44, template, mappings, report) {
  const pdfRes = await fetch(template.pdf_file_url);
  if (!pdfRes.ok) throw new Error('Failed to fetch PDF template');

  const pdfBytes = await pdfRes.arrayBuffer();
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const form = pdfDoc.getForm();

  fillPDFFromAssembledReport(form, mappings, report);

  form.flatten();
  const filledBytes = await pdfDoc.save();

  // Convert to blob for upload
  const base64 = btoa(String.fromCharCode(...new Uint8Array(filledBytes)));
  const dataUrl = `data:application/pdf;base64,${base64}`;

  const { file_url } = await base44.integrations.Core.UploadFile({ file: dataUrl });
  return file_url;
}

/**
 * Fill PDF fields from assembled report object
 */
function fillPDFFromAssembledReport(form, mappings, report) {
  const fields = form.getFields();
  const fieldNames = fields.map(f => f.getName());

  // Separate header/summary from repeating fields
  const headerSummary = mappings.filter(m => !m.is_repeating_field);
  const repeating = mappings.filter(m => m.is_repeating_field);

  // Fill header and summary fields
  headerSummary.forEach(mapping => {
    const { source_type, source_field, pdf_field_name, transform, default_value } = mapping;

    let value = null;
    if (source_type === 'header') {
      value = report.header?.[source_field];
    } else if (source_type === 'summary') {
      value = report.summary?.[source_field];
    }

    if (value === null || value === undefined) {
      value = default_value || '';
    }

    if (transform && transform !== 'none') {
      value = applyTransformValue(value, transform);
    }

    if (fieldNames.includes(pdf_field_name)) {
      try {
        form.getField(pdf_field_name).setText(String(value || ''));
      } catch (e) {
        console.warn(`Could not fill ${pdf_field_name}: ${e.message}`);
      }
    }
  });

  // Fill repeating row fields
  repeating.forEach(mapping => {
    const { source_field, pdf_field_name, transform, default_value, row_group } = mapping;

    (report.rows || []).forEach((row, rowIndex) => {
      let value = row[source_field] || default_value || '';

      if (transform && transform !== 'none') {
        value = applyTransformValue(value, transform);
      }

      const actualFieldName = pdf_field_name
        .replace(/\{\{row(Num)?\}\}/gi, rowIndex + 1)
        .replace(/\{row(Num)?\}/gi, rowIndex + 1);

      if (fieldNames.includes(actualFieldName)) {
        try {
          form.getField(actualFieldName).setText(String(value || ''));
        } catch (e) {
          console.warn(`Could not fill ${actualFieldName}: ${e.message}`);
        }
      }
    });
  });
}

/**
 * Apply transform to value
 */
function applyTransformValue(value, transform) {
  if (!transform || transform === 'none') return value;

  switch (transform) {
    case 'date_format':
      try {
        const d = new Date(value);
        const m = (d.getMonth() + 1).toString().padStart(2, '0');
        const day = d.getDate().toString().padStart(2, '0');
        const y = d.getFullYear();
        return `${m}/${day}/${y}`;
      } catch {
        return value;
      }
    case 'time_format':
      const totalMin = parseInt(value);
      const hrs = Math.floor(totalMin / 60);
      const mins = totalMin % 60;
      return `${hrs}:${mins.toString().padStart(2, '0')}`;
    case 'hours_from_minutes':
    case 'duration_hours':
      return String((Number(value) / 60).toFixed(2));
    case 'uppercase':
      return String(value).toUpperCase();
    case 'full_name':
      return value?.full_name || String(value);
    default:
      return value;
  }
}