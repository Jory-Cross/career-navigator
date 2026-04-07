import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { PDFDocument } from 'npm:pdf-lib@1.17.1';

/**
 * Generate PDF Report - Step 3 Only
 * 
 * Takes assembled report object and fills PDF template
 * Never reads directly from TimeEntry or raw records
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const {
      action,
      templateId,
      reportObject,        // Pre-assembled report from assembleClientReport()
      clientId,
      dateFrom,
      dateTo
    } = await req.json();

    if (!templateId) {
      return Response.json({ error: 'templateId is required' }, { status: 400 });
    }

    // Fetch template and field mappings
    const [templates, fieldMaps] = await Promise.all([
      base44.entities.PDFTemplate.filter({ id: templateId }),
      base44.entities.PDFFieldMap.filter({ pdf_template_id: templateId })
    ]);

    const template = templates[0];
    if (!template) {
      return Response.json({ error: 'Template not found' }, { status: 404 });
    }

    // If no pre-assembled report, assemble it now (Step 2)
    let report = reportObject;
    if (!report) {
      if (!clientId || !dateFrom || !dateTo) {
        return Response.json(
          { error: 'Either reportObject or (clientId, dateFrom, dateTo) required' },
          { status: 400 }
        );
      }
      // Inline simple assembly for backward compatibility
      report = await quickAssembleReport(base44, clientId, dateFrom, dateTo);
    }

    if (!report) {
      return Response.json({ error: 'No data to report' }, { status: 400 });
    }

    // Step 3: Fill PDF from assembled report object
    const pdfUrl = await fillAndUploadPDF(base44, template, fieldMaps, report);

    return Response.json({ 
      success: true,
      pdf_url: pdfUrl,
      client_id: report.metadata?.client_id
    });
  } catch (error) {
    console.error('generatePDFReport error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Fill PDF template from assembled report object
 * Step 3: PDF Generation only
 */
async function fillAndUploadPDF(base44, template, fieldMaps, report) {
  // Fetch template PDF
  const pdfRes = await fetch(template.pdf_file_url);
  if (!pdfRes.ok) {
    throw new Error(`Failed to fetch PDF template: ${pdfRes.status}`);
  }

  const pdfBytes = await pdfRes.arrayBuffer();
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const form = pdfDoc.getForm();

  // Fill all fields from report object
  fillPDFFromReport(form, fieldMaps, report);

  // Flatten and save
  form.flatten();
  const filledBytes = await pdfDoc.save();

  // Upload
  const blob = new Blob([filledBytes], { type: 'application/pdf' });
  const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file: blob });

  return file_url;
}

/**
 * Fill PDF fields from assembled report object
 */
function fillPDFFromReport(form, fieldMaps, report) {
  const fields = form.getFields();
  const fieldNames = fields.map(f => f.getName());

  fieldMaps.forEach(mapping => {
    const { source_type, source_field, pdf_field_name, transform, default_value, is_repeating_field } = mapping;

    if (is_repeating_field) {
      // Handle repeating fields separately
      fillRepeatingFields(form, fieldNames, report.rows || [], mapping);
      return;
    }

    // Get value from report object
    let value = null;

    if (source_type === 'header') {
      value = report.header?.[source_field];
    } else if (source_type === 'summary') {
      value = report.summary?.[source_field];
    }

    if (value === null || value === undefined) {
      value = default_value || '';
    }

    // Apply transform
    if (transform) {
      value = applyTransform(value, transform);
    }

    // Set field
    if (fieldNames.includes(pdf_field_name)) {
      try {
        const field = form.getField(pdf_field_name);
        field.setText(String(value || ''));
      } catch (e) {
        console.warn(`Could not fill ${pdf_field_name}: ${e.message}`);
      }
    }
  });
}

/**
 * Fill repeating row fields
 */
function fillRepeatingFields(form, fieldNames, rows, mapping) {
  rows.forEach((row, rowIndex) => {
    const { source_field, pdf_field_name, transform, default_value } = mapping;

    let value = row[source_field] || default_value || '';

    if (transform) {
      value = applyTransform(value, transform);
    }

    // Substitute row index in field name
    const actualFieldName = pdf_field_name
      .replace(/\{\{row(Num)?\}\}/gi, rowIndex + 1)
      .replace(/\{row(Num)?\}/gi, rowIndex + 1);

    if (fieldNames.includes(actualFieldName)) {
      try {
        const field = form.getField(actualFieldName);
        field.setText(String(value || ''));
      } catch (e) {
        console.warn(`Could not fill ${actualFieldName}: ${e.message}`);
      }
    }
  });
}

/**
 * Apply transform to value
 */
function applyTransform(value, transform) {
  if (!transform || transform === 'none') return value;

  switch (transform) {
    case 'date_format':
      try {
        const d = new Date(value);
        return `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}/${d.getFullYear()}`;
      } catch {
        return value;
      }
    case 'hours_from_minutes':
    case 'duration_hours':
      return String((Number(value) / 60).toFixed(2));
    case 'uppercase':
      return String(value).toUpperCase();
    default:
      return value;
  }
}

/**
 * Quick assembly helper for backward compatibility
 */
async function quickAssembleReport(base44, clientId, dateFrom, dateTo) {
  const [client, timeEntries, fieldAnswers] = await Promise.all([
    base44.entities.Client.filter({ id: clientId }).then(r => r[0]),
    base44.entities.TimeEntry.filter({ client_id: clientId, date: { $gte: dateFrom, $lte: dateTo } }),
    base44.entities.ReportFieldAnswer.list()
  ]);

  if (!client || timeEntries.length === 0) return null;

  const answersMap = {};
  fieldAnswers.forEach(fa => {
    answersMap[fa.time_entry_id] = fa;
  });

  const dateRange = getDateRange(timeEntries);
  const totalMin = timeEntries.reduce((sum, e) => sum + (e.duration_minutes || 0), 0);

  return {
    metadata: { client_id: clientId, generated_at: new Date().toISOString() },
    header: {
      client_full_name: `${client.first_name || ''} ${client.last_name || ''}`.trim(),
      client_email: client.email || '',
      client_phone: client.phone || '',
      reporting_period_start: dateFrom,
      reporting_period_end: dateTo,
      total_entries: timeEntries.length,
      total_hours: (totalMin / 60).toFixed(2),
      total_minutes: totalMin
    },
    rows: timeEntries.map((e, i) => ({
      row_number: i + 1,
      date: e.date,
      duration_minutes: e.duration_minutes || 0,
      duration_hours: ((e.duration_minutes || 0) / 60).toFixed(2),
      entry_type_code: e.entry_type_code || '',
      description: e.description || '',
      ...(answersMap[e.id]?.answers || {})
    })),
    summary: {
      total_entries: timeEntries.length,
      total_hours: (totalMin / 60).toFixed(2),
      total_minutes: totalMin
    }
  };
}

function getDateRange(timeEntries) {
  if (!timeEntries.length) return { start: '', end: '' };
  const sorted = [...timeEntries].sort((a, b) => a.date.localeCompare(b.date));
  return { start: sorted[0].date, end: sorted[sorted.length - 1].date };
}