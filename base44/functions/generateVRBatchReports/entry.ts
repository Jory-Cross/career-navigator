import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { PDFDocument } from 'npm:pdf-lib@1.17.1';

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

async function generateClientReport(base44, user, templateId, entryType, clientId, dateFrom, dateTo) {
  try {
    // Fetch template
    const templates = await base44.entities.PDFTemplate.list();
    const template = templates.find(t => t.id === templateId);

    if (!template) {
      return { success: false, error: 'Template not found' };
    }

    // Fetch mappings
    const mappings = await base44.entities.PDFFieldMap.filter({
      pdf_template_id: templateId
    });

    // Fetch time entries for this client and date range
    const timeEntries = await base44.entities.TimeEntry.filter({
      client_id: clientId,
      date: { $gte: dateFrom, $lte: dateTo },
      entry_type_id: entryType
    });

    if (!timeEntries.length) {
      return { success: false, error: 'No entries found for this period' };
    }

    // Fetch field answers for all time entries
    const entryIds = timeEntries.map(te => te.id);
    const allAnswers = await base44.entities.ReportFieldAnswer.list();
    const answers = allAnswers.filter(a => entryIds.includes(a.time_entry_id));

    // Build answers map by time_entry_id for fast lookup
    const answersMap = {};
    answers.forEach(a => {
      answersMap[a.time_entry_id] = a.answers || {};
    });

    // Fetch client and related data
    const allClients = await base44.entities.Client.list();
    const client = allClients.find(c => c.id === clientId);

    if (!client) {
      return { success: false, error: 'Client not found' };
    }

    // Load base PDF
    const pdfResponse = await fetch(template.pdf_file_url);
    if (!pdfResponse.ok) throw new Error('Failed to fetch template PDF');

    const pdfBytes = await pdfResponse.arrayBuffer();
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();

    // Fill repeating rows and header fields with structured data
    fillPDFFields(form, mappings, timeEntries, answersMap, client, dateFrom, dateTo);

    // Flatten and save
    form.flatten();
    const filledBytes = await pdfDoc.save();

    // Convert to base64 for upload
    const base64 = btoa(String.fromCharCode(...new Uint8Array(filledBytes)));
    const dataUrl = `data:application/pdf;base64,${base64}`;

    const { file_url } = await base44.integrations.Core.UploadFile({
      file: dataUrl
    });

    // Save to client Documents
    const document = await base44.entities.Document.create({
      client_id: clientId,
      title: `${entryType.toUpperCase()} Report - ${new Date(dateFrom).toLocaleDateString()} to ${new Date(dateTo).toLocaleDateString()}`,
      file_url: file_url,
      file_name: `report-${entryType}-${clientId}.pdf`,
      category: "reference",
      tags: [entryType, "vr-report", new Date(dateFrom).getFullYear().toString()],
      notes: `Auto-generated on ${new Date().toISOString()} by ${user.email}. Based on ${timeEntries.length} time entries.`
    });

    return {
      success: true,
      document_id: document.id,
      pdf_url: file_url
    };

  } catch (e) {
    console.error(`Error generating report for client ${clientId}:`, e);
    return { success: false, error: e.message };
  }
}

function fillPDFFields(form, mappings, timeEntries, answersMap, client, dateFrom, dateTo) {
  const fields = form.getFields();

  // Build aggregated field data from structured answers
  const aggregatedData = aggregateFieldData(timeEntries, answersMap);

  // Build context
  const context = {
    client,
    timeEntries,
    answersMap,
    aggregatedData,
    dateFrom,
    dateTo,
    currentDate: new Date().toISOString().split('T')[0]
  };

  // Fill each mapped field
  mappings.forEach((mapping) => {
    const field = fields.find(f => f.getName() === mapping.pdf_field_name);
    if (!field) return;

    const value = resolveValue(mapping, context);

    try {
      field.setText(String(value || mapping.default_value || ""));
    } catch (e) {
      console.log(`Could not set field ${mapping.pdf_field_name}:`, e.message);
    }
  });
}

function aggregateFieldData(timeEntries, answersMap) {
  // Count, sum, and group structured field data by field_key
  const aggregated = {};

  timeEntries.forEach((entry) => {
    const answers = answersMap[entry.id] || {};
    Object.entries(answers).forEach(([fieldKey, value]) => {
      if (!aggregated[fieldKey]) {
        aggregated[fieldKey] = { count: 0, values: [], sum: 0, last: null };
      }
      aggregated[fieldKey].count++;
      aggregated[fieldKey].values.push(value);
      aggregated[fieldKey].last = value;

      // Sum numeric values
      const numValue = parseFloat(value);
      if (!isNaN(numValue)) {
        aggregated[fieldKey].sum += numValue;
      }
    });
  });

  return aggregated;
}

function resolveValue(mapping, context) {
  const { source_type, source_field, transform } = mapping;

  // Client fields
  if (source_type === "client") {
    const value = context.client?.[source_field];
    return applyTransform(value, transform, mapping.transform_options);
  }

  // Time entry fields
  if (source_type === "time_entry") {
    if (source_field === "total_hours") {
      const total = context.timeEntries.reduce((sum, te) => sum + ((te.duration_minutes || 0) / 60), 0);
      return applyTransform(total.toFixed(2), transform, mapping.transform_options);
    }
    if (source_field === "entry_count") {
      return context.timeEntries.length;
    }
  }

  // Report/summary fields
  if (source_type === "report_answer") {
    const agg = context.aggregatedData[source_field];
    if (agg) {
      if (transform === "sum") {
        return agg.sum.toFixed(2);
      }
      if (transform === "count") {
        return agg.count;
      }
      if (transform === "last") {
        return agg.last;
      }
      // Default: concatenate values
      return agg.values.join(" | ");
    }
  }

  // Calculated report fields
  if (source_type === "report_field") {
    switch (source_field) {
      case "month_year":
        const date = new Date(context.dateFrom);
        return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      case "report_date":
        return context.currentDate;
      case "total_hours":
        const total = context.timeEntries.reduce((sum, te) => sum + ((te.duration_minutes || 0) / 60), 0);
        return applyTransform(total.toFixed(2), transform, mapping.transform_options);
      case "entry_count":
        return context.timeEntries.length;
      default:
        return "";
    }
  }

  return "";
}

function applyTransform(value, transform, options = {}) {
  if (!transform || transform === "none") return value;

  if (transform === "date_format") {
    const date = new Date(value);
    const format = options.format || "MM/DD/YYYY";
    return date.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
  }

  if (transform === "time_format") {
    const totalMinutes = parseInt(value);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}:${minutes.toString().padStart(2, "0")}`;
  }

  if (transform === "hours_from_minutes") {
    return (parseInt(value) / 60).toFixed(2);
  }

  if (transform === "uppercase") {
    return String(value).toUpperCase();
  }

  if (transform === "full_name") {
    return value?.full_name || String(value);
  }

  return value;
}