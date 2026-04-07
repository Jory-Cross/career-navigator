import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { PDFDocument } from 'npm:pdf-lib@1.17.1';

// Import transformer (inline since we can't use local imports in Deno)
class TimeEntryTransformer {
  constructor(timeEntries = [], fieldAnswers = [], client = {}) {
    this.timeEntries = timeEntries;
    this.fieldAnswers = fieldAnswers;
    this.client = client;
    this.answersMap = {};
    fieldAnswers.forEach(fa => {
      this.answersMap[fa.time_entry_id] = fa.answers || {};
    });
  }

  transform() {
    return {
      header: this.buildHeader(),
      rows: this.buildRows(),
      summary: this.buildSummary()
    };
  }

  buildHeader() {
    const dateRange = this.getDateRange();
    return {
      client_name: `${this.client.first_name || ''} ${this.client.last_name || ''}`.trim(),
      client_email: this.client.email || '',
      client_phone: this.client.phone || '',
      client_address: this.client.address || '',
      reporting_period_start: dateRange.start,
      reporting_period_end: dateRange.end,
      report_generated_date: new Date().toISOString().split('T')[0],
      total_entries: this.timeEntries.length,
      total_hours: this.getTotalHours().toFixed(2),
      total_minutes: this.getTotalMinutes()
    };
  }

  buildRows() {
    return this.timeEntries.map((entry, index) => {
      const answers = this.answersMap[entry.id] || {};
      return {
        row_number: index + 1,
        date: entry.date,
        duration_minutes: entry.duration_minutes || 0,
        duration_hours: ((entry.duration_minutes || 0) / 60).toFixed(2),
        entry_type: entry.entry_type_id || '',
        category: entry.category || '',
        description: entry.description || '',
        general_notes: entry.general_notes || '',
        ...answers
      };
    });
  }

  buildSummary() {
    const byEntryType = {};
    let totalMinutes = 0;

    this.timeEntries.forEach(entry => {
      const key = entry.entry_type_id || 'unknown';
      if (!byEntryType[key]) {
        byEntryType[key] = { count: 0, total_minutes: 0 };
      }
      byEntryType[key].count++;
      byEntryType[key].total_minutes += entry.duration_minutes || 0;
      totalMinutes += entry.duration_minutes || 0;
    });

    return {
      total_entries: this.timeEntries.length,
      total_hours: (totalMinutes / 60).toFixed(2),
      total_minutes: totalMinutes,
      by_entry_type: byEntryType
    };
  }

  getTotalHours() {
    return this.getTotalMinutes() / 60;
  }

  getTotalMinutes() {
    return this.timeEntries.reduce((sum, entry) => sum + (entry.duration_minutes || 0), 0);
  }

  getDateRange() {
    if (this.timeEntries.length === 0) {
      return { start: '', end: '' };
    }
    const sorted = [...this.timeEntries].sort((a, b) => a.date.localeCompare(b.date));
    return {
      start: sorted[0].date,
      end: sorted[sorted.length - 1].date
    };
  }
}

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

    // Transform time entries into structured PDF data
    const transformer = new TimeEntryTransformer(timeEntries, answers, client);
    const transformed = transformer.transform();

    // Load base PDF
    const pdfResponse = await fetch(template.pdf_file_url);
    if (!pdfResponse.ok) throw new Error('Failed to fetch template PDF');

    const pdfBytes = await pdfResponse.arrayBuffer();
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();

    // Fill PDF fields using transformed data
    fillPDFFields(form, mappings, transformed);

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

function fillPDFFields(form, mappings, transformed) {
  const fields = form.getFields();
  const instructions = compilePDFFieldInstructions(transformed, mappings);

  // Fill all computed PDF fields
  Object.entries(instructions).forEach(([pdfFieldName, value]) => {
    const field = fields.find(f => f.getName() === pdfFieldName);
    if (!field) {
      console.log(`PDF field not found: ${pdfFieldName}`);
      return;
    }

    try {
      field.setText(String(value || ""));
    } catch (e) {
      console.log(`Could not set field ${pdfFieldName}:`, e.message);
    }
  });
}

