import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { PDFDocument } from 'npm:pdf-lib@1.17.1';

const FILLABLE_WSA_URL = 'https://jobs.utah.gov/usor/vr/partners/usor94.pdf';

function cleanPdfText(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

function getResponseValue(responses, officialFields, key) {
  if (officialFields && officialFields[key] !== undefined && officialFields[key] !== null) {
    return officialFields[key];
  }

  if (responses && responses[key] !== undefined && responses[key] !== null) {
    return responses[key];
  }

  return '';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const assessment_id = body && body.assessment_id;

    if (!assessment_id) {
      return Response.json({ success: false, error: 'assessment_id is required' }, { status: 400 });
    }

    const assessment = await base44.entities.Assessment.get(assessment_id);

    if (!assessment) {
      return Response.json({ success: false, error: 'Assessment not found' }, { status: 404 });
    }

    const responses = assessment.responses || {};

    const officialFields =
      responses.official_wsa_fields && typeof responses.official_wsa_fields === 'object'
        ? responses.official_wsa_fields
        : responses._official_wsa_fields && typeof responses._official_wsa_fields === 'object'
          ? responses._official_wsa_fields
          : {};

    let client = null;

    if (assessment.client_id) {
      try {
        client = await base44.asServiceRole.entities.Client.get(assessment.client_id);
      } catch (_error) {
        client = null;
      }
    }

    const pdfResponse = await fetch(FILLABLE_WSA_URL);

    if (!pdfResponse.ok) {
      throw new Error('Failed to fetch WSA PDF template: ' + pdfResponse.status);
    }

    const pdfBytes = await pdfResponse.arrayBuffer();
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const form = pdfDoc.getForm();

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

    if (client) {
      const clientFields = {
        'Client Name': [client.first_name, client.last_name].filter(Boolean).join(' '),
        'Client Phone': client.phone || '',
        Address: client.address || '',
      };

      if (client.address) {
        const parts = String(client.address).split(',').map((part) => part.trim());

        if (parts.length >= 3) {
          clientFields.Address = parts[0];
          clientFields.City = parts[1];

          const stateZip = parts[2].split(' ').filter(Boolean);
          clientFields.State = stateZip[0] || '';
          clientFields.ZIP = stateZip[1] || '';
        } else if (parts.length === 2) {
          clientFields.Address = parts[0];
          clientFields.City = parts[1];
        }
      }

      for (const pdfFieldName of Object.keys(clientFields)) {
        const text = cleanPdfText(clientFields[pdfFieldName]);
        if (!text) continue;

        try {
          const field = form.getFieldMaybe(pdfFieldName);
          if (field && typeof field.setText === 'function') {
            field.setText(text);
          }
        } catch (_error) {
          console.log('Client field skipped:', pdfFieldName);
        }
      }
    }

    for (const key of Object.keys(TEXT_FIELD_MAP)) {
      const pdfFieldName = TEXT_FIELD_MAP[key];
      const text = cleanPdfText(getResponseValue(responses, officialFields, key));

      if (!text) continue;

      try {
        const field = form.getFieldMaybe(pdfFieldName);

        if (field && typeof field.setText === 'function') {
          field.setText(text);
        }
      } catch (_error) {
        console.log('PDF field skipped:', key, pdfFieldName);
      }
    }

    try {
      const guardianshipField = form.getFieldMaybe('Guardianship');

      if (guardianshipField && responses.guardianship && typeof guardianshipField.select === 'function') {
        guardianshipField.select(
          responses.guardianship === 'Yes' ? 'Guardianship-Yes' : 'Guardianship-No'
        );
      }
    } catch (_error) {
      console.log('Guardianship field skipped');
    }

    try {
      const acreField = form.getFieldMaybe('ACRE Certified?');

      if (acreField && responses.acre_certified && typeof acreField.select === 'function') {
        acreField.select(responses.acre_certified);
      }
    } catch (_error) {
      console.log('ACRE field skipped');
    }

    function contains(value, keyword) {
      return cleanPdfText(value).toLowerCase().includes(keyword.toLowerCase());
    }

    const checkboxMap = {
      'Division of Services for People with Disabilities DSPD': contains(
        getResponseValue(responses, officialFields, 'extended_services_provider'),
        'DSPD'
      ),
      'Partnership Plus TTW':
        contains(getResponseValue(responses, officialFields, 'extended_services_provider'), 'TTW') ||
        contains(getResponseValue(responses, officialFields, 'extended_services_provider'), 'Partnership'),
      Medicaid: contains(getResponseValue(responses, officialFields, 'health_insurance'), 'Medicaid'),
      Medicare: contains(getResponseValue(responses, officialFields, 'health_insurance'), 'Medicare'),
      'Parents Insurance': contains(getResponseValue(responses, officialFields, 'health_insurance'), 'Parent'),
      'Spouses Insurance': contains(getResponseValue(responses, officialFields, 'health_insurance'), 'Spouse'),
      'Supplemental Security Income SSI': contains(
        getResponseValue(responses, officialFields, 'social_security_benefits'),
        'SSI'
      ),
      'Social Security Disability Insurance SSDI': contains(
        getResponseValue(responses, officialFields, 'social_security_benefits'),
        'SSDI'
      ),
      Completed: getResponseValue(responses, officialFields, 'benefits_planning') === 'Completed',
      'Pending Date Scheduled':
        getResponseValue(responses, officialFields, 'benefits_planning') === 'Pending – Date Scheduled',
      'Not Applicable':
        getResponseValue(responses, officialFields, 'benefits_planning') === 'Not Applicable',
      'Full Time': contains(getResponseValue(responses, officialFields, 'hours_available_to_work'), 'Full Time'),
      'Part Time': contains(getResponseValue(responses, officialFields, 'hours_available_to_work'), 'Part Time'),
      '10 hourswk': contains(getResponseValue(responses, officialFields, 'hours_available_to_work'), '10 hours'),
      Days: contains(getResponseValue(responses, officialFields, 'hours_available_to_work'), 'Days'),
      'Swing shift': contains(getResponseValue(responses, officialFields, 'hours_available_to_work'), 'Swing'),
    };

    for (const fieldName of Object.keys(checkboxMap)) {
      if (!checkboxMap[fieldName]) continue;

      try {
        const field = form.getFieldMaybe(fieldName);

        if (field && typeof field.check === 'function') {
          field.check();
        }
      } catch (_error) {
        console.log('Checkbox skipped:', fieldName);
      }
    }

    const modifiedPdfBytes = await pdfDoc.save({
      updateFieldAppearances: true,
    });

    const pdfFile = new File(
      [modifiedPdfBytes],
      'Work_Strategy_Assessment_' + assessment_id + '.pdf',
      { type: 'application/pdf' }
    );

    const uploadResult = await base44.integrations.Core.UploadFile({ file: pdfFile });
    const file_url = uploadResult.file_url;

    await base44.entities.Assessment.update(assessment_id, {
      pdf_url: file_url,
    });

    return Response.json({
      success: true,
      pdf_url: file_url,
    });
  } catch (error) {
    const message = error && error.message ? error.message : 'Failed to generate WSA PDF';
    const stack = error && error.stack ? error.stack : '';

    console.error('generateWSAPDF error:', message, stack);

    return Response.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
});