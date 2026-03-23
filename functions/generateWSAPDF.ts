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

    // Explicit field name mapping from response keys → PDF field names
    const FIELD_MAP = {
      crp_referring_to: 'CRP Referring to',
      referral_question: 'Referral question',
      guardian_name_phone: 'If yes, Parent/Guardian name and phone',
      benefits_summary_info: 'Benefits Summary Info',
      other_services_benefits: 'Other Services/Benefits',
      current_work_skills: 'Current Work Skills',
      work_skill_development_needs: 'Work Skill Development Needs',
      jobs_of_interest: 'Jobs of Interest',
      interpersonal_social_skills: 'Interpersonal/Social Skills',
      assistive_technology_needs: 'Identified Assistive Technology Needs',
      communication_needs: 'Communication Needs',
      behavioral_self_regulation: 'Behavioral/Self-regulation',
      activities_of_daily_living: 'Activities of Daily Living',
      family_issues_supports: 'Family Issues/Supports',
      criminal_background: 'Criminal Background',
      school_academic: 'School/Academic',
      worksite_simulation_location: 'Worksite Simulation Location',
      work_assessment_observations: 'Observations',       // Work Assessment
      natural_support_observations: 'Observations_2',     // Natural Support
      life_skills_observations: 'Observations_3',         // Life Skills
      transportation_public: 'Public',
      transportation_private: 'Private transportation',
      transportation_observations: 'Observations_4',      // Transportation
      computer_skills_other: 'Other skills',
      computer_skill_observations: 'Observations_5',      // Computer Skill
      interview_skill_observations: 'Observations_6',     // Interview Skill
      other_observations: 'Other Observations',
      planned_job_search_hours_week: 'Planned Job Search hoursweek',
      life_skills_needed: 'Life Skills needed',
      life_skills_hours_requested: 'Life Skills hours requested',
      recommended_target_occupations: 'Recommended target occupations',
      recommended_supports_on_job: 'Recommended supports on the job',
      job_development_supports: 'Joint VRCRP Recommendations for Job Development Supports',
      ongoing_supports: 'Joint VRCRP Recommendations for Ongoing Supports',
      job_goal: 'Job Goal must align with IPE goal',
      industry_targeted_pay_range: 'Industry Targeted Pay Range',
      benefits_other: 'BenefitsOther',
      hours_available_to_work: 'Other_2',
      crp_name: 'Community Rehabilitation Program Name',
      assigned_employment_specialist: 'Assigned Employment SpecialistJob Coach',
    };

    // Try explicit mapping first, then fall back to fuzzy match
    for (const [key, value] of Object.entries(r)) {
      if (!value || key.startsWith('_')) continue;

      let fieldName = FIELD_MAP[key];
      let field = fieldName ? form.getFieldMaybe(fieldName) : null;

      // Fallback: fuzzy match with underscore→space normalization
      if (!field) {
        const normalizedKey = key.toLowerCase().replace(/_/g, ' ');
        const matchingField = fieldNames.find(fname => {
          const fn = fname.toLowerCase();
          return fn.includes(normalizedKey) || normalizedKey.includes(fn);
        });
        if (matchingField) field = form.getFieldMaybe(matchingField);
      }

      if (field) {
        try {
          const fieldType = field.constructor.name;
          if (fieldType.includes('Text')) {
            field.setText(String(value));
            console.log(`✓ Set "${key}" → "${field.getName()}"`);
          } else if (fieldType.includes('Checkbox') && (value === 'Yes' || value === true)) {
            field.check();
            console.log(`✓ Checked "${key}" → "${field.getName()}"`);
          }
        } catch (e) {
          console.log(`✗ Error setting "${key}":`, e.message);
        }
      } else {
        console.log(`✗ No field found for "${key}"`);
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