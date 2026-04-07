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

    // Fetch field answers
    const entryIds = timeEntries.map(te => te.id);
    const answers = await base44.entities.ReportFieldAnswer.filter({
      time_entry_id: { $in: entryIds }
    });

    // Fetch client and related data
    const client = await base44.entities.Client.list().then(all => all.find(c => c.id === clientId));

    // Load base PDF
    const pdfResponse = await fetch(template.pdf_file_url);
    if (!pdfResponse.ok) throw new Error('Failed to fetch template PDF');

    const pdfBytes = await pdfResponse.arrayBuffer();
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();

    // Fill repeating rows and header fields
    fillPDFFields(form, mappings, timeEntries, answers, client, dateFrom, dateTo);

    // Flatten and save
    form.flatten();
    const filledBytes = await pdfDoc.save();

    const { file_url } = await base44.integrations.Core.UploadFile({
      file: new File([filledBytes], `${entryType}-report-${clientId}-${Date.now()}.pdf`, {
        type: 'application/pdf'
      })
    });

    // Save to client Documents
    const document = await base44.entities.Document.create({
      client_id: clientId,
      title: `${entryType.toUpperCase()} Report - ${new Date(dateFrom).toLocaleDateString()} to ${new Date(dateTo).toLocaleDateString()}`,
      file_url: file_url,
      file_name: `report-${entryType}-${clientId}.pdf`,
      category: "reference",
      tags: [entryType, "vr-report", new Date(dateFrom).getFullYear().toString()],
      notes: `Auto-generated on ${new Date().toISOString()} by ${user.email}`
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

function fillPDFFields(form, mappings, timeEntries, answers, client, dateFrom, dateTo) {
  const fields = form.getFields();

  // Build context
  const context = {
    client,
    timeEntries,
    answers,
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
      console.log(`Could not set field ${mapping.pdf_field_name}`);
    }
  });
}

function resolveValue(mapping, context) {
  const { source_type, source_field } = mapping;

  // Client fields
  if (source_type === "client") {
    return context.client?.[source_field] || "";
  }

  // Report/summary fields
  if (source_type === "report_field") {
    switch (source_field) {
      case "month_year":
        const date = new Date(context.dateFrom);
        return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      case "report_date":
        return context.currentDate;
      case "total_hours":
        return context.timeEntries.reduce((sum, te) => sum + ((te.duration_minutes || 0) / 60), 0).toFixed(2);
      case "entry_count":
        return context.timeEntries.length;
      default:
        return "";
    }
  }

  // Repeating row fields - concatenate or summarize all entries
  if (source_type === "repeating_row") {
    const values = [];
    context.timeEntries.forEach((entry) => {
      const answer = context.answers[entry.id];
      if (answer?.[source_field]) {
        values.push(String(answer[source_field]));
      }
    });
    return values.join(" | ");
  }

  return "";
}