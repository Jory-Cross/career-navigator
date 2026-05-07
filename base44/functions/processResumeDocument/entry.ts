import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

// ─── Text Extraction Helpers ───────────────────────────────────────────────

async function extractTextFromPDF(arrayBuffer) {
  // Use pdf-parse via npm for text-layer PDFs (no OCR)
  const { default: pdfParse } = await import("npm:pdf-parse@1.1.1");
  const buffer = new Uint8Array(arrayBuffer);
  const result = await pdfParse(buffer);
  return result.text || "";
}

async function extractTextFromDOCX(arrayBuffer) {
  const { default: mammoth } = await import("npm:mammoth@1.8.0");
  const buffer = new Uint8Array(arrayBuffer);
  const result = await mammoth.extractRawText({ buffer });
  return result.value || "";
}

function extractTextFromTXT(arrayBuffer) {
  const decoder = new TextDecoder("utf-8");
  return decoder.decode(arrayBuffer);
}

async function extractText(fileUrl, fileName) {
  const ext = (fileName || "").split(".").pop().toLowerCase();

  console.log(`[processResumeDocument] Fetching file: ${fileUrl} (ext: ${ext})`);
  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch file: HTTP ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  console.log(`[processResumeDocument] File fetched, size: ${arrayBuffer.byteLength} bytes`);

  if (ext === "pdf") {
    console.log("[processResumeDocument] Extracting text from PDF...");
    const text = await extractTextFromPDF(arrayBuffer);
    console.log(`[processResumeDocument] PDF extraction success, chars: ${text.length}`);
    return text;
  }

  if (ext === "docx") {
    console.log("[processResumeDocument] Extracting text from DOCX...");
    const text = await extractTextFromDOCX(arrayBuffer);
    console.log(`[processResumeDocument] DOCX extraction success, chars: ${text.length}`);
    return text;
  }

  if (ext === "txt") {
    console.log("[processResumeDocument] Extracting text from TXT...");
    const text = extractTextFromTXT(arrayBuffer);
    console.log(`[processResumeDocument] TXT extraction success, chars: ${text.length}`);
    return text;
  }

  throw new Error(`Unsupported file type: .${ext}. Supported: pdf, docx, txt`);
}

// ─── AI Analysis ──────────────────────────────────────────────────────────

async function runAIAnalysis(extractedText, fileName) {
  const openAiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openAiKey) throw new Error("OPENAI_API_KEY is not configured");

  const truncated = extractedText.slice(0, 12000); // keep within token limits

  const prompt = `You are an employment specialist AI for a vocational rehabilitation CRM.

Analyze the following document text and provide a structured employment-focused analysis.

Your goals:
1. Extract realistic, specific employment skills (hard and soft skills — NO section heading labels)
2. Extract job titles and brief work history entries if clearly present
3. Write a vocational summary (2–3 sentences) focused on strengths for employment
4. Identify any employment barriers or support needs ONLY if clearly evident in the text
5. Keep all analysis grounded in the actual document content

Do NOT include generic terms like: "resume", "skills", "work history", "employment history", "job seeking", "professional summary", "contact information", "section titles", or any document structure labels as tags.

Return ONLY valid JSON in this exact format:
{
  "ai_summary": "2–3 sentence vocational summary",
  "ai_tags": ["skill1", "skill2", "job_title_if_found", ...],
  "ai_insights": "Paragraph noting vocational strengths, transferable skills, work history highlights, and any clearly identified support needs. Employment-focused."
}

Document file name: ${fileName || "unknown"}
Document text:
---
${truncated}
---`;

  console.log("[processResumeDocument] Sending text to OpenAI for analysis...");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You analyze documents for a vocational rehab CRM and must return valid JSON only. Focus exclusively on employment and vocational rehabilitation context.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("[processResumeDocument] OpenAI API error:", data);
    throw new Error(`OpenAI error: ${data?.error?.message || response.statusText}`);
  }

  const rawContent = data.choices?.[0]?.message?.content || "{}";
  const cleaned = rawContent
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  const parsed = JSON.parse(cleaned);
  console.log("[processResumeDocument] AI analysis success");
  return parsed;
}

// ─── Main Handler ──────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { documentId } = body;

    if (!documentId) {
      return Response.json(
        { success: false, error: "Missing required parameter: documentId" },
        { status: 400 }
      );
    }

    // ── 1. Load Document record ──────────────────────────────────────────
    console.log(`[processResumeDocument] Loading document: ${documentId}`);
    let doc = null;
    try {
      const documents = await base44.asServiceRole.entities.Document.filter({ id: documentId });
      doc = documents?.[0];
    } catch {
      // filter throws if id is invalid format
      doc = null;
    }

    if (!doc) {
      return Response.json(
        { success: false, error: `Document not found: ${documentId}` },
        { status: 404 }
      );
    }

    if (!doc.file_url) {
      return Response.json(
        { success: false, error: "Document has no file_url" },
        { status: 400 }
      );
    }

    console.log(`[processResumeDocument] Document loaded: "${doc.title}" (${doc.file_name})`);

    // ── 2. Extract text ──────────────────────────────────────────────────
    let extractedText = "";
    try {
      extractedText = await extractText(doc.file_url, doc.file_name || doc.title || "");
    } catch (extractError) {
      console.error("[processResumeDocument] Text extraction failed:", extractError.message);
      return Response.json({
        success: false,
        extracted_text_length: 0,
        error: `Text extraction failed: ${extractError.message}`,
      });
    }

    if (!extractedText || extractedText.trim().length < 20) {
      console.warn("[processResumeDocument] Extracted text is too short or empty");
      return Response.json({
        success: false,
        extracted_text_length: extractedText.length,
        error: "Extracted text is too short to analyze. The file may be image-based or empty.",
      });
    }

    // ── 3. Run AI analysis ───────────────────────────────────────────────
    let aiResult = null;
    try {
      aiResult = await runAIAnalysis(extractedText, doc.file_name || doc.title || "");
    } catch (aiError) {
      console.error("[processResumeDocument] AI analysis failed:", aiError.message);
      return Response.json({
        success: false,
        extracted_text_length: extractedText.length,
        error: `AI analysis failed: ${aiError.message}`,
      });
    }

    const ai_summary = aiResult?.ai_summary || "";
    const ai_tags = Array.isArray(aiResult?.ai_tags) ? aiResult.ai_tags : [];
    const ai_insights = aiResult?.ai_insights || "";

    // ── 4. Update Document entity ────────────────────────────────────────
    try {
      await base44.asServiceRole.entities.Document.update(documentId, {
        ai_summary,
        ai_tags,
        ai_insights,
        ai_last_processed: new Date().toISOString(),
      });
      console.log(`[processResumeDocument] Document updated successfully: ${documentId}`);
    } catch (updateError) {
      console.error("[processResumeDocument] Document update failed:", updateError.message);
      // Return the analysis even if the DB update fails
      return Response.json({
        success: false,
        extracted_text_length: extractedText.length,
        ai_summary,
        ai_tags,
        ai_insights,
        error: `Document update failed: ${updateError.message}`,
      });
    }

    // ── 5. Return structured response ────────────────────────────────────
    return Response.json({
      success: true,
      extracted_text_length: extractedText.length,
      ai_summary,
      ai_tags,
      ai_insights,
    });
  } catch (error) {
    const message = error?.message || String(error) || "Unexpected error";
    console.error("[processResumeDocument] Fatal error:", message);
    return Response.json({ success: false, error: message }, { status: 500 });
  }
});