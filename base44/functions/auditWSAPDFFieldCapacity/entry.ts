import { PDFDocument } from 'npm:pdf-lib@1.17.1';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Utah DWS WSA fillable PDF
const FILLABLE_WSA_URL = 'https://jobs.utah.gov/usor/vr/partners/usor94.pdf';

// The WSA observation/narrative fields we need to measure.
// These are the internal PDF field names mapped to our app keys.
const FIELDS_TO_AUDIT = {
  worksite_simulation_location: 'Worksite Simulation Location',
  work_assessment_observations: 'Work Assessment Observations',
  natural_support_observations: 'Natural Support Assessment Observations',
  life_skills_observations: 'Life Skills Observations',
  transportation_public: 'Public Transportation Options (text)',
  transportation_private: 'Private Transportation Options (text)',
  transportation_observations: 'Transportation Assessment Observations',
  computer_skills_other: 'Other skills (text)',
  computer_skill_observations: 'Computer Skill Assessment Observations',
  interview_skill_observations: 'Interview Skill Assessment Observations',
  other_observations: 'Other Observations',
  current_work_skills: 'Current Work Skills knowledge skills and abilities',
  work_skill_development_needs: 'Work Skill Development Needs',
  recommended_supports_on_job: 'Recommended supports on the job',
  job_development_supports: 'Joint VR/CRP Recommendations for Job Development Supports',
  ongoing_supports: 'Joint VR/CRP Recommendations for Ongoing Supports',
  behavioral_self_regulation: 'BehavioralSelfregulation',
  activities_of_daily_living: 'Activities of Daily Living hygiene meal prep etc',
  family_issues_supports: 'Family IssuesSupports',
  criminal_background: 'Criminal Background expungement etc',
  school_academic: 'SchoolAcademic can include behavioral information',
  communication_needs: 'Communication Needs interpreter etc',
  assistive_technology_needs: 'Identified Assistive Technology Needs glasses UCAT device etc',
  interpersonal_social_skills: 'informalformal speech',
  referral_question: 'Referral question',
  jobs_of_interest: 'Jobs of Interest_1',
  life_skills_needed: 'Life Skills needed',
  planned_job_search_hours_week: 'Planned Job Search hours/week',
  recommended_target_occupations: 'Recommended target occupations_1',
  industry_targeted_pay_range: 'Industry Targeted Pay Range',
  job_goal: 'Job Goal (must align with IPE goal)',
  benefits_other: 'Benefits/Other',
  hours_available_to_work: 'Other hours available to work',
};

// Current limits in generateWSAAIOutputs and generateWSAPDF
const CURRENT_WSA_CHAR_LIMITS = {
  worksite_simulation_location: 180,
  work_assessment_observations: 900,
  natural_support_observations: 850,
  life_skills_observations: 850,
  transportation_public: 220,
  transportation_private: 220,
  transportation_observations: 850,
  computer_skills_other: 220,
  computer_skill_observations: 850,
  interview_skill_observations: 850,
  other_observations: 850,
  current_work_skills: 950,
  work_skill_development_needs: 950,
  recommended_supports_on_job: 950,
  job_development_supports: 950,
  ongoing_supports: 950,
  behavioral_self_regulation: 850,
  activities_of_daily_living: 850,
  family_issues_supports: 850,
  criminal_background: 850,
  school_academic: 850,
  communication_needs: 700,
  assistive_technology_needs: 700,
  interpersonal_social_skills: 700,
  referral_question: 900,
  jobs_of_interest: 300,
  life_skills_needed: 300,
  planned_job_search_hours_week: 80,
  recommended_target_occupations: 350,
  industry_targeted_pay_range: 180,
  job_goal: 350,
  benefits_other: 350,
  hours_available_to_work: 250,
};

// Typical PDF fonts used in form fields: Helvetica at ~10-12pt
// At 10pt in a standard PDF text field:
//   - Average character width ≈ 5.5–6 pt (mixed case prose)
//   - Line height ≈ 14 pt (10pt font + leading)
// This gives us: chars_per_line = floor(field_width / avg_char_width)
//                lines = floor(field_height / line_height)
//                capacity = chars_per_line * lines
// We use 6pt avg char width and 14pt line height as conservative estimates for
// Helvetica 10pt mixed-case narrative text. These are well-established PDF typesetting
// constants for this font at this size.
const AVG_CHAR_WIDTH_PT = 6.0;   // conservative for mixed-case Helvetica 10pt
const LINE_HEIGHT_PT = 14;        // 10pt font + 4pt leading
const SAFETY_MARGIN = 0.82;       // 18% margin to prevent visual overflow at boundaries

function estimateCapacity(widthPt, heightPt) {
  const charsPerLine = Math.floor(widthPt / AVG_CHAR_WIDTH_PT);
  const lines = Math.floor(heightPt / LINE_HEIGHT_PT);
  const rawCapacity = charsPerLine * lines;
  const safeCapacity = Math.floor(rawCapacity * SAFETY_MARGIN);
  return { charsPerLine, lines, rawCapacity, safeCapacity };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    console.log('Fetching WSA PDF for field geometry audit...');
    const pdfResponse = await fetch(FILLABLE_WSA_URL);
    if (!pdfResponse.ok) throw new Error(`Failed to fetch PDF: ${pdfResponse.status}`);
    const pdfBytes = await pdfResponse.arrayBuffer();

    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const form = pdfDoc.getForm();

    const auditResults = {};
    const recommendedSafeLimits = {};
    const discrepancies = [];

    for (const [appKey, pdfFieldName] of Object.entries(FIELDS_TO_AUDIT)) {
      try {
        const field = form.getFieldMaybe(pdfFieldName);
        if (!field) {
          auditResults[appKey] = { found: false, pdfFieldName };
          continue;
        }

        // Get the field's widget annotations to read its rectangle (position + size)
        const widgets = field.acroField.getWidgets();
        if (!widgets || widgets.length === 0) {
          auditResults[appKey] = { found: true, pdfFieldName, error: 'No widgets found' };
          continue;
        }

        const widget = widgets[0];
        const rect = widget.getRectangle();
        const widthPt = rect.width;
        const heightPt = rect.height;

        const capacity = estimateCapacity(widthPt, heightPt);
        const currentLimit = CURRENT_WSA_CHAR_LIMITS[appKey] || null;

        const result = {
          found: true,
          pdfFieldName,
          widthPt: Math.round(widthPt),
          heightPt: Math.round(heightPt),
          charsPerLine: capacity.charsPerLine,
          lines: capacity.lines,
          rawCapacityEstimate: capacity.rawCapacity,
          recommendedSafeLimit: capacity.safeCapacity,
          currentWSACharLimit: currentLimit,
          overLimit: currentLimit !== null && currentLimit > capacity.safeCapacity,
          gap: currentLimit !== null ? currentLimit - capacity.safeCapacity : null,
        };

        auditResults[appKey] = result;
        recommendedSafeLimits[appKey] = capacity.safeCapacity;

        if (result.overLimit) {
          discrepancies.push({
            field: appKey,
            currentLimit,
            recommendedSafeLimit: capacity.safeCapacity,
            over: currentLimit - capacity.safeCapacity,
          });
        }

        console.log(`${appKey}: ${Math.round(widthPt)}x${Math.round(heightPt)}pt → ~${capacity.rawCapacity} raw chars → ${capacity.safeCapacity} safe | current limit: ${currentLimit}`);
      } catch (e) {
        auditResults[appKey] = { found: false, pdfFieldName, error: e.message };
        console.log(`ERROR auditing ${appKey}:`, e.message);
      }
    }

    // Summary of priority fields
    const priorityFields = ['natural_support_observations', 'work_assessment_observations', 'recommended_supports_on_job', 'interview_skill_observations', 'other_observations'];
    const prioritySummary = priorityFields.map(key => ({
      field: key,
      currentLimit: CURRENT_WSA_CHAR_LIMITS[key],
      recommendedSafeLimit: recommendedSafeLimits[key] || null,
      dimensions: auditResults[key] ? `${auditResults[key].widthPt}x${auditResults[key].heightPt}pt` : 'N/A',
      overLimit: auditResults[key]?.overLimit || false,
    }));

    return Response.json({
      success: true,
      methodology: {
        avgCharWidthPt: AVG_CHAR_WIDTH_PT,
        lineHeightPt: LINE_HEIGHT_PT,
        safetyMargin: SAFETY_MARGIN,
        note: 'Character capacity estimated from PDF field rectangle dimensions using Helvetica 10pt constants. Safety margin applied to prevent visual overflow near field boundaries.'
      },
      priority_fields_summary: prioritySummary,
      recommended_safe_limits: recommendedSafeLimits,
      all_fields: auditResults,
      discrepancies_current_vs_safe: discrepancies,
    });
  } catch (error) {
    console.error('Audit error:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});