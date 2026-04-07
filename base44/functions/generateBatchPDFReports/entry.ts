import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { PDFDocument } from 'npm:pdf-lib@1.17.1';

async function fillPDFForClient({ pdfBytes, fieldMaps, timeEntry, reportAnswers, client, employee }) {
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const form = pdfDoc.getForm();
  const fieldNames = form.getFields().map(f => f.getName());

  const dataMap = {
    time_entry: {
      date: timeEntry?.date || '',
      duration_minutes: timeEntry?.duration_minutes?.toString() || '',
      hours: timeEntry ? String(Math.round(timeEntry.duration_minutes / 60 * 10) / 10) : '',
      start_time: timeEntry?.start_time || '',
      end_time: timeEntry?.end_time || '',
      description: timeEntry?.description || '',
      category: timeEntry?.category || '',
    },
    report_answer: reportAnswers?.answers || {},
    client: {
      first_name: client?.first_name || '',
      last_name: client?.last_name || '',
      full_name: client ? `${client.first_name} ${client.last_name}` : '',
      email: client?.email || '',
      phone: client?.phone || '',
      address: client?.address || '',
      client_type: client?.client_type || '',
    },
    employee: {
      full_name: employee?.full_name || '',
      email: employee?.email || '',
      title: employee?.title || '',
      phone: employee?.phone || '',
    },
  };

  for (const map of fieldMaps) {
    const { source_type, source_field, pdf_field_name, transform, default_value } = map;
    let rawValue = dataMap[source_type]?.[source_field] ?? default_value ?? '';

    if (transform === 'date_format' && rawValue) {
      try {
        const d = new Date(rawValue);
        rawValue = `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
      } catch { /* keep raw */ }
    } else if (transform === 'hours_from_minutes' && rawValue) {
      rawValue = String(Math.round(Number(rawValue) / 60 * 10) / 10);
    } else if (transform === 'uppercase' && rawValue) {
      rawValue = rawValue.toUpperCase();
    } else if (transform === 'full_name' && source_type === 'client') {
      rawValue = dataMap.client.full_name;
    }

    const value = String(rawValue);
    if (!fieldNames.includes(pdf_field_name)) continue;

    try {
      const field = form.getField(pdf_field_name);
      const fieldType = field.constructor.name;
      if (fieldType === 'PDFTextField') {
        form.getTextField(pdf_field_name).setText(value);
      } else if (fieldType === 'PDFCheckBox') {
        if (['true', '1', 'yes'].includes(value.toLowerCase())) {
          form.getCheckBox(pdf_field_name).check();
        } else {
          form.getCheckBox(pdf_field_name).uncheck();
        }
      } else if (fieldType === 'PDFDropdown') {
        const dropdown = form.getDropdown(pdf_field_name);
        const opts = dropdown.getOptions();
        if (opts.includes(value)) dropdown.select(value);
      }
    } catch (e) {
      console.warn(`Could not fill field "${pdf_field_name}": ${e.message}`);
    }
  }

  form.flatten();
  return pdfDoc.save();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { templateId, clientIds, startDate, endDate } = await req.json();
    if (!templateId) return Response.json({ error: 'templateId is required' }, { status: 400 });
    if (!clientIds || clientIds.length === 0) return Response.json({ error: 'clientIds is required' }, { status: 400 });

    const [template, fieldMaps, allUsers] = await Promise.all([
      base44.asServiceRole.entities.PDFTemplate.get(templateId),
      base44.asServiceRole.entities.PDFFieldMap.filter({ pdf_template_id: templateId }),
      base44.asServiceRole.entities.User.list(),
    ]);

    if (!template || !template.id) return Response.json({ error: 'Template not found' }, { status: 404 });

    // Fetch the base PDF once
    const pdfRes = await fetch(template.pdf_file_url);
    if (!pdfRes.ok) return Response.json({ error: `Could not fetch PDF template: ${pdfRes.status}` }, { status: 500 });
    const pdfBytes = await pdfRes.arrayBuffer();

    const results = [];

    for (const clientId of clientIds) {
      try {
        const client = await base44.asServiceRole.entities.Client.get(clientId);

        // Get time entries for this client within the date range
        let entries = await base44.asServiceRole.entities.TimeEntry.filter({ client_id: clientId }, '-date');
        if (startDate) entries = entries.filter(e => e.date >= startDate);
        if (endDate) entries = entries.filter(e => e.date <= endDate);

        const hasEntries = entries.length > 0;
        const timeEntry = hasEntries ? entries[0] : null;

        let reportAnswers = null;
        if (timeEntry) {
          const answers = await base44.asServiceRole.entities.ReportFieldAnswer.filter({ time_entry_id: timeEntry.id });
          reportAnswers = answers[0] || null;
        }

        const employee = timeEntry?.created_by
          ? allUsers.find(u => u.email === timeEntry.created_by)
          : allUsers.find(u => u.email === user.email);

        const filledBytes = await fillPDFForClient({ pdfBytes, fieldMaps, timeEntry, reportAnswers, client, employee });

        const blob = new Blob([filledBytes], { type: 'application/pdf' });
        const uploadRes = await base44.asServiceRole.integrations.Core.UploadFile({ file: blob });
        const pdfUrl = uploadRes.file_url;

        const clientName = `${client.first_name || ''} ${client.last_name || ''}`.trim();
        const fileName = `${template.name} - ${clientName}${startDate ? ` (${startDate})` : ''}.pdf`;

        // Save to Document entity
        await base44.asServiceRole.entities.Document.create({
          client_id: clientId,
          title: fileName,
          file_url: pdfUrl,
          file_name: fileName,
          file_type: 'application/pdf',
          category: 'other',
          notes: JSON.stringify({
            report_template_id: templateId,
            report_template_name: template.name,
            date_range_start: startDate || null,
            date_range_end: endDate || null,
            generated_by: user.email,
            generated_at: new Date().toISOString(),
            entry_count: entries.length,
          }),
        });

        results.push({
          clientId,
          clientName,
          pdf_url: pdfUrl,
          fileName,
          entryCount: entries.length,
          hasData: hasEntries,
          status: 'success',
        });

        console.log(`Generated report for client ${clientName}: ${pdfUrl}`);
      } catch (err) {
        console.error(`Failed for client ${clientId}:`, err.message);
        results.push({
          clientId,
          status: 'error',
          error: err.message,
        });
      }
    }

    return Response.json({ results });
  } catch (error) {
    console.error('generateBatchPDFReports error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});