import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Fetch and fill a PDF using pdf-lib
import { PDFDocument } from 'npm:pdf-lib@1.17.1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { templateId, timeEntryId, clientId, dateRange } = await req.json();
    if (!templateId) return Response.json({ error: 'templateId is required' }, { status: 400 });

    // Load template and its field mappings in parallel
    const [fieldMaps, clients, allUsers] = await Promise.all([
      base44.asServiceRole.entities.PDFFieldMap.filter({ pdf_template_id: templateId }),
      base44.asServiceRole.entities.Client.list(),
      base44.asServiceRole.entities.User.list(),
    ]);

    const template = await base44.asServiceRole.entities.PDFTemplate.get(templateId);
    if (!template || !template.id) return Response.json({ error: 'Template not found' }, { status: 404 });

    // Fetch time entry (if specific) or build a summary across a date range
    let timeEntry = null;
    let reportAnswers = null;

    if (timeEntryId) {
      timeEntry = await base44.asServiceRole.entities.TimeEntry.get(timeEntryId);
      const answers = await base44.asServiceRole.entities.ReportFieldAnswer.filter({ time_entry_id: timeEntryId });
      reportAnswers = answers[0] || null;
    }

    // Fetch the PDF template file
    console.log(`Fetching PDF template from: ${template.pdf_file_url}`);
    const pdfRes = await fetch(template.pdf_file_url);
    if (!pdfRes.ok) {
      return Response.json({ error: `Could not fetch PDF template: ${pdfRes.status}` }, { status: 500 });
    }
    const pdfBytes = await pdfRes.arrayBuffer();
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

    const form = pdfDoc.getForm();
    const fieldNames = form.getFields().map(f => f.getName());
    console.log('PDF form fields found:', fieldNames);

    // Resolve the client record
    const client = clientId
      ? clients.find(c => c.id === clientId)
      : (timeEntry?.client_id ? clients.find(c => c.id === timeEntry.client_id) : null);

    // Resolve the employee who logged the entry
    const employee = timeEntry?.created_by
      ? allUsers.find(u => u.email === timeEntry.created_by)
      : null;

    // Build a flat data map for source lookups
    const dataMap = {
      // TimeEntry core fields
      time_entry: {
        date: timeEntry?.date || '',
        duration_minutes: timeEntry?.duration_minutes?.toString() || '',
        hours: timeEntry ? String(Math.round(timeEntry.duration_minutes / 60 * 10) / 10) : '',
        start_time: timeEntry?.start_time || '',
        end_time: timeEntry?.end_time || '',
        description: timeEntry?.description || '',
        category: timeEntry?.category || '',
      },
      // Dynamic report answers
      report_answer: reportAnswers?.answers || {},
      // Client fields
      client: {
        first_name: client?.first_name || '',
        last_name: client?.last_name || '',
        full_name: client ? `${client.first_name} ${client.last_name}` : '',
        email: client?.email || '',
        phone: client?.phone || '',
        address: client?.address || '',
        client_type: client?.client_type || '',
      },
      // Employee fields
      employee: {
        full_name: employee?.full_name || '',
        email: employee?.email || '',
        title: employee?.title || '',
        phone: employee?.phone || '',
      },
    };

    console.log('Data map built:', JSON.stringify(dataMap, null, 2));

    // Apply each field mapping
    for (const map of fieldMaps) {
      const { source_type, source_field, pdf_field_name, transform, default_value } = map;

      let rawValue = dataMap[source_type]?.[source_field] ?? default_value ?? '';

      // Apply transforms
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

      if (!fieldNames.includes(pdf_field_name)) {
        console.warn(`PDF field not found: "${pdf_field_name}" — skipping`);
        continue;
      }

      try {
        const field = form.getField(pdf_field_name);
        const fieldType = field.constructor.name;
        console.log(`Filling "${pdf_field_name}" (${fieldType}) = "${value}"`);

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

    // Flatten so it's not editable (optional — comment out to keep fillable)
    form.flatten();

    const filledBytes = await pdfDoc.save();

    // Upload the filled PDF and return the URL
    const blob = new Blob([filledBytes], { type: 'application/pdf' });
    const formData = new FormData();
    formData.append('file', blob, `report_${Date.now()}.pdf`);

    const uploadRes = await base44.asServiceRole.integrations.Core.UploadFile({ file: blob });
    console.log('PDF uploaded:', uploadRes.file_url);

    return Response.json({ pdf_url: uploadRes.file_url, fields_found: fieldNames });
  } catch (error) {
    console.error('generatePDFReport error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});