function compilePDFFieldInstructions(transformed, mappings) {
  const instructions = {};

  // Separate header/summary from repeating fields
  const headerSummary = mappings.filter(m => !m.is_repeating_field);
  const repeating = mappings.filter(m => m.is_repeating_field);

  // Fill header and summary fields
  headerSummary.forEach((mapping) => {
    const value = resolveValue(mapping, transformed);
    instructions[mapping.pdf_field_name] = value || mapping.default_value || "";
  });

  // Fill repeating row fields
  const rowInstructions = buildRepeatingRowInstructions(transformed.rows || [], repeating);
  Object.assign(instructions, rowInstructions);

  return instructions;
}

function buildRepeatingRowInstructions(rows, mappings) {
  const instructions = {};

  // Group mappings by row_group
  const grouped = {};
  mappings.forEach(m => {
    const group = m.row_group || 'default';
    if (!grouped[group]) grouped[group] = [];
    grouped[group].push(m);
  });

  // Fill each row group
  Object.entries(grouped).forEach(([rowGroup, groupMappings]) => {
    // Sort by sort_order
    groupMappings.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

    // Fill rows
    rows.forEach((row, rowIndex) => {
      groupMappings.forEach(mapping => {
        const value = row[mapping.source_field] || mapping.default_value || "";
        const transformed = applyTransformForRepeatField(value, mapping);
        const pdfFieldName = substitutePDFFieldName(mapping.pdf_field_name, rowIndex);
        instructions[pdfFieldName] = transformed;
      });
    });
  });

  return instructions;
}

function applyTransformForRepeatField(value, mapping) {
  if (!mapping.transform || mapping.transform === 'none') return value;

  switch (mapping.transform) {
    case 'date_format':
      return formatDateForPDF(value, mapping.transform_options?.format);
    case 'duration_hours':
    case 'hours_from_minutes':
      return typeof value === 'number' ? (value / 60).toFixed(2) : value;
    case 'uppercase':
      return String(value).toUpperCase();
    default:
      return value;
  }
}

function substitutePDFFieldName(template, rowIndex) {
  const rowNum = rowIndex + 1;
  let result = template.replace(/\{\{row(Num)?\}\}/gi, rowNum.toString());
  result = result.replace(/\{row(Num)?\}/gi, rowNum.toString());
  return result;
}

function formatDateForPDF(dateStr, format) {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const d = date.getDate().toString().padStart(2, '0');
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const y = date.getFullYear();
    if (format === 'MM/DD/YYYY' || !format) return `${m}/${d}/${y}`;
    if (format === 'YYYY-MM-DD') return `${y}-${m}-${d}`;
    return dateStr;
  } catch (e) {
    return dateStr;
  }
}

function resolveValue(mapping, context) {
  const { source_type, source_field, transform } = mapping;

  // Header fields
  if (source_type === "header") {
    const value = context.header?.[source_field];
    return applyTransform(value, transform, mapping.transform_options);
  }

  // Summary/aggregate fields
  if (source_type === "summary") {
    const summary = context.summary;
    if (source_field === "total_hours" || source_field === "total_entries" || source_field === "total_minutes") {
      return summary[source_field] || "";
    }
    // By type aggregations
    if (source_field.startsWith("by_entry_type_")) {
      const typeKey = source_field.replace("by_entry_type_", "");
      const typeData = summary.by_entry_type?.[typeKey];
      if (typeData) {
        if (transform === "count") return typeData.count;
        if (transform === "sum") return (typeData.total_minutes / 60).toFixed(2);
      }
    }
    return summary[source_field] || "";
  }

  // Row/repeating data (used with row iteration)
  if (source_type === "row") {
    // This requires row context — handled in row iteration
    return context.rows?.[0]?.[source_field] || "";
  }

  // Calculated report fields
  if (source_type === "report_field") {
    switch (source_field) {
      case "month_year":
        if (context.header.reporting_period_start) {
          const date = new Date(context.header.reporting_period_start);
          return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
        }
        return "";
      case "report_date":
        return context.currentDate;
      case "total_hours":
        return context.header.total_hours;
      case "total_entries":
        return context.header.total_entries;
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