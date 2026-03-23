import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { jsPDF } from 'npm:jspdf@2.5.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { assessment_id } = await req.json();

        if (!assessment_id) {
            return Response.json({ error: 'assessment_id required' }, { status: 400 });
        }

        // Fetch assessment data
        const assessment = await base44.asServiceRole.entities.Assessment.get(assessment_id);
        if (!assessment) {
            return Response.json({ error: 'Assessment not found' }, { status: 404 });
        }

        // Fetch client data
        const client = await base44.asServiceRole.entities.Client.get(assessment.client_id);

        // Create PDF
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 20;
        let y = 20;

        // Title
        doc.setFontSize(20);
        doc.setFont(undefined, 'bold');
        doc.text('Client Assessment Report', margin, y);
        y += 10;

        // Client info
        doc.setFontSize(11);
        doc.setFont(undefined, 'normal');
        doc.text(`Client: ${client.first_name} ${client.last_name}`, margin, y);
        y += 6;
        doc.text(`Email: ${client.email}`, margin, y);
        y += 6;
        doc.text(`Date: ${new Date(assessment.created_date).toLocaleDateString()}`, margin, y);
        y += 6;
        doc.text(`Completed by: ${assessment.completed_by}`, margin, y);
        y += 10;

        // Assessment type
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text(`Assessment Type: ${assessment.assessment_type.replace(/_/g, ' ').toUpperCase()}`, margin, y);
        y += 10;

        // Responses
        doc.setFontSize(11);
        doc.setFont(undefined, 'normal');

        const responses = assessment.responses || {};
        for (const [key, value] of Object.entries(responses)) {
            if (!value) continue;

            // Check if we need a new page
            if (y > 270) {
                doc.addPage();
                y = 20;
            }

            // Question label
            doc.setFont(undefined, 'bold');
            const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            doc.text(label + ':', margin, y);
            y += 6;

            // Answer
            doc.setFont(undefined, 'normal');
            const lines = doc.splitTextToSize(String(value), pageWidth - margin * 2);
            lines.forEach(line => {
                if (y > 280) {
                    doc.addPage();
                    y = 20;
                }
                doc.text(line, margin, y);
                y += 5;
            });
            y += 4;
        }

        // Additional notes
        if (assessment.notes) {
            if (y > 250) {
                doc.addPage();
                y = 20;
            }
            y += 5;
            doc.setFont(undefined, 'bold');
            doc.text('Additional Notes:', margin, y);
            y += 6;
            doc.setFont(undefined, 'normal');
            const notesLines = doc.splitTextToSize(assessment.notes, pageWidth - margin * 2);
            notesLines.forEach(line => {
                if (y > 280) {
                    doc.addPage();
                    y = 20;
                }
                doc.text(line, margin, y);
                y += 5;
            });
        }

        // Convert to blob and upload
        const pdfBlob = doc.output('blob');
        const pdfFile = new File([pdfBlob], `assessment-${assessment.id}.pdf`, { type: 'application/pdf' });

        const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file: pdfFile });

        return Response.json({ success: true, pdf_url: file_url });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});