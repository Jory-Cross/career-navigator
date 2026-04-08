import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { PDFDocument } from 'npm:pdf-lib@1.17.1';

/**
 * generateVRBatchReports
 *
 * Production-safe batch PDF generation:
 * 1. Fetch per-client data (filtered at query time)
 * 2. Assemble structured report { header, rows, summary, totals }
 * 3. Fill PDF using row-aware mapping_scope (header | row | summary | static)
 * 4. Save ReportVersion + Document records with full audit metadata
 * 5. Partial failures tracked per client; batch status: completed | partial | failed
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { pdf_template_id, entry_type, client_ids, date_from, date_to } = await req.json();

    if (!pdf_template_id || !entry_type || !client_ids?.length || !date_from || !date_to) {
      return Response.json({
        error: 'Missing required: pdf_template_id, entry_type, client_ids, date_from, date_to'
      }, { status: 400 });
    }

    // Fetch shared resources once
    const [template, mappings] = await Promise.all([
      base44.entities.PDFTemplate.filter({ id: pdf_template_id }).then(r => r[0]),
      base44.entities.PDFFieldMap.filter({ pdf_template_id, is_active: true })
    ]);

    if (!template) return Response.json({ error: 'PDF template not found' }, { status: 404 });

    // Create ReportBatch
    const batch = await base44.entities.ReportBatch.create({
      pdf_template_id,
      entry_type,
      date_range_start: date_from,
      date_range_end: date_to,
      client_ids,
      status: 'processing',
      created_by: user.email,
      created_at: new Date().toISOString()
    });

    const results = [];

    for (const clientId of client_ids) {
      try {
        const result = await processClient({
          base44, user, template, mappings,
          clientId, entry_type, date_from, date_to, batch_id: batch.id
        });
        results.push({ client_id: clientId, ...result });
      } catch (err) {
        console.error(`[batch ${batch.id}] client ${clientId} error:`, err.message);
        results.push({ client_id: clientId, status: 'failed', error: err.message });
      }
    }

    const succeeded = results.filter(r => r.status === 'success').length;
    const failed    = results.filter(r => r.status === 'failed').length;
    const skipped   = results.filter(r => r.status === 'skipped').length;

    const batchStatus = failed === 0 ? 'completed'
                      : succeeded === 0 ? 'failed'
                      : 'partial';

    await base44.entities.ReportBatch.update(batch.id, {
      status: batchStatus,
      generated_documents: results
    });

    return Response.json({
      batch_id: batch.id,
      status: batchStatus,
      total: client_ids.length,
      succeeded,
      failed,
      skipped,
      results
    });

  } catch (error) {
    console.error('generateVRBatchReports fatal error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// ─── Per-client processing ────────────────────────────────────────────────────

async function processClient({ base44, user, template, mappings, clientId, entry_type, date_from, date_to, batch_id }) {
  // 1. Fetch all per-client data (filtered at query time)
  const [client, timeEntries, authorizations] = await Promise.all([
    base44.entities.Client.filter({ id: clientId }).then(r => r[0] || null),
    base44.entities.TimeEntry.filter({ client_id: clientId, entry_type_code: entry_type }),
    base44.entities.ServiceAuthorization.filter({ client_id: clientId })
  ]);

  if (!client)  return { status: 'failed', error: 'Client not found' };

  // Date filter (SDK may not support range natively)
  const entries = timeEntries.filter(e => e.date >= date_from && e.date <= date_to);
  if (entries.length === 0) return { status: 'skipped', reason: 'No entries in period' };

  // Fetch field answers only for matched entries
  const fieldAnswers = await base44.entities.ReportFieldAnswer.filter({ entry_type_code: entry_type });
  const answersMap = {};
  fieldAnswers.forEach(a => { answersMap[a.time_entry_id] = a; });

  const authMap = {};
  authorizations.forEach(a => { authMap[a.id] = a; });

  // Find best matching authorization
  const authorization = authorizations.find(a =>
    a.status === 'active' &&
    (a.service_type_code === entry_type || a.service_type_code === null) &&
    a.authorization_start_date <= date_from &&
    a.authorization_end_date >= date_to
  ) || authorizations.find(a => a.status === 'active') || null;

  // 2. Assemble structured report (read-only)
  const report = assembleReport(client, entries, answersMap, authorization, date_from, date_to);

  // 3. Fill PDF using row-aware mapping
  const pdfUrl = await fillAndUploadPDF(base44, template, mappings, report);

  const generatedAt = new Date().toISOString();
  const fileName    = `${entry_type}-report-${client.last_name}-${date_from}-${date_to}.pdf`;
  const title       = `${entry_type.replace(/_/g, ' ').toUpperCase()} — ${client.first_name} ${client.last_name} (${date_from} to ${date_to})`;

  // 4. Count existing versions for this client/type/period (for version_number)
  const existingVersions = await base44.entities.ReportVersion.filter({
    client_id: clientId,
    entry_type_code: entry_type
  });
  const periodVersions = existingVersions.filter(v =>
    v.report_start_date === date_from && v.report_end_date === date_to
  );
  const versionNumber = periodVersions.length + 1;
  const supersedes = periodVersions.length > 0
    ? periodVersions.sort((a, b) => b.version_number - a.version_number)[0].id
    : null;

  // 5. Save ReportVersion (audit record)
  const reportVersion = await base44.entities.ReportVersion.create({
    client_id: clientId,
    entry_type_code: entry_type,
    template_id: template.id,
    template_version: template.version || 'v1',
    report_start_date: date_from,
    report_end_date: date_to,
    included_time_entry_ids: entries.map(e => e.id),
    included_answer_record_ids: entries.map(e => answersMap[e.id]?.id).filter(Boolean),
    time_entry_count: entries.length,
    total_hours: parseFloat(report.totals.total_hours),
    generated_file_url: pdfUrl,
    generated_file_name: fileName,
    version_number: versionNumber,
    supersedes_report_id: supersedes,
    generated_at: generatedAt,
    generated_by: user.email,
    locked: false,
    is_final: false
  });

  // 6. Save Document record (for client file view + versioning)
  const document = await base44.entities.Document.create({
    client_id: clientId,
    title,
    file_url: pdfUrl,
    file_name: fileName,
    category: 'vr_report',
    document_subtype: `${entry_type}_report`,
    source_type: 'generated',
    source_id: reportVersion.id,
    is_generated: true,
    generated_from_template_id: template.id,
    report_batch_id: batch_id,
    report_version: versionNumber,
    reporting_period_start: date_from,
    reporting_period_end: date_to,
    tags: [entry_type, 'vr-report'],
    notes: `Generated by batch ${batch_id} — ${entries.length} entries, v${versionNumber}`
  });

  return {
    status: 'success',
    document_id: document.id,
    report_version_id: reportVersion.id,
    pdf_url: pdfUrl,
    version_number: versionNumber,
    entry_count: entries.length,
    total_hours: report.totals.total_hours
  };
}

// ─── Report Assembly ──────────────────────────────────────────────────────────

function assembleReport(client, entries, answersMap, authorization, dateFrom, dateTo) {
  const sorted     = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const totalMin   = entries.reduce((s, e) => s + (e.duration_minutes || 0), 0);
  const totalHours = (totalMin / 60).toFixed(2);

  // Summary by entry type
  const byType = {};
  entries.forEach(e => {
    const k = e.entry_type_code || 'other';
    if (!byType[k]) byType[k] = { count: 0, total_minutes: 0 };
    byType[k].count++;
    byType[k].total_minutes += e.duration_minutes || 0;
  });

  const header = {
    client_id:              client.id,
    client_first_name:      client.first_name || '',
    client_last_name:       client.last_name || '',
    client_full_name:       `${client.first_name || ''} ${client.last_name || ''}`.trim(),
    client_email:           client.email || '',
    client_phone:           client.phone || '',
    client_address:         client.address || '',
    reporting_period_start: dateFrom,
    reporting_period_end:   dateTo,
    actual_period_start:    sorted[0]?.date || dateFrom,
    actual_period_end:      sorted[sorted.length - 1]?.date || dateTo,
    total_entries:          entries.length,
    total_hours:            totalHours,
    authorization_number:   authorization?.authorization_number || '',
    vr_counselor_name:      authorization?.vr_counselor_name || '',
    job_goal:               authorization?.job_goal || '',
    employer_name:          authorization?.employer_name || '',
    total_authorized_hours: authorization?.total_authorized_hours || 0,
    hours_used:             authorization?.used_hours || 0,
    hours_remaining:        authorization?.remaining_hours || 0,
    report_generated_date:  new Date().toISOString().split('T')[0]
  };

  const rows = sorted.map((entry, idx) => {
    const answers = answersMap[entry.id]?.answers || {};
    return {
      row_number:           idx + 1,
      entry_id:             entry.id,
      date:                 entry.date,
      start_time:           entry.start_time || '',
      end_time:             entry.end_time || '',
      duration_minutes:     entry.duration_minutes || 0,
      duration_hours:       ((entry.duration_minutes || 0) / 60).toFixed(2),
      entry_type_code:      entry.entry_type_code || '',
      description:          entry.description || '',
      service_authorization_id: entry.service_authorization_id || '',
      ...answers
    };
  });

  const summary = {
    total_entries:    entries.length,
    total_minutes:    totalMin,
    total_hours:      totalHours,
    by_entry_type:    Object.fromEntries(
      Object.entries(byType).map(([k, v]) => [k, {
        count: v.count,
        total_hours: (v.total_minutes / 60).toFixed(2)
      }])
    ),
    authorization_hours_used:      authorization?.used_hours || 0,
    authorization_hours_remaining: authorization?.remaining_hours || 0
  };

  return {
    header,
    rows,
    summary,
    totals: { entry_count: entries.length, total_minutes: totalMin, total_hours: totalHours }
  };
}

// ─── PDF Filling ──────────────────────────────────────────────────────────────

async function fillAndUploadPDF(base44, template, mappings, report) {
  const pdfRes = await fetch(template.pdf_file_url);
  if (!pdfRes.ok) throw new Error(`Failed to fetch PDF template: ${pdfRes.status}`);

  const pdfBytes = await pdfRes.arrayBuffer();
  const pdfDoc   = await PDFDocument.load(pdfBytes);
  const form     = pdfDoc.getForm();
  const fields   = new Set(form.getFields().map(f => f.getName()));

  const setField = (name, value) => {
    if (!fields.has(name)) return;
    try { form.getField(name).setText(String(value ?? '')); }
    catch (e) { console.warn(`PDF field "${name}":`, e.message); }
  };

  // Group mappings by scope
  const headerMappings  = mappings.filter(m => m.mapping_scope === 'header'  || (!m.mapping_scope && m.source_type === 'header'));
  const summaryMappings = mappings.filter(m => m.mapping_scope === 'summary' || (!m.mapping_scope && m.source_type === 'summary'));
  const staticMappings  = mappings.filter(m => m.mapping_scope === 'static');
  const rowMappings     = mappings.filter(m => m.mapping_scope === 'row'     || m.is_repeating_field);

  // Fill header fields
  headerMappings.forEach(m => {
    const value = resolveValue(report.header, m.source_field, m.default_value);
    setField(m.pdf_field_name, applyTransform(value, m.transform));
  });

  // Fill summary fields
  summaryMappings.forEach(m => {
    const value = resolveValue(report.summary, m.source_field, m.default_value);
    setField(m.pdf_field_name, applyTransform(value, m.transform));
  });

  // Fill static fields
  staticMappings.forEach(m => {
    setField(m.pdf_field_name, m.default_value || '');
  });

  // Fill repeating row fields
  // Group row mappings by row_group (or treat as flat list)
  const rowGroups = {};
  rowMappings.forEach(m => {
    const g = m.row_group || 'default';
    if (!rowGroups[g]) rowGroups[g] = [];
    rowGroups[g].push(m);
  });

  Object.values(rowGroups).forEach(groupMappings => {
    report.rows.forEach((row, rowIdx) => {
      groupMappings.forEach(m => {
        const value = resolveValue(row, m.row_field_key || m.source_field, m.default_value);
        const fieldName = m.pdf_field_name
          .replace(/\{\{row(Num|Index)?\}\}/gi, rowIdx + 1)
          .replace(/\{row(Num|Index)?\}/gi, rowIdx + 1)
          .replace(/_\d+$/, `_${rowIdx + 1}`); // e.g. Date_1 → Date_2
        setField(fieldName, applyTransform(value, m.transform));
      });
    });
  });

  form.flatten();
  const filledBytes = await pdfDoc.save();

  const base64  = btoa(String.fromCharCode(...new Uint8Array(filledBytes)));
  const dataUrl = `data:application/pdf;base64,${base64}`;
  const { file_url } = await base44.integrations.Core.UploadFile({ file: dataUrl });
  return file_url;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveValue(obj, path, defaultValue = '') {
  if (!path || !obj) return defaultValue;
  const parts = path.split('.');
  let val = obj;
  for (const p of parts) {
    val = val?.[p];
    if (val === undefined || val === null) return defaultValue;
  }
  return val ?? defaultValue;
}

function applyTransform(value, transform) {
  if (!transform || transform === 'none') return value;
  switch (transform) {
    case 'date_format': {
      try {
        const d = new Date(value);
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${m}/${day}/${d.getFullYear()}`;
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