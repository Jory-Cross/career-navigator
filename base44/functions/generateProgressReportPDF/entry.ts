import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import { PDFDocument, StandardFonts } from 'npm:pdf-lib@1.17.1';

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

    // Employer info: prefer report fields, fall back to client record
    const supervisorName = report.supervisor_name
      || client.employer_contact_name
      || client.employer_name
      || '';
    const supervisorAddress = report.supervisor_address
      || client.employer_address
      || '';

    // Fill header fields
    setText('Return Completed Form To', report.return_completed_to);
    setText('ClientEmployee Name', `${client.first_name} ${client.last_name}`);
    setText('SupervisorEmployer Name', supervisorName);
    setText('Supervisor Employer Address', supervisorAddress);
    setText('From', fmt(report.reporting_period_from));
    setText('To', fmt(report.reporting_period_to));
    setText('Date', fmt(report.signature_date));
    setText('EmployerSupervisor Title', report.supervisor_title);

    // Attendance
    setRadio('Late?', report.was_late ? 'Late - Yes' : 'Late - No');
    setText('Late? If yes how often', report.late_how_often);
    setRadio('Unexcused?', report.had_absences ? 'Unexcused - Yes' : 'Unexcused - No');
    setText('Unexcused? If yes how often', report.absences_how_often);

    // Performance ratings
    setRadio('Quality of Work', report.quality_of_work);
    setRadio('Rate of Progress', report.rate_of_progress);
    setRadio('Get Along', report.ability_get_along);
    setRadio('Appearance', report.personal_appearance);
    setRadio('Task Completion', report.rate_of_task_completion);
    setRadio('Attitude', report.attitude);

    // Comments / additional fields
    setText('Comments', report.comments);
    setRadio('Changes to training scedule?', report.training_schedule_changes ? 'Changes - Yes' : 'Changes - No');
    setText('Changes - Explanation', report.training_schedule_changes_explain);
    setText('Addtional hours needed', report.additional_hours_needed);

    // Signature field is not a fillable PDF field, so draw typed signature onto the signature line
    if (report.supervisor_signature) {
      const pages = pdfDoc.getPages();
      const firstPage = pages[0];
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

      firstPage.drawText(report.supervisor_signature, {
        x: 215,
        y: 170,
        size: 11,
        font,
        maxWidth: 240,
      });
    }
    
       // Flatten so it looks clean when downloaded
    form.flatten();

    // Signature line is not a fillable PDF field, so draw typed signature after flattening
    if (report.supervisor_signature) {
      const pages = pdfDoc.getPages();
      const firstPage = pages[0];
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

      firstPage.drawText(report.supervisor_signature, {
        x: 345,
        y: 109,
        size: 11,
        font,
        maxWidth: 250,
      });
    }

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
