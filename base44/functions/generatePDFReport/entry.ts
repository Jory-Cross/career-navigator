import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { PDFDocument } from 'npm:pdf-lib@1.17.1';

// Note: pdfFieldMapper is available via integration call or inline logic
// For Deno, we'll handle mapping inline since local imports not supported

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
 * Supports new mapping_scope structure (header, row, summary, static)
 */
function fillPDFFromReport(form, fieldMaps, report) {
  const fields = form.getFields();
  const fieldNames = fields.map(f => f.getName());

  // Build field instructions from new mapping structure
  const instructions = buildFieldInstructions(fieldMaps, report);

  // Fill PDF fields
  Object.entries(instructions).forEach(([pdfFieldName, instruction]) => {
    if (!fieldNames.includes(pdfFieldName)) {
      return;
    }
    try {
      form.getField(pdfFieldName).setText(String(instruction.value || ''));
    } catch (e) {
      console.warn(`Could not fill ${pdfFieldName}: ${e.message}`);
    }
  });
}

/**
 * Build field instructions from new mapping structure
 * Supports mapping_scope (header/row/summary/static) and row groups
 */
function buildFieldInstructions(fieldMaps, report) {
  const instructions = {};

  // Filter active mappings
  const activeMappings = fieldMaps.filter(m => m.is_active !== false);

  // Group by mapping_scope (support both new and legacy structure)
  const byScope = {
    static: activeMappings.filter(m => m.mapping_scope === 'static'),
    header: activeMappings.filter(m => m.mapping_scope === 'header' || (m.source_type === 'header' && !m.is_repeating_field)),
    row: activeMappings.filter(m => m.mapping_scope === 'row' || m.is_repeating_field),
    summary: activeMappings.filter(m => m.mapping_scope === 'summary' || m.source_type === 'summary')
  };

  // Fill static values
  byScope.static.forEach(m => {
    instructions[m.pdf_field_name] = { value: String(m.default_value || '') };
  });

  // Fill header fields
  byScope.header.forEach(m => {
    const value = resolveValue(m.source_field, report.header || {});
    const transformed = value !== null ? applyTransformAdvanced(value, m) : (m.default_value || '');
    instructions[m.pdf_field_name] = { value: String(transformed || '') };
  });

  // Fill summary fields
  byScope.summary.forEach(m => {
    const value = resolveValue(m.source_field, report.summary || {});
    const transformed = value !== null ? applyTransformAdvanced(value, m) : (m.default_value || '');
    instructions[m.pdf_field_name] = { value: String(transformed || '') };
  });

  // Fill row fields (grouped by row_group)
  const rowsByGroup = {};
  byScope.row.forEach(m => {
    const group = m.row_group || 'default';
    if (!rowsByGroup[group]) rowsByGroup[group] = [];
    rowsByGroup[group].push(m);
  });

  Object.entries(rowsByGroup).forEach(([rowGroup, groupMappings]) => {
    const rows = report.rows || [];
    const maxRows = groupMappings[0]?.max_rows || rows.length;

    rows.slice(0, maxRows).forEach((row, rowIdx) => {
      groupMappings.forEach(m => {
        const value = row[m.source_field];
        const transformed = value !== null && value !== undefined ? applyTransformAdvanced(value, m) : (m.default_value || '');
        const pdfFieldName = substituteRowIndex(m.pdf_field_name, rowIdx);
        instructions[pdfFieldName] = { value: String(transformed || '') };
      });
    });
  });

  return instructions;
}

/**
 * Resolve dot-path value from object (e.g., 'client.first_name')
 */
function resolveValue(path, obj) {
  const parts = path.split('.');
  let value = obj;
  for (const part of parts) {
    value = value?.[part];
    if (value === null || value === undefined) return null;
  }
  return value;
}

/**
 * Substitute {{row}} or {row} pattern in PDF field name
 */
function substituteRowIndex(template, rowIdx) {
  const rowNum = rowIdx + 1;
  return template
    .replace(/\{\{row(Num)?\}\}/gi, String(rowNum))
    .replace(/\{row(Num)?\}/gi, String(rowNum));
}

/**
 * Apply transform to value (supports new transform_options structure)
 */
function applyTransformAdvanced(value, mapping) {
  if (!mapping.transform || mapping.transform === 'none') return value;

  const { transform, transform_options = {} } = mapping;

  switch (transform) {
    case 'date_format': {
      try {
        const d = new Date(value);
        const format = transform_options.format || 'MM/DD/YYYY';
        const m = (d.getMonth() + 1).toString().padStart(2, '0');
        const day = d.getDate().toString().padStart(2, '0');
        const y = d.getFullYear();
        if (format === 'MM/DD/YYYY') return `${m}/${day}/${y}`;
        if (format === 'YYYY-MM-DD') return `${y}-${m}-${day}`;
        if (format === 'MMM DD, YYYY') {
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          return `${months[d.getMonth()]} ${day}, ${y}`;
        }
        return value;
      } catch {
        return value;
      }
    }
    case 'time_format': {
      const totalMin = parseInt(value);
      if (isNaN(totalMin)) return value;
      const hrs = Math.floor(totalMin / 60);
      const mins = totalMin % 60;
      return `${hrs}:${mins.toString().padStart(2, '0')}`;
    }
    case 'hours_from_minutes':
    case 'duration_hours':
      return String((Number(value) / 60).toFixed(2));
    case 'uppercase':
      return String(value).toUpperCase();
    case 'currency': {
      const num = parseFloat(value);
      return isNaN(num) ? value : `$${num.toFixed(2)}`;
    }
    case 'phone_format': {
      const digits = String(value).replace(/\D/g, '');
      return digits.length === 10 ? `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}` : value;
    }
    case 'full_name':
      return value?.full_name || String(value);
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