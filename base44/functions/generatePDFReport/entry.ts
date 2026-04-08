import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { PDFDocument } from 'npm:pdf-lib@1.17.1';

/**
 * generatePDFReport
 *
 * Generates a PDF from ONLY pre-assembled report data.
 * Never queries TimeEntry, ReportFieldAnswer, or other source entities directly.
 * PDF field values come exclusively from:
 *   - assembled.header (client, authorization, period metadata)
 *   - assembled.rows (repeating entries, sorted by date)
 *   - assembled.summary (aggregations by entry type/employer/field)
 *
 * Input:
 *   templateId    – PDFTemplate record ID
 *   assembled     – { metadata, header, rows, summary, totals, included_* } from assembleClientReport
 *
 * Output:
 *   { success, pdf_url }
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { templateId, assembled } = await req.json();

    if (!templateId)  return Response.json({ error: 'templateId is required' }, { status: 400 });
    if (!assembled)   return Response.json({ error: 'assembled report data is required' }, { status: 400 });
    if (!assembled.header || !assembled.rows === undefined || !assembled.summary) {
      return Response.json({ error: 'assembled must have header, rows, and summary' }, { status: 400 });
    }

    const [templates, fieldMaps] = await Promise.all([
      base44.entities.PDFTemplate.filter({ id: templateId }),
      base44.entities.PDFFieldMap.filter({ pdf_template_id: templateId })
    ]);

    const template = templates[0];
    if (!template) return Response.json({ error: 'Template not found' }, { status: 404 });

    const activeMaps = fieldMaps.filter(m => m.is_active !== false);

    const pdf_url = await fillAndUploadPDF(base44, template, activeMaps, assembled);

    return Response.json({ success: true, pdf_url, metadata: assembled.metadata });

  } catch (error) {
    console.error('generatePDFReport error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// ─── PDF Fill + Upload ────────────────────────────────────────────────────────

/**
 * Fill PDF form using ONLY assembled report data
 * @param {Object} base44 - SDK client
 * @param {Object} template - PDFTemplate record
 * @param {Array} fieldMaps - PDFFieldMap records (active only)
 * @param {Object} assembled - { metadata, header, rows, summary, totals, ... }
 */
async function fillAndUploadPDF(base44, template, fieldMaps, assembled) {
  const pdfRes = await fetch(template.pdf_file_url);
  if (!pdfRes.ok) throw new Error(`Failed to fetch PDF template: ${pdfRes.status}`);

  const pdfDoc = await PDFDocument.load(await pdfRes.arrayBuffer(), { ignoreEncryption: true });
  const form   = pdfDoc.getForm();
  const fields = new Set(form.getFields().map(f => f.getName()));

  const setField = (name, value) => {
    if (!fields.has(name)) return;
    try { form.getField(name).setText(String(value ?? '')); }
    catch (e) { console.warn(`PDF field "${name}": ${e.message}`); }
  };

  // Split by scope
  const byScope = {
    static:  fieldMaps.filter(m => m.mapping_scope === 'static'),
    header:  fieldMaps.filter(m => m.mapping_scope === 'header'),
    summary: fieldMaps.filter(m => m.mapping_scope === 'summary'),
    row:     fieldMaps.filter(m => m.mapping_scope === 'row')
  };

  // Static values (hardcoded in mapping)
  byScope.static.forEach(m => {
    setField(m.pdf_field_name, m.static_value ?? m.default_value ?? '');
  });

  // Header fields (pulled from assembled.header)
  byScope.header.forEach(m => {
    const val = resolveValue(assembled.header || {}, m.source_field, m.default_value);
    setField(m.pdf_field_name, applyTransform(val, m));
  });

  // Summary fields (pulled from assembled.summary)
  byScope.summary.forEach(m => {
    const val = resolveValue(assembled.summary || {}, m.source_field, m.default_value);
    setField(m.pdf_field_name, applyTransform(val, m));
  });

  // Row fields (repeating, one per assembled.rows entry, sorted by date)
  const rowGroups = {};
  byScope.row.forEach(m => {
    const g = m.row_group || 'default';
    if (!rowGroups[g]) rowGroups[g] = [];
    rowGroups[g].push(m);
  });

  const rows = assembled.rows || [];
  Object.values(rowGroups).forEach(groupMappings => {
    rows.forEach((row, rowIdx) => {
      groupMappings.forEach(m => {
        const key = m.row_field_key || m.source_field;
        const val = resolveValue(row, key, m.default_value);
        const fieldName = substituteRowNumber(m.pdf_field_name, rowIdx + 1);
        setField(fieldName, applyTransform(val, m));
      });
    });
  });

  form.flatten();
  const filledBytes = await pdfDoc.save();

  // Upload as base64 data URL (Deno-safe)
  const base64  = btoa(String.fromCharCode(...new Uint8Array(filledBytes)));
  const dataUrl = `data:application/pdf;base64,${base64}`;
  const { file_url } = await base44.integrations.Core.UploadFile({ file: dataUrl });
  return file_url;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveValue(obj, path, defaultValue = '') {
  if (!path || !obj) return defaultValue;
  let val = obj;
  for (const part of path.split('.')) {
    val = val?.[part];
    if (val === undefined || val === null) return defaultValue;
  }
  return val ?? defaultValue;
}

function substituteRowNumber(template, rowNum) {
  return template
    .replace(/\{\{row(Num)?\}\}/gi, String(rowNum))
    .replace(/\{row(Num)?\}/gi, String(rowNum))
    .replace(/_\d+$/, `_${rowNum}`); // e.g. Date_1 → Date_2
}

function applyTransform(value, mapping) {
  const transform = mapping?.transform;
  if (!transform || transform === 'none') return value;
  const opts = mapping.transform_options || {};

  switch (transform) {
    case 'date_format': {
      try {
        const d   = new Date(value);
        const fmt = opts.format || 'MM/DD/YYYY';
        const m   = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const y   = d.getFullYear();
        if (fmt === 'MM/DD/YYYY')    return `${m}/${day}/${y}`;
        if (fmt === 'YYYY-MM-DD')    return `${y}-${m}-${day}`;
        if (fmt === 'MMM DD, YYYY') {
          const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
          return `${months[d.getMonth()]} ${day}, ${y}`;
        }
        return value;
      } catch { return value; }
    }
    case 'time_format': {
      const min = parseInt(value);
      if (isNaN(min)) return value;
      return `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`;
    }
    case 'hours_from_minutes':
    case 'duration_hours':
      return (Number(value) / 60).toFixed(2);
    case 'uppercase':
      return String(value).toUpperCase();
    case 'full_name':
      return value?.full_name || String(value);
    default:
      return value;
  }
}