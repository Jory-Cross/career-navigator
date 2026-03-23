import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import { PDFDocument } from 'npm:pdf-lib@1.17.1';

const TEMPLATE_URL = 'https://jobs.utah.gov/usor/vr/employer/info/usor72.pdf';

function fmt(dateStr) {
  if (!dateStr) return '';
  try { return new Date(dateStr).toLocaleDateString('en-US'); } catch { return dateStr; }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { report_id } = await req.json();
    if (!report_id) return Response.json({ error: 'report_id required' }, { status: 400 });

    const report = await base44.asServiceRole.entities.TrainingProgressReport.get(report_id);
    const client = await base44.asServiceRole.entities.Client.get(report.client_id);

    // Fetch the official fillable PDF template
    const templateRes = await fetch(TEMPLATE_URL);
    if (!templateRes.ok) throw new Error(`Failed to fetch template: ${templateRes.status}`);
    const templateBytes = await templateRes.arrayBuffer();

    const pdfDoc = await PDFDocument.load(templateBytes);
    const form = pdfDoc.getForm();

    // Log available fields for debugging
    const fields = form.getFields();
    console.log('PDF fields:', fields.map(f => `${f.constructor.name}: ${f.getName()}`));

    // Helper to safely set a text field
    const setText = (name, value) => {
      try { form.getTextField(name).setText(value || ''); } catch (e) { console.log(`Field not found: ${name}`, e.message); }
    };
    const setCheck = (name, checked) => {
      try {
        const field = form.getCheckBox(name);
        checked ? field.check() : field.uncheck();
      } catch (e) { console.log(`Checkbox not found: ${name}`, e.message); }
    };
    const setRadio = (name, value) => {
      try { form.getRadioGroup(name).select(value); } catch (e) { console.log(`Radio not found: ${name}`, e.message); }
    };

    // Fill header fields (field names from the official PDF)
    setText('Return Completed Form To', report.return_completed_to);
    setText('ClientEmployee', `${client.first_name} ${client.last_name}`);
    setText('SupervisorEmployer', report.supervisor_name);
    setText('Address', report.supervisor_address);
    setText('Reporting Period From', fmt(report.reporting_period_from));
    setText('To', fmt(report.reporting_period_to));

    // Attendance
    setRadio('Late', report.was_late ? 'Yes' : 'No');
    setText('How Often', report.late_how_often);
    setRadio('Absences', report.had_absences ? 'Yes' : 'No');
    setText('How Often_2', report.absences_how_often);

    // Performance ratings - try common field naming patterns
    const ratingMap = {
      quality_of_work: 'Quality of Work',
      rate_of_progress: 'Rate of Progress',
      ability_get_along: 'Ability to Get Along With Others',
      personal_appearance: 'Personal Appearance  Hygiene',
      rate_of_task_completion: 'Rate of Task Completion',
      attitude: 'Attitude',
    };
    for (const [key, fieldName] of Object.entries(ratingMap)) {
      setRadio(fieldName, report[key]);
    }

    // Comments / additional fields
    setText('Comments things done well issues or concerns', report.comments);
    setRadio('Training Schedule Changes', report.training_schedule_changes ? 'Yes' : 'No');
    setText('If yes explain', report.training_schedule_changes_explain);
    setText('How many additional hours of training do you believe are needed', report.additional_hours_needed);

    // Signature block
    setText('Signature', report.supervisor_signature);
    setText('Date', fmt(report.signature_date));
    setText('Title', report.supervisor_title);

    // Flatten so it looks clean when downloaded
    form.flatten();

    const pdfBytes = await pdfDoc.save();
    const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
    const pdfFile = new File([pdfBlob], 'Training_Progress_Report.pdf', { type: 'application/pdf' });

    const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file: pdfFile });

    return Response.json({ pdf_url: file_url });
  } catch (error) {
    console.error('generateProgressReportPDF error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});