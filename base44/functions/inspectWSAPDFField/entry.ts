import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import { PDFDocument, PDFName } from 'npm:pdf-lib@1.17.1';

const FILLABLE_WSA_URL = 'https://jobs.utah.gov/usor/vr/partners/usor94.pdf';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const pdfResponse = await fetch(FILLABLE_WSA_URL);
    if (!pdfResponse.ok) throw new Error(`Failed to fetch PDF: ${pdfResponse.status}`);
    const pdfBytes = await pdfResponse.arrayBuffer();
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const form = pdfDoc.getForm();

    // Target fields for the deep diagnostic
    const TARGET_FIELDS = [
      'Work Assessment Observations',
      'Natural Support Assessment Observations',
      'Life Skills Observations',
      'Transportation Assessment Observations',
      'Computer Skill Assessment Observations',
    ];

    const results = [];

    for (const fieldName of TARGET_FIELDS) {
      const field = form.getFieldMaybe(fieldName);
      if (!field) {
        results.push({ field: fieldName, error: 'NOT FOUND IN PDF' });
        continue;
      }

      const acroField = field.acroField;
      const dict = acroField.dict;

      // ── Field flags (Ff) ──────────────────────────────────────────────────
      // PDF spec Table 228: text field flags
      //   Bit 1  (0x1)       ReadOnly
      //   Bit 13 (0x1000)    Multiline
      //   Bit 14 (0x2000)    Password
      //   Bit 16 (0x8000)    FileSelect
      //   Bit 21 (0x100000)  DoNotSpellCheck
      //   Bit 22 (0x200000)  DoNotScroll   ← KEY: if set, text is clipped to field rect
      //   Bit 24 (0x800000)  Comb
      //   Bit 26 (0x2000000) RichText
      const ffObj = dict.get(PDFName.of('Ff'));
      const flags = ffObj ? ffObj.asNumber() : 0;

      const isReadOnly     = (flags & 0x1)       !== 0;  // bit 1
      const isMultiline    = (flags & 0x1000)     !== 0;  // bit 13
      const isPassword     = (flags & 0x2000)     !== 0;  // bit 14
      const doNotScroll    = (flags & 0x200000)   !== 0;  // bit 22 — CLIPS text to rect if set!
      const isComb         = (flags & 0x800000)   !== 0;  // bit 24
      const isRichText     = (flags & 0x2000000)  !== 0;  // bit 26

      // ── Default Appearance (DA) ───────────────────────────────────────────
      const daObj = dict.get(PDFName.of('DA'));
      const da = daObj ? daObj.decodeText ? daObj.decodeText() : daObj.toString() : null;

      // ── Rect ──────────────────────────────────────────────────────────────
      const rectObj = dict.get(PDFName.of('Rect'));
      let rect = null, widthPts = null, heightPts = null;
      if (rectObj) {
        const arr = rectObj.asArray();
        if (arr && arr.length === 4) {
          rect = arr.map(n => parseFloat(n.asNumber().toFixed(2)));
          widthPts  = parseFloat(Math.abs(rect[2] - rect[0]).toFixed(2));
          heightPts = parseFloat(Math.abs(rect[3] - rect[1]).toFixed(2));
        }
      }

      // ── MaxLen ────────────────────────────────────────────────────────────
      const maxLenObj = dict.get(PDFName.of('MaxLen'));
      const maxLen = maxLenObj ? maxLenObj.asNumber() : null;

      // ── Appearance Stream (AP) ────────────────────────────────────────────
      // An AP dict with a /N (normal) entry means the field has a pre-baked bitmap.
      // If the bitmap was generated at a wrong height, text will be clipped
      // even if we write /V correctly. The viewer may render the AP stream
      // instead of re-rendering from /V.
      const apObj = dict.get(PDFName.of('AP'));
      let apInfo = null;
      if (apObj) {
        try {
          // Check if /AP has /N (normal appearance)
          const apDict = apObj;
          const apNObj = apDict.get ? apDict.get(PDFName.of('N')) : null;
          if (apNObj) {
            // Try to get stream length if it's a content stream
            let streamLen = null;
            let streamPreview = null;
            try {
              const streamBytes = apNObj.getContents ? apNObj.getContents() : null;
              if (streamBytes) {
                streamLen = streamBytes.length;
                // Decode first 300 bytes of AP stream content as text
                streamPreview = new TextDecoder().decode(streamBytes.slice(0, 300));
              }
            } catch (_) {}

            // Check /BBox in the appearance stream dict
            let apBBox = null;
            try {
              const apStreamDict = apNObj.dict;
              if (apStreamDict) {
                const bboxObj = apStreamDict.get(PDFName.of('BBox'));
                if (bboxObj) {
                  apBBox = bboxObj.asArray().map(n => parseFloat(n.asNumber().toFixed(2)));
                }
              }
            } catch (_) {}

            apInfo = {
              has_N_stream: true,
              stream_length_bytes: streamLen,
              stream_preview_first_300_chars: streamPreview,
              ap_bbox: apBBox,
              ap_bbox_height: apBBox ? parseFloat(Math.abs(apBBox[3] - apBBox[1]).toFixed(2)) : null,
            };
          } else {
            apInfo = { has_N_stream: false, raw: 'AP dict exists but no /N entry' };
          }
        } catch (e) {
          apInfo = { error: e.message };
        }
      } else {
        apInfo = null; // No AP — viewer renders from /V directly
      }

      // ── Widgets (for page placement) ──────────────────────────────────────
      let widgetInfo = [];
      try {
        const widgets = acroField.getWidgets();
        widgetInfo = widgets.map(w => {
          const wd = w.dict;
          const wrectObj = wd.get(PDFName.of('Rect'));
          let wrect = null, wh = null;
          if (wrectObj) {
            const wa = wrectObj.asArray();
            if (wa && wa.length === 4) {
              wrect = wa.map(n => parseFloat(n.asNumber().toFixed(2)));
              wh = parseFloat(Math.abs(wrect[3] - wrect[1]).toFixed(2));
            }
          }
          return { widget_rect: wrect, widget_height_pts: wh };
        });
      } catch (_) {}

      // ── Capacity estimate (at 10pt Helvetica, avg char 5.5pt, line height 13pt) ──
      // These are the metrics used in the current generateWSAPDF character limits.
      const charsPerLine10pt = widthPts ? Math.floor((widthPts - 4) / 5.5) : null;
      const linesAt10pt      = heightPts ? Math.floor((heightPts - 4) / 13) : null;
      const capacityAt10pt   = (charsPerLine10pt && linesAt10pt) ? charsPerLine10pt * linesAt10pt : null;

      // At 12pt (original DA font size if not overridden)
      const charsPerLine12pt = widthPts ? Math.floor((widthPts - 4) / 6.5) : null;
      const linesAt12pt      = heightPts ? Math.floor((heightPts - 4) / 16) : null;
      const capacityAt12pt   = (charsPerLine12pt && linesAt12pt) ? charsPerLine12pt * linesAt12pt : null;

      results.push({
        field: fieldName,
        // ── Geometry ──
        rect_pts: rect,
        width_pts: widthPts,
        height_pts: heightPts,
        widget_info: widgetInfo,
        // ── Flags ──
        flags_hex: `0x${flags.toString(16).toUpperCase()}`,
        flags_decimal: flags,
        isMultiline,
        isReadOnly,
        isPassword,
        doNotScroll_BIT22: doNotScroll,  // ← if true, text IS clipped to visible rect
        isComb,
        isRichText,
        // ── Appearance ──
        default_appearance_DA: da,
        maxLen,
        ap_stream: apInfo,     // null = no AP (good); object = has pre-baked AP
        // ── Capacity at different font sizes ──
        capacity_10pt: { charsPerLine: charsPerLine10pt, lines: linesAt10pt, total: capacityAt10pt },
        capacity_12pt: { charsPerLine: charsPerLine12pt, lines: linesAt12pt, total: capacityAt12pt },
      });
    }

    return Response.json({ ok: true, fields_inspected: results.length, results });
  } catch (error) {
    console.error('inspectWSAPDFField error:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});