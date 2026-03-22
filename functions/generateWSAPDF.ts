import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import { PDFDocument } from 'npm:pdf-lib@1.17.1';

const FILLABLE_WSA_URL = 'https://media.base44.com/files/public/69975ef9c220200194235cef/7d58a8997_usor94.pdf';

// Draw wrapped text inside a box area, returns final y position
function drawWrappedText(page, text, x, y, maxWidth, lineHeight, font, fontSize) {
  if (!text || !text.trim()) return y;
  const paragraphs = text.split('\n');
  let currentY = y;
  for (const para of paragraphs) {
    const words = para.split(' ');
    let line = '';
    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      const testWidth = font.widthOfTextAtSize(testLine, fontSize);
      if (testWidth > maxWidth && line) {
        page.drawText(line, { x, y: currentY, size: fontSize, font, color: rgb(0, 0, 0) });
        line = word;
        currentY -= lineHeight;
      } else {
        line = testLine;
      }
    }
    if (line) {
      page.drawText(line, { x, y: currentY, size: fontSize, font, color: rgb(0, 0, 0) });
      currentY -= lineHeight;
    }
  }
  return currentY;
}

function drawLine(page, text, x, y, font, fontSize) {
  if (!text || !text.trim()) return;
  page.drawText(text, { x, y, size: fontSize, font, color: rgb(0, 0, 0) });
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
    console.log('Assessment responses keys:', Object.keys(r));

    // Use uploaded PDF as base (preserves pages 1-3 with extracted data), or blank template for complete filling
    const sourceUrl = r._uploaded_pdf_url || BLANK_WSA_URL;
    console.log('Loading PDF from:', sourceUrl);
    console.log('Using uploaded PDF:', !!r._uploaded_pdf_url);

    const pdfResponse = await fetch(sourceUrl);
    if (!pdfResponse.ok) throw new Error(`Failed to fetch PDF: ${pdfResponse.status}`);
    const pdfBytes = await pdfResponse.arrayBuffer();

    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const pages = pdfDoc.getPages();

    console.log(`PDF has ${pages.length} pages`);

    const fs = 9;    // font size
    const lh = 11;   // line height
    const bw = 505;  // box width

    // ── PAGE 1-3 (index 0-2) ─── Counselor Referral & Client Description ─────
    // Fill counselor referral page fields (page 1)
    if (pages.length > 0) {
      const p = pages[0];
      drawLine(p, r.crp_referring_to, 160, 605, font, fs);
      drawLine(p, r.guardianship === 'Yes' ? 'X' : '', 53, 586, font, 10);
      drawLine(p, r.guardianship === 'No' ? 'X' : '', 85, 586, font, 10);
      drawLine(p, r.guardian_name_phone, 48, 558, font, fs);
      drawWrappedText(p, r.referral_question, 48, 520, bw, lh, font, fs);
      drawWrappedText(p, r.extended_services_provider, 48, 388, bw, lh, font, fs);
      drawWrappedText(p, r.health_insurance, 48, 300, bw, lh, font, fs);
      drawWrappedText(p, r.social_security_benefits, 180, 280, bw, lh, font, fs);
      // Benefits planning checkboxes
      if (r.benefits_planning === 'Completed') drawLine(p, 'X', 108, 268, font, 10);
      else if (r.benefits_planning === 'Pending – Date Scheduled') drawLine(p, 'X', 174, 268, font, 10);
      else if (r.benefits_planning === 'Not Applicable') drawLine(p, 'X', 318, 268, font, 10);
      drawLine(p, r.benefits_planning_date, 380, 268, font, fs);
      drawWrappedText(p, r.benefits_summary_info, 48, 245, bw, lh, font, fs);
      drawWrappedText(p, r.other_services_benefits, 48, 160, bw, lh, font, fs);
    }

    // Fill client description page fields (pages 2-3)
    if (pages.length > 1) {
      const p = pages[1];
      drawWrappedText(p, r.current_work_skills, 48, 672, bw, lh, font, fs);
      drawWrappedText(p, r.work_skill_development_needs, 48, 540, bw, lh, font, fs);
      drawLine(p, r.jobs_of_interest, 160, 427, font, fs);
      drawWrappedText(p, r.interpersonal_social_skills, 48, 397, bw, lh, font, fs);
      drawWrappedText(p, r.assistive_technology_needs, 48, 290, bw, lh, font, fs);
      drawWrappedText(p, r.communication_needs, 48, 180, bw, lh, font, fs);
    }

    if (pages.length > 2) {
      const p = pages[2];
      drawWrappedText(p, r.behavioral_self_regulation, 48, 672, bw, lh, font, fs);
      drawWrappedText(p, r.activities_of_daily_living, 48, 570, bw, lh, font, fs);
      drawWrappedText(p, r.family_issues_supports, 48, 428, bw, lh, font, fs);
      drawWrappedText(p, r.criminal_background, 48, 310, bw, lh, font, fs);
      drawWrappedText(p, r.school_academic, 48, 190, bw, lh, font, fs);
    }

    // ── PAGE 4 (index 3) ─── CRP Observation and Report ──────────────────────
    if (pages.length > 3) {
      const p = pages[3];
      // Worksite Simulation Location inline
      drawLine(p, r.worksite_simulation_location, 222, 554, font, fs);
      // Work Assessment Observations box (top of box ~535, label above)
      drawWrappedText(p, r.work_assessment_observations, 48, 523, bw, lh, font, fs);
      // Natural Support Assessment Observations
      drawWrappedText(p, r.natural_support_observations, 48, 345, bw, lh, font, fs);
      // Life Skills Observations
      drawWrappedText(p, r.life_skills_observations, 48, 162, bw, lh, font, fs);
    }

    // ── PAGE 5 (index 4) ─── Transportation, Computer, Interview ─────────────
    if (pages.length > 4) {
      const p = pages[4];
      // Transportation Public inline
      drawLine(p, r.transportation_public, 122, 672, font, fs);
      // Transportation Private inline
      drawLine(p, r.transportation_private, 185, 653, font, fs);
      // Transportation Observations box
      drawWrappedText(p, r.transportation_observations, 48, 598, bw, lh, font, fs);
      // Computer Skills Other (inline field)
      drawLine(p, r.computer_skills_other, 48, 408, font, fs);
      // Computer Skill Observations box
      drawWrappedText(p, r.computer_skill_observations, 48, 363, bw, lh, font, fs);
      // Interview Skill Observations box
      drawWrappedText(p, r.interview_skill_observations, 48, 165, bw, lh, font, fs);
    }

    // ── PAGE 6 (index 5) ─── Other Observations, Recommendations, Team ───────
    if (pages.length > 5) {
      const p = pages[5];
      // Other Observations box (top of page)
      drawWrappedText(p, r.other_observations, 48, 672, bw, lh, font, fs);
      // Planned Job Search hours/week inline
      drawLine(p, r.planned_job_search_hours_week, 242, 486, font, fs);
      // Life Skills needed box
      drawWrappedText(p, r.life_skills_needed, 48, 460, bw, lh, font, fs);
      // Life Skills hours requested inline
      drawLine(p, r.life_skills_hours_requested, 190, 296, font, fs);
      // Recommended target occupations (3 slots on one line)
      if (r.recommended_target_occupations) {
        drawLine(p, r.recommended_target_occupations, 48, 267, font, fs);
      }
      // Recommended supports on the job box
      drawWrappedText(p, r.recommended_supports_on_job, 48, 222, bw, lh, font, fs);
      // CRP Name inline
      drawLine(p, r.crp_name, 242, 66, font, fs);
      // Assigned Employment Specialist inline
      drawLine(p, r.assigned_employment_specialist, 262, 50, font, fs);
      // ACRE Certified checkboxes
      if (r.acre_certified === 'Yes') {
        drawLine(p, 'X', 174, 35, font, 10);
      } else if (r.acre_certified === 'No') {
        drawLine(p, 'X', 206, 35, font, 10);
      }
    }

    // ── PAGE 7 (index 6) ─── Joint Recommendations, Job Goal, Hours ──────────
    if (pages.length > 6) {
      const p = pages[6];
      // Joint VR/CRP Job Development Supports box
      drawWrappedText(p, r.job_development_supports, 48, 672, bw, lh, font, fs);
      // Joint VR/CRP Ongoing Supports box
      drawWrappedText(p, r.ongoing_supports, 48, 462, bw, lh, font, fs);
      // Job Goal inline
      drawLine(p, r.job_goal, 218, 263, font, fs);
      // Industry Targeted Pay Range inline
      drawLine(p, r.industry_targeted_pay_range, 218, 245, font, fs);
      // Benefits/Other inline
      drawLine(p, r.benefits_other, 148, 228, font, fs);
      // Hours available to work - just render as text
      if (r.hours_available_to_work) {
        drawLine(p, r.hours_available_to_work, 48, 200, font, fs);
      }
    }

    const modifiedPdfBytes = await pdfDoc.save();

    // Upload completed PDF as a File object
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