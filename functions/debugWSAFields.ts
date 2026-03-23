import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import { PDFDocument } from 'npm:pdf-lib@1.17.1';

const FILLABLE_WSA_URL = 'https://media.base44.com/files/public/69975ef9c220200194235cef/7d58a8997_usor94.pdf';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const pdfResponse = await fetch(FILLABLE_WSA_URL);
    const pdfBytes = await pdfResponse.arrayBuffer();
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const form = pdfDoc.getForm();
    const fields = form.getFields();

    const fieldInfo = fields.map(f => `[${f.constructor.name.replace('PDF','')}] ${f.getName()}`);
    return Response.json({ count: fieldInfo.length, fields_40_plus: fieldInfo.slice(40) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});