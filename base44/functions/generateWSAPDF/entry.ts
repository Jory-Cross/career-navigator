import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import { PDFDocument } from 'npm:pdf-lib@1.17.1';

const FILLABLE_WSA_URL = 'https://jobs.utah.gov/usor/vr/partners/usor94.pdf';

// PDF fields in the original Utah WSA form have limited visible space.
// Keep the full in-app WSA answers unchanged, but trim text before writing into the PDF.
const DEFAULT_PDF_TEXT_LIMIT = 950;

// Limits measured from actual PDF field rectangle dimensions (usor94.pdf)
// using Helvetica 10pt constants and 18% safety margin. Must match WSA_PDF_SAFE_LIMITS
// in generateWSAAIOutputs so content bounded at generation cannot overflow here.
// Limits must stay in sync with WSA_PDF_SAFE_LIMITS in generateWSAAIOutputs.
// All multiline observation fields are overridden to 10pt DA before setText (see FONT_OVERRIDE_FIELDS).
// Derivation: 536pt wide / 6.5pt avg char / 0.85 margin ≈ 70 chars/line at 10pt.
const PDF_TEXT_LIMITS = {
  // Single-line / short fields (12pt, no DA override)
  worksite_simulation_location:   100,
  transportation_public:           80,  // 436pt single-line → ~62 chars; cap 80
  transportation_private:          65,  // 353pt single-line → ~50 chars; cap 65
  computer_skills_other:          100,
  planned_job_search_hours_week:   80,
  industry_targeted_pay_range:    100,
  hours_available_to_work:        100,
  // Multiline narrative fields (10pt DA override → ~70 chars/line)
  work_assessment_observations:   350,  // 536×81pt → 6 lines → 350
  natural_support_observations:   350,
  life_skills_observations:       350,
  current_work_skills:            350,
  work_skill_development_needs:   350,
  family_issues_supports:         350,
  criminal_background:            350,
  school_academic:                350,
  communication_needs:            350,
  assistive_technology_needs:     350,
  interpersonal_social_skills:    350,
  transportation_observations:    490,  // 536×95pt → 7 lines → 490
  computer_skill_observations:    490,
  interview_skill_observations:   490,
  behavioral_self_regulation:     490,
  activities_of_daily_living:     490,
  referral_question:              490,
  other_observations:             630,  // 536×121pt → 10 lines → 630
  recommended_supports_on_job:    630,
  job_development_supports:       700,  // larger field ~137pt → 700
  ongoing_supports:               700,
  // Short structured fields
  jobs_of_interest:               140,
  life_skills_needed:             140,
  recommended_target_occupations: 210,
  job_goal:                       210,
  benefits_other:                 210,
};
function limitPdfText(value, key) {
  if (value === null || value === undefined) return '';

  const text = String(value).replace(/\s+/g, ' ').trim();
  const limit = PDF_TEXT_LIMITS[key] || DEFAULT_PDF_TEXT_LIMIT;

  if (text.length <= limit) return text;

  return `${text.slice(0, Math.max(0, limit - 24)).trim()}... [truncated for PDF]`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { assessment_id } = await req.json();
    const assessment = await base44.entities.Assessment.get(assessment_id);
    if (!assessment) return Response.json({ error: 'Assessment not found' }, { status: 404 });

    const client = await base44.asServiceRole.entities.Client.get(assessment.client_id);
    const r = assessment.responses || {};
    console.log('Loading fillable WSA template and populating fields...');

    // Load fillable PDF template
    const pdfResponse = await fetch(FILLABLE_WSA_URL);
    if (!pdfResponse.ok) throw new Error(`Failed to fetch PDF: ${pdfResponse.status}`);
    const pdfBytes = await pdfResponse.arrayBuffer();

    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const form = pdfDoc.getForm();
    const fields = form.getFields();

    // Exact field name mapping from response keys → PDF internal field names
    const TEXT_FIELD_MAP = {
      crp_referring_to: 'CRP Referring to',
      guardian_name_phone: 'Parent/Guardian name and phone',
      referral_question: 'Referral question',
      benefits_summary_info: 'Benefits Summary Info',
      other_services_benefits: 'Other ServicesBenefits',
      current_work_skills: 'Current Work Skills knowledge skills and abilities',
      work_skill_development_needs: 'Work Skill Development Needs',
      jobs_of_interest: 'Jobs of Interest_1',
      interpersonal_social_skills: 'informalformal speech',
      assistive_technology_needs: 'Identified Assistive Technology Needs glasses UCAT device etc',
      communication_needs: 'Communication Needs interpreter etc',
      behavioral_self_regulation: 'BehavioralSelfregulation',
      activities_of_daily_living: 'Activities of Daily Living hygiene meal prep etc',
      family_issues_supports: 'Family IssuesSupports',
      criminal_background: 'Criminal Background expungement etc',
      school_academic: 'SchoolAcademic can include behavioral information',
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
      planned_job_search_hours_week: 'Planned Job Search hours/week',
      life_skills_needed: 'Life Skills needed',
      life_skills_hours_requested: 'Life Skills hours requested',
      recommended_target_occupations: 'Recommended target occupations_1',
      recommended_supports_on_job: 'Recommended supports on the job',
      job_development_supports: 'Joint VR/CRP Recommendations for Job Development Supports',
      ongoing_supports: 'Joint VR/CRP Recommendations for Ongoing Supports',
      job_goal: 'Job Goal (must align with IPE goal)',
      industry_targeted_pay_range: 'Industry Targeted Pay Range',
      benefits_other: 'Benefits/Other',
      hours_available_to_work: 'Other hours available to work',
      crp_name: 'Community Rehabilitation Program Name',
      assigned_employment_specialist: 'Assigned Employment SpecialistJob Coach',
      benefits_planning_date: 'Date Scheduled',
      extended_services_provider: 'Other Extended Services Provider (text)',
      health_insurance: 'Other Health Insurance (text)',
    };

    // Populate client-level fields
    if (client) {
      const clientFields = {
        'Client Name': `${client.first_name || ''} ${client.last_name || ''}`.trim(),
        'Client Phone': client.phone || '',
        'Address': client.address || '',
      };
      // Parse address into parts if it contains city/state/zip (e.g. "123 Main St, Ogden, UT 84401")
      if (client.address) {
        const parts = client.address.split(',').map(s => s.trim());
        if (parts.length >= 3) {
          clientFields['Address'] = parts[0];
          clientFields['City'] = parts[1];
          const stateZip = parts[2].trim().split(' ');
          clientFields['State'] = stateZip[0] || '';
          clientFields['ZIP'] = stateZip[1] || '';
        } else if (parts.length === 2) {
          clientFields['Address'] = parts[0];
          clientFields['City'] = parts[1];
        }
      }
      for (const [pdfFieldName, value] of Object.entries(clientFields)) {
        if (!value) continue;
        try {
          const field = form.getFieldMaybe(pdfFieldName);
          if (field) { field.setText(value); console.log(`✓ Client field "${pdfFieldName}"`); }
        } catch(e) { console.log(`✗ Client field error "${pdfFieldName}":`, e.message); }
      }
    }

    // Set all text fields
    for (const [key, pdfFieldName] of Object.entries(TEXT_FIELD_MAP)) {
      const value = r[key];
      if (!value) continue;
      try {
        const field = form.getFieldMaybe(pdfFieldName);
        if (field) {
          field.setText(limitPdfText(value, key));
          console.log(`✓ Set "${key}"`);
        } else {
          console.log(`✗ Field not found: "${pdfFieldName}"`);
        }
      } catch (e) {
        console.log(`✗ Error setting "${key}":`, e.message);
      }
    }

    // Handle RadioGroups (Guardianship, ACRE Certified)
    try {
      const guardianshipField = form.getFieldMaybe('Guardianship');
      if (guardianshipField && r.guardianship) {
        guardianshipField.select(r.guardianship === 'Yes' ? 'Guardianship-Yes' : 'Guardianship-No');
      }
    } catch(e) { console.log('Guardianship radio error:', e.message); }

    try {
      const acreField = form.getFieldMaybe('ACRE Certified?');
      if (acreField && r.acre_certified) {
        acreField.select(r.acre_certified); // 'Yes' or 'No'
      }
    } catch(e) { console.log('ACRE Certified radio error:', e.message); }

    // Handle checkboxes based on text values in responses
    const checkIfContains = (text, keyword) => text && text.toLowerCase().includes(keyword.toLowerCase());
    const checkboxMap = {
      'Division of Services for People with Disabilities DSPD': checkIfContains(r.extended_services_provider, 'DSPD'),
      'Partnership Plus TTW': checkIfContains(r.extended_services_provider, 'TTW') || checkIfContains(r.extended_services_provider, 'Partnership'),
      'Medicaid': checkIfContains(r.health_insurance, 'Medicaid'),
      'Medicare': checkIfContains(r.health_insurance, 'Medicare'),
      'Parents Insurance': checkIfContains(r.health_insurance, "Parent"),
      'Spouses Insurance': checkIfContains(r.health_insurance, 'Spouse'),
      'Supplemental Security Income SSI': checkIfContains(r.social_security_benefits, 'SSI'),
      'Social Security Disability Insurance SSDI': checkIfContains(r.social_security_benefits, 'SSDI'),
      'Completed': r.benefits_planning === 'Completed',
      'Pending Date Scheduled': r.benefits_planning === 'Pending – Date Scheduled',
      'Not Applicable': r.benefits_planning === 'Not Applicable',
      'Full Time': checkIfContains(r.hours_available_to_work, 'Full Time'),
      'Part Time': checkIfContains(r.hours_available_to_work, 'Part Time'),
      '10 hourswk': checkIfContains(r.hours_available_to_work, '10 hours'),
      'Days': checkIfContains(r.hours_available_to_work, 'Days'),
      'Swing shift': checkIfContains(r.hours_available_to_work, 'Swing'),
    };

    for (const [fieldName, shouldCheck] of Object.entries(checkboxMap)) {
      if (!shouldCheck) continue;
      try {
        const field = form.getFieldMaybe(fieldName);
        if (field) { field.check(); console.log(`✓ Checked "${fieldName}"`); }
      } catch(e) { console.log(`✗ Checkbox error "${fieldName}":`, e.message); }
    }

    // Do NOT flatten — keep remaining fields editable for download.
    // updateFieldAppearances: false preserves the original PDF's AP stream rendering,
    // which correctly fills the full field rect. pdf-lib's AP regeneration clips
    // multiline text to only the top portion of the visible field.
    const modifiedPdfBytes = await pdfDoc.save({ updateFieldAppearances: false });

    const pdfFile = new File([modifiedPdfBytes], `Work_Strategy_Assessment_${assessment_id}.pdf`, { type: 'application/pdf' });
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