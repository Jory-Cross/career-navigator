import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import { jsPDF } from 'npm:jspdf@4.0.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { report_id } = await req.json();
    if (!report_id) return Response.json({ error: 'report_id required' }, { status: 400 });

    const report = await base44.entities.TrainingProgressReport.get(report_id);
    const client = await base44.entities.Client.get(report.client_id);

    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();

    // Header
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text('DWS-USOR 72 | State of Utah — Department of Workforce Services', pageW / 2, 12, { align: 'center' });

    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.setFont(undefined, 'bold');
    doc.text('ON-THE-JOB / WORK BASED TRAINING PROGRESS REPORT', pageW / 2, 22, { align: 'center' });
    doc.setFont(undefined, 'normal');

    // Info block
    doc.setFontSize(10);
    let y = 34;
    const field = (label, value) => {
      doc.setFont(undefined, 'bold');
      doc.text(label + ':', 14, y);
      doc.setFont(undefined, 'normal');
      doc.text(value || '—', 70, y);
      y += 7;
    };

    if (report.return_completed_to) field('Return Form To', report.return_completed_to);
    field('Client/Employee', `${client.first_name} ${client.last_name}`);
    field('Supervisor/Employer', report.supervisor_name || '');
    if (report.supervisor_address) field('Supervisor Address', report.supervisor_address);
    field('Reporting Period', `${report.reporting_period_from || ''} to ${report.reporting_period_to || ''}`);

    y += 3;
    doc.setDrawColor(200);
    doc.line(14, y, pageW - 14, y);
    y += 6;

    // Attendance
    doc.setFont(undefined, 'bold');
    doc.text('Attendance', 14, y);
    y += 6;
    doc.setFont(undefined, 'normal');
    doc.text(`Was individual late?  ${report.was_late ? 'Yes' : 'No'}${report.late_how_often ? '   How often: ' + report.late_how_often : ''}`, 14, y);
    y += 6;
    doc.text(`Unexcused absences?  ${report.had_absences ? 'Yes' : 'No'}${report.absences_how_often ? '   How often: ' + report.absences_how_often : ''}`, 14, y);
    y += 8;

    doc.line(14, y, pageW - 14, y);
    y += 6;

    // Ratings table
    doc.setFont(undefined, 'bold');
    doc.text('Performance Ratings', 14, y);
    y += 6;

    const RATINGS = ['Excellent', 'Good', 'Average', 'Poor'];
    const FIELDS = [
      ['quality_of_work', 'Quality of Work'],
      ['rate_of_progress', 'Rate of Progress'],
      ['ability_get_along', 'Ability to Get Along With Others'],
      ['personal_appearance', 'Personal Appearance & Hygiene'],
      ['rate_of_task_completion', 'Rate of Task Completion'],
      ['attitude', 'Attitude'],
    ];

    const colX = [14, 110, 130, 153, 174];
    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    doc.text('Category', colX[0], y);
    RATINGS.forEach((r, i) => doc.text(r, colX[i + 1], y, { align: 'center' }));
    y += 5;
    doc.line(14, y, pageW - 14, y);
    y += 5;

    doc.setFont(undefined, 'normal');
    FIELDS.forEach(([key, label]) => {
      doc.text(label, colX[0], y);
      RATINGS.forEach((r, i) => {
        const mark = report[key] === r ? '✓' : '○';
        doc.text(mark, colX[i + 1], y, { align: 'center' });
      });
      y += 6;
    });

    doc.setFontSize(10);
    y += 2;
    doc.line(14, y, pageW - 14, y);
    y += 6;

    // Comments
    if (report.comments) {
      doc.setFont(undefined, 'bold');
      doc.text('Comments:', 14, y);
      y += 6;
      doc.setFont(undefined, 'normal');
      const lines = doc.splitTextToSize(report.comments, pageW - 28);
      doc.text(lines, 14, y);
      y += lines.length * 6 + 4;
    }

    // Training schedule changes
    doc.setFont(undefined, 'bold');
    doc.text('Training Schedule Changes Needed:', 14, y);
    doc.setFont(undefined, 'normal');
    doc.text(report.training_schedule_changes ? 'Yes' : 'No', 100, y);
    y += 6;
    if (report.training_schedule_changes && report.training_schedule_changes_explain) {
      const lines = doc.splitTextToSize(report.training_schedule_changes_explain, pageW - 28);
      doc.text(lines, 14, y);
      y += lines.length * 6 + 2;
    }

    if (report.additional_hours_needed) {
      doc.setFont(undefined, 'bold');
      doc.text('Additional Hours Needed:', 14, y);
      y += 6;
      doc.setFont(undefined, 'normal');
      const lines = doc.splitTextToSize(report.additional_hours_needed, pageW - 28);
      doc.text(lines, 14, y);
      y += lines.length * 6 + 4;
    }

    // Signature block
    y += 2;
    doc.line(14, y, pageW - 14, y);
    y += 6;
    field('Supervisor Signature', report.supervisor_signature || '');
    field('Title', report.supervisor_title || '');
    field('Date', report.signature_date || '');
    field('Submitted By', report.submitted_by || '');

    const pdfBytes = doc.output('arraybuffer');
    const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
    const file = new File([pdfBlob], 'Training_Progress_Report.pdf', { type: 'application/pdf' });

    const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file });

    return Response.json({ pdf_url: file_url });
  } catch (error) {
    console.error('generateProgressReportPDF error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});