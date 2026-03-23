import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import { PDFDocument } from 'npm:pdf-lib@1.17.1';

const FILLABLE_WSA_URL = 'https://media.base44.com/files/public/69975ef9c220200194235cef/7d58a8997_usor94.pdf';

// Helper to set checkbox field values
function setCheckboxValue(fields, fieldName, value) {
  if (fields[fieldName]) {
    fields[fieldName].setValue(value === true || value === 'Yes' ? 'Yes' : '');
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { assessment_id } = await req.json();
    const assessment = await base44.entities.Assessment.get(assessment_id);
    if (!assessment) return Response.json({ error: 'Assessment not found' }, { status: 404 });

    const r = assessment.responses || {};
    console.log('Loading fillable WSA template and populating fields...');

    // Load fillable PDF template
    const pdfResponse = await fetch(FILLABLE_WSA_URL);
    if (!pdfResponse.ok) throw new Error(`Failed to fetch PDF: ${pdfResponse.status}`);
    const pdfBytes = await pdfResponse.arrayBuffer();

    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const form = pdfDoc.getForm();
    const fields = form.getFields();

    // Log available fields for debugging
    const fieldNames = fields.map(f => f.getName());
    console.log('Available PDF form fields:', JSON.stringify(fieldNames));
    console.log('Assessment response keys:', JSON.stringify(Object.keys(r)));

    // Dynamic field mapping - try to match response keys to PDF field names
    for (const [key, value] of Object.entries(r)) {
      if (!value || key.startsWith('_')) continue; // Skip empty/internal fields
      
      try {
        // Try exact match first
        let field = form.getFieldMaybe(key);
        if (!field) {
          // Try finding field that contains key text
          const matchingField = fieldNames.find(fname => 
            fname.toLowerCase().includes(key.toLowerCase()) || 
            key.toLowerCase().includes(fname.toLowerCase())
          );
          if (matchingField) {
            field = form.getFieldMaybe(matchingField);
          }
        }
        
        if (field) {
          const fieldType = field.constructor.name;
          if (fieldType.includes('Text')) {
            field.setText(String(value));
            console.log(`Set ${key} to field`);
          } else if (fieldType.includes('Checkbox') && (value === 'Yes' || value === true)) {
            field.check();
            console.log(`Checked ${key}`);
          }
        }
      } catch (e) {
        console.log(`Could not set field for ${key}:`, e.message);
      }
    }

    const modifiedPdfBytes = await pdfDoc.save();

    // Upload completed PDF
    const pdfFile = new File([modifiedPdfBytes], `wsa-${assessment_id}.pdf`, { type: 'application/pdf' });
    const { file_url } = await base44.integrations.Core.UploadFile({ file: pdfFile });

    // Save pdf_url back to assessment
    await base44.entities.Assessment.update(assessment_id, { pdf_url: file_url });

    console.log('WSA PDF generated:', file_url);
    return Response.json({ pdf_url: file_url });
  } catch (error) {
    console.error('generateWSAPDF error:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});