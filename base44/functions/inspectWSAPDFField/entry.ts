import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import { PDFDocument, PDFName, PDFDict } from 'npm:pdf-lib@1.17.1';

const FILLABLE_WSA_URL = 'https://jobs.utah.gov/usor/vr/partners/usor94.pdf';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { field_name } = await req.json();
    const targetField = field_name || 'Transportation Assessment Observations';

    const pdfResponse = await fetch(FILLABLE_WSA_URL);
    if (!pdfResponse.ok) throw new Error(`Failed to fetch PDF: ${pdfResponse.status}`);
    const pdfBytes = await pdfResponse.arrayBuffer();
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const form = pdfDoc.getForm();

    const results = [];

    // Inspect the target field plus all transportation-related fields
    const fieldsToCheck = [
      targetField,
      'Public Transportation Options (text)',
      'Private Transportation Options (text)',
      'Work Assessment Observations',
      'Computer Skill Assessment Observations',
    ];

    for (const fieldName of fieldsToCheck) {
      try {
        const field = form.getFieldMaybe(fieldName);
        if (!field) {
          results.push({ field: fieldName, error: 'NOT FOUND' });
          continue;
        }

        // Access raw PDF dict for this field widget
        const acroField = field.acroField;
        const dict = acroField.dict;

        // Field type (Ft)
        const ft = dict.get(PDFName.of('FT'));
        const fieldType = ft ? ft.toString() : 'unknown';

        // Flags (Ff) — bit 13 (0x1000) = Multiline, bit 14 = Password, bit 25 = Comb
        const ffObj = dict.get(PDFName.of('Ff'));
        const flags = ffObj ? ffObj.asNumber() : 0;
        const isMultiline = (flags & 0x1000) !== 0;     // bit 13
        const isPassword  = (flags & 0x2000) !== 0;     // bit 14
        const isComb      = (flags & 0x1000000) !== 0;  // bit 25
        const isReadOnly  = (flags & 0x1) !== 0;        // bit 1

        // Font size (DA = Default Appearance)
        const daObj = dict.get(PDFName.of('DA'));
        const da = daObj ? daObj.toString() : '';

        // Rect — field rectangle [x1, y1, x2, y2] in PDF points
        const rectObj = dict.get(PDFName.of('Rect'));
        let rect = null;
        let width = null;
        let height = null;
        if (rectObj) {
          const arr = rectObj.asArray();
          if (arr && arr.length === 4) {
            rect = arr.map(n => Math.round(n.asNumber() * 100) / 100);
            width = Math.round(Math.abs(rect[2] - rect[0]) * 100) / 100;
            height = Math.round(Math.abs(rect[3] - rect[1]) * 100) / 100;
          }
        }

        // Max length (MaxLen)
        const maxLenObj = dict.get(PDFName.of('MaxLen'));
        const maxLen = maxLenObj ? maxLenObj.asNumber() : null;

        // Page number
        const widgets = acroField.getWidgets();
        const pageNum = widgets.length > 0 ? 'has widgets' : 'no widgets';

        // Estimate character capacity:
        // Helvetica 10pt: avg char width ~5.5pt, line height ~14pt
        const estimatedCharsPerLine = width ? Math.floor((width - 4) / 5.5) : null;
        const estimatedLines = height ? Math.floor((height - 4) / 14) : null;
        const estimatedCapacity = (estimatedCharsPerLine && estimatedLines)
          ? estimatedCharsPerLine * estimatedLines
          : null;

        results.push({
          field: fieldName,
          fieldType,
          flags: `0x${flags.toString(16)}`,
          isMultiline,
          isPassword,
          isComb,
          isReadOnly,
          defaultAppearance: da,
          rect,
          width_pts: width,
          height_pts: height,
          maxLen,
          pageNum,
          estimatedCharsPerLine,
          estimatedLines,
          estimatedCapacity,
        });
      } catch (e) {
        results.push({ field: fieldName, error: e.message });
      }
    }

    return Response.json({ results });
  } catch (error) {
    console.error('inspectWSAPDFField error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});