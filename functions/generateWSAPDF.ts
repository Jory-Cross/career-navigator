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
    console.log('Available form fields:', fields.map(f => f.getName()));

    // Populate all form fields with assessment responses
    const fieldMap = {
      // Counselor Referral Page
      'Client Name': r.client_name || '',
      'Address': r.address || '',
      'City': r.city || '',
      'State': r.state || '',
      'ZIP': r.zip || '',
      'CRP Referring to': r.crp_referring_to || '',
      'Client Phone': r.client_phone || '',
      'Client Cell': r.client_cell || '',
      'Guardianship': r.guardianship || '',
      'If yes, Parent/Guardian name and phone': r.guardian_name_phone || '',
      'Referral question': r.referral_question || '',
      'Benefits Summary Info': r.benefits_summary_info || '',
      'Other Services/Benefits': r.other_services_benefits || '',
      // Client Description
      'Current Work Skills': r.current_work_skills || '',
      'Work Skill Development Needs': r.work_skill_development_needs || '',
      'Jobs of Interest': r.jobs_of_interest || '',
      'Interpersonal/Social Skills': r.interpersonal_social_skills || '',
      'Identified Assistive Technology Needs': r.assistive_technology_needs || '',
      'Communication Needs': r.communication_needs || '',
      'Behavioral/Self-regulation': r.behavioral_self_regulation || '',
      'Activities of Daily Living': r.activities_of_daily_living || '',
      'Family Issues/Supports': r.family_issues_supports || '',
      'Criminal Background': r.criminal_background || '',
      'School/Academic': r.school_academic || '',
      // CRP Observation and Report
      'Worksite Simulation Location': r.worksite_simulation_location || '',
      'Work Assessment Observations': r.work_assessment_observations || '',
      'Natural Support Assessment Observations': r.natural_support_observations || '',
      'Life Skills Observations': r.life_skills_observations || '',
      'Public': r.transportation_public || '',
      'Private transportation': r.transportation_private || '',
      'Transportation Assessment Observations': r.transportation_observations || '',
      'Computer Skill Assessment Other': r.computer_skills_other || '',
      'Computer Skill Assessment Observations': r.computer_skill_observations || '',
      'Interview Skill Assessment Observations': r.interview_skill_observations || '',
      'Other Observations': r.other_observations || '',
      // Recommendations
      'Planned Job Search hours/week': r.planned_job_search_hours_week || '',
      'Life Skills needed': r.life_skills_needed || '',
      'Life Skills hours requested': r.life_skills_hours_requested || '',
      'Recommended target occupations': r.recommended_target_occupations || '',
      'Recommended supports on the job': r.recommended_supports_on_job || '',
      // Team Section
      'Community Rehabilitation Program Name': r.crp_name || '',
      'Assigned Employment Specialist/Job Coach': r.assigned_employment_specialist || '',
      'Joint VR/CRP Job Development Supports': r.job_development_supports || '',
      'Joint VR/CRP Ongoing Supports': r.ongoing_supports || '',
      'Job Goal': r.job_goal || '',
      'Industry Targeted Pay Range': r.industry_targeted_pay_range || '',
      'Benefits/Other': r.benefits_other || '',
      'Hours available to work': r.hours_available_to_work || ''
    };

    // Set text fields
    for (const [fieldLabel, value] of Object.entries(fieldMap)) {
      try {
        const field = form.getFieldMaybe(fieldLabel);
        if (field && value) {
          field.setText(value);
        }
      } catch (e) {
        // Field might not exist, continue
      }
    }

    // Handle checkbox fields
    const checkboxMap = {
      'Guardianship Yes': r.guardianship === 'Yes',
      'Guardianship No': r.guardianship === 'No',
      'ACRE Certified Yes': r.acre_certified === 'Yes',
      'ACRE Certified No': r.acre_certified === 'No'
    };

    for (const [fieldLabel, checked] of Object.entries(checkboxMap)) {
      try {
        const field = form.getFieldMaybe(fieldLabel);
        if (field && checked) {
          field.check();
        }
      } catch (e) {
        // Field might not exist, continue
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