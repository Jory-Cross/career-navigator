import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { jsPDF } from 'npm:jspdf@2.5.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { form_id } = await req.json();

        if (!form_id) {
            return Response.json({ error: 'form_id required' }, { status: 400 });
        }

        const form = await base44.asServiceRole.entities.WBLEForm.get(form_id);
        if (!form) {
            return Response.json({ error: 'Form not found' }, { status: 404 });
        }

        const client = await base44.asServiceRole.entities.Client.get(form.client_id);

        const doc = new jsPDF();
        const margin = 20;
        let y = 15;

        // Header
        doc.setFontSize(10);
        doc.text('DWS-USOR 163', margin, y);
        doc.text('State of Utah', 105, y, { align: 'center' });
        y += 5;
        doc.text('04/2022', margin, y);
        doc.text('Department of Workforce Services', 105, y, { align: 'center' });
        y += 5;
        doc.text('Utah State Office of Rehabilitation', 105, y, { align: 'center' });
        y += 8;

        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text('STUDENT WORK BASED LEARNING EXPERIENCE', 105, y, { align: 'center' });
        y += 10;

        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        
        // Section 1: Client Information
        doc.setFont(undefined, 'bold');
        doc.text('1. Client Information:', margin, y);
        doc.text('2. VR Counselor Information:', 110, y);
        y += 5;
        doc.setFont(undefined, 'normal');
        
        doc.text(`Client name: ${client.first_name} ${client.last_name}`, margin, y);
        doc.text(`Counselor name: ${form.vr_counselor_name || ''}`, 110, y);
        y += 5;
        
        doc.text(`Address: ${client.location || ''}`, margin, y);
        doc.text(`Office address: ${form.vr_office_address || ''}`, 110, y);
        y += 5;
        
        doc.text(`Home phone: ${client.phone || ''}`, margin, y);
        doc.text(`Office phone: ${form.vr_office_phone || ''}`, 110, y);
        y += 5;
        
        doc.text(`Email address: ${client.email}`, margin, y);
        doc.text(`Fax number: ${form.vr_fax || ''}`, 110, y);
        y += 5;
        
        doc.text(`Email address: ${form.vr_email || ''}`, 110, y);
        y += 10;

        // Section 3: Employer Information
        doc.setFont(undefined, 'bold');
        doc.text('3. Employer Information:', margin, y);
        doc.text('4. Pre-ETS Provider Information:', 110, y);
        y += 5;
        doc.setFont(undefined, 'normal');
        
        doc.text(`Employer name: ${form.employer_name || ''}`, margin, y);
        doc.text(`Specialist name: ${form.pre_ets_specialist_name || ''}`, 110, y);
        y += 5;
        
        doc.text(`Address: ${form.employer_address || ''}`, margin, y);
        doc.text(`Office address: ${form.pre_ets_office_address || ''}`, 110, y);
        y += 5;
        
        doc.text(`Office phone: ${form.employer_phone || ''}`, margin, y);
        doc.text(`Office phone: ${form.pre_ets_office_phone || ''}`, 110, y);
        y += 5;
        
        doc.text(`Fax number: ${form.employer_fax || ''}`, margin, y);
        doc.text(`Fax number: ${form.pre_ets_fax || ''}`, 110, y);
        y += 5;
        
        doc.text(`WBLE Employer Trainer: ${form.employer_trainer || ''}`, margin, y);
        doc.text(`Email address: ${form.pre_ets_email || ''}`, 110, y);
        y += 5;
        
        doc.text(`Email address: ${form.employer_email || ''}`, margin, y);
        y += 10;

        // Dates
        doc.setFont(undefined, 'bold');
        doc.text(`5. Work Based Learning Experience Start Date:`, margin, y);
        doc.setFont(undefined, 'normal');
        doc.text(form.start_date ? new Date(form.start_date).toLocaleDateString() : '', 130, y);
        y += 5;
        
        doc.setFont(undefined, 'bold');
        doc.text(`6. Work Based Learning Experience End Date:`, margin, y);
        doc.setFont(undefined, 'normal');
        doc.text(form.end_date ? new Date(form.end_date).toLocaleDateString() : '', 130, y);
        y += 10;

        // Section 7: Employer Expectations
        doc.setFont(undefined, 'bold');
        doc.text('7. Employer Expectations:', margin, y);
        y += 5;
        doc.setFont(undefined, 'normal');
        doc.text('The employer agrees to:', margin, y);
        y += 5;
        doc.text('A. Provide training and supervision for the employee/client.', margin + 5, y);
        y += 5;
        doc.text(`B. Pay trainee's wages as follows: ${form.trainee_wages || ''}`, margin + 5, y);
        y += 5;
        const note = '(Note: The payment amount and schedule should be at least commensurate with the';
        doc.text(note, margin + 8, y);
        y += 4;
        doc.text('prevailing wage for the position within the organization)', margin + 8, y);
        y += 5;
        doc.text("C. Employer/trainers must be willing to cover the client's social security, worker's", margin + 5, y);
        y += 4;
        doc.text('compensation, or other appropriate insurance coverage, and fringe benefits normally', margin + 8, y);
        y += 4;
        doc.text('provided to other employees.', margin + 8, y);
        y += 6;

        // New page if needed
        if (y > 240) {
            doc.addPage();
            y = 20;
        }

        doc.text("D. Employer/trainers will provide weekly updates regarding the employee's progress to the", margin + 5, y);
        y += 4;
        doc.text('Pre-ETS Provider.', margin + 8, y);
        y += 5;
        doc.text('E. Employer/trainers will submit billing to the VR Counselor at the end of each week or month', margin + 5, y);
        y += 4;
        doc.text('or as needed for reimbursement for training costs.', margin + 8, y);
        y += 10;

        // Section 8: USOR Expectations
        doc.setFont(undefined, 'bold');
        doc.text('8. Utah State Office of Rehabilitation (USOR) Expectations:', margin, y);
        y += 5;
        doc.setFont(undefined, 'normal');
        doc.text('The USOR VR Counselor agrees to:', margin, y);
        y += 5;
        doc.text(`A. Pay the employer/trainer a negotiated training fee as follows: ${form.training_fee || ''}`, margin + 5, y);
        y += 5;
        doc.text('B. When appropriate, furnish equipment, tools, and supplies that are required by the', margin + 5, y);
        y += 4;
        doc.text('client/trainee for training and/or employment.', margin + 8, y);
        y += 5;
        doc.text('C. Provide technical assistance, counseling, support, and follow-up to the Pre-ETS Provider', margin + 5, y);
        y += 4;
        doc.text('and employer in resolving problems that may arise during the period of the WBLE.', margin + 8, y);
        y += 10;

        // Signature section
        doc.text('Employer/Trainer Signature: /s/', margin, y);
        doc.text(`Date: ${new Date().toLocaleDateString()}`, 140, y);
        y += 6;
        doc.text('Client/Trainee Signature: /s/', margin, y);
        doc.text(`Date: ${new Date().toLocaleDateString()}`, 140, y);
        y += 6;
        doc.text('VR Counselor Signature: /s/', margin, y);
        doc.text(`Date: ${new Date().toLocaleDateString()}`, 140, y);
        y += 6;
        doc.text('Pre-ETS Provider: /s/', margin, y);
        doc.text(`Date: ${new Date().toLocaleDateString()}`, 140, y);

        // Convert to blob and upload
        const pdfBlob = doc.output('blob');
        const pdfFile = new File([pdfBlob], `wble-form-${form.id}.pdf`, { type: 'application/pdf' });

        const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file: pdfFile });

        return Response.json({ success: true, pdf_url: file_url });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});