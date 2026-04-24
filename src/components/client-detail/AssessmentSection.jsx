import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, Plus, Download, Loader2, Pencil, Upload, Trash2 } from "lucide-react";
import RiasecRecommendations from "./RiasecRecommendations";
import AssessmentRecommendations from "./AssessmentRecommendations";
import { format } from "date-fns";
import { toast } from "react-hot-toast";

const assessmentQuestions = {
  career_goals: [
    { id: "current_role", label: "Current/Most Recent Role", type: "text", placeholder: "e.g. Customer Service Representative, Warehouse Associate" },
    { id: "career_goals", label: "Career Goals (next 1-2 years)", type: "textarea", placeholder: "e.g. Transition into an IT support role, obtain a full-time position with benefits, move into management..." },
    { id: "target_industries", label: "Target Industries", type: "text", placeholder: "e.g. Healthcare, Retail, Technology, Logistics" },
    { id: "target_companies", label: "Target Companies", type: "text", placeholder: "e.g. Amazon, IHC, Utah Transit Authority" },
    { id: "salary_expectations", label: "Salary Expectations", type: "text", placeholder: "e.g. $18–$22/hr, $45,000/yr" },
    { id: "location_preferences", label: "Location Preferences", type: "text", placeholder: "e.g. Ogden area, willing to commute up to 30 min, no relocation" },
    { id: "work_arrangement", label: "Preferred Work Arrangement", type: "select", options: ["Remote", "Hybrid", "On-site", "Flexible"] },
    { id: "challenges", label: "Current Challenges", type: "textarea", placeholder: "e.g. Gaps in employment history, limited transportation, anxiety in interviews..." },
    { id: "strengths", label: "Key Strengths", type: "textarea", placeholder: "e.g. Strong work ethic, punctual, good with customers, detail-oriented..." },
    { id: "development_areas", label: "Areas for Development", type: "textarea", placeholder: "e.g. Interview skills, professional communication, time management..." }
  ],
  skills_audit: [
    { id: "technical_skills", label: "Technical Skills", type: "textarea", placeholder: "e.g. Data entry, forklift operation, cash handling, Microsoft Office..." },
    { id: "soft_skills", label: "Soft Skills", type: "textarea", placeholder: "e.g. Teamwork, problem-solving, active listening, adaptability..." },
    { id: "certifications", label: "Certifications", type: "textarea", placeholder: "e.g. CPR/First Aid, OSHA 10, Google IT Support Certificate, ServSafe..." },
    { id: "tools_software", label: "Tools & Software Proficiency", type: "textarea", placeholder: "e.g. Microsoft Excel (intermediate), Google Workspace, QuickBooks..." },
    { id: "languages", label: "Languages", type: "text", placeholder: "e.g. English (fluent), Spanish (conversational), ASL (basic)" },
    { id: "skill_gaps", label: "Identified Skill Gaps", type: "textarea", placeholder: "e.g. Needs help with resume formatting, no experience with scheduling software..." }
  ],
  job_search_readiness: [
    { id: "resume_status", label: "Resume Status", type: "select", options: ["Not Started", "In Progress", "Complete", "Needs Review"] },
    { id: "linkedin_status", label: "LinkedIn Profile Status", type: "select", options: ["Not Set Up", "Basic", "Optimized", "Needs Update"] },
    { id: "portfolio_status", label: "Portfolio/Work Samples", type: "select", options: ["Not Available", "In Progress", "Complete"] },
    { id: "networking_activity", label: "Current Networking Activity", type: "textarea", placeholder: "e.g. Attending job fairs, connected with 3 employers on LinkedIn..." },
    { id: "applications_sent", label: "Applications Sent (last 30 days)", type: "text", placeholder: "e.g. 5, 12, 0 (just starting)" },
    { id: "interview_experience", label: "Recent Interview Experience", type: "textarea", placeholder: "e.g. Had a phone screen at Target last week, no interviews yet..." }
  ],
  interview_readiness: [
    { id: "interview_confidence", label: "Interview Confidence Level (1-10)", type: "text", placeholder: "e.g. 4 — nervous about behavioral questions" },
    { id: "behavioral_prep", label: "Behavioral Questions Preparation", type: "textarea", placeholder: "e.g. Practiced STAR method, has 2-3 examples ready..." },
    { id: "technical_prep", label: "Technical Questions Preparation", type: "textarea", placeholder: "e.g. Reviewed common IT questions, no technical component expected..." },
    { id: "common_weaknesses", label: "Common Interview Weaknesses", type: "textarea", placeholder: "e.g. Tends to give very short answers, gets nervous..." },
    { id: "questions_for_employer", label: "Questions Prepared for Employers", type: "textarea", placeholder: "e.g. 'What does a typical day look like?', 'What are growth opportunities?'" }
  ],
  riasec: [
    { id: "realistic", label: "Realistic (R) — hands-on, mechanical, outdoors", type: "text", placeholder: "Score 0–40" },
    { id: "investigative", label: "Investigative (I) — analytical, scientific, intellectual", type: "text", placeholder: "Score 0–40" },
    { id: "artistic", label: "Artistic (A) — creative, expressive, original", type: "text", placeholder: "Score 0–40" },
    { id: "social", label: "Social (S) — helping, teaching, counseling", type: "text", placeholder: "Score 0–40" },
    { id: "enterprising", label: "Enterprising (E) — leadership, persuasion, business", type: "text", placeholder: "Score 0–40" },
    { id: "conventional", label: "Conventional (C) — organized, detail-oriented, data", type: "text", placeholder: "Score 0–40" }
  ],
  work_strategy_assessment: [
    { id: "_section_referral", label: "── COUNSELOR REFERRAL PAGE ──", type: "section" },
    { id: "crp_referring_to", label: "CRP Referring To", type: "text", placeholder: "e.g. Community Options" },
    { id: "guardianship", label: "Guardianship", type: "select", options: ["No", "Yes"] },
    { id: "guardian_name_phone", label: "Parent/Guardian Name & Phone (if applicable)", type: "text", placeholder: "e.g. Brian Francis (Father) - 801-499-0118" },
    { id: "referral_question", label: "Referral Question", type: "textarea", placeholder: "What kind of support does the client need to be successful?" },
    { id: "extended_services_provider", label: "Extended Services Provider (check all that apply)", type: "textarea", placeholder: "e.g. DSPD, Mental Health Provider: XYZ, Partnership Plus (TTW), Other" },
    { id: "health_insurance", label: "Health Insurance (check all that apply)", type: "textarea", placeholder: "e.g. Medicaid, Medicare, Parent's Insurance, Spouse's Insurance, Other" },
    { id: "social_security_benefits", label: "Social Security Benefits (check all that apply)", type: "textarea", placeholder: "e.g. SSI, SSDI" },
    { id: "benefits_planning", label: "Benefits Planning", type: "select", options: ["Completed", "Pending – Date Scheduled", "Not Applicable"] },
    { id: "benefits_planning_date", label: "Benefits Planning Pending Date (if applicable)", type: "text", placeholder: "e.g. 04/15/2024" },
    { id: "benefits_summary_info", label: "Benefits Summary Info", type: "textarea" },
    { id: "other_services_benefits", label: "Other Services/Benefits", type: "textarea" },
    { id: "_section_client_description", label: "── DESCRIBE THE FOLLOWING AS IT APPLIES TO CLIENT ──", type: "section" },
    { id: "current_work_skills", label: "Current Work Skills (knowledge, skills, and abilities)", type: "textarea", placeholder: "e.g. Has worked 11 jobs in fast food, retail, and custodial positions..." },
    { id: "work_skill_development_needs", label: "Work Skill Development Needs", type: "textarea", placeholder: "e.g. Prefers to work alone and does not do well in fast-paced environments..." },
    { id: "jobs_of_interest", label: "Jobs of Interest", type: "text", placeholder: "e.g. Janitorial/Custodial, Data Entry, Warehouse" },
    { id: "interpersonal_social_skills", label: "Interpersonal/Social Skills (personal space, ability to communicate, informal/formal speech)", type: "textarea", placeholder: "e.g. Can become overwhelmed with large quantities of information..." },
    { id: "assistive_technology_needs", label: "Identified Assistive Technology Needs (glasses, UCAT device, etc.)", type: "textarea", placeholder: "e.g. Wears glasses, no other assistive technology needs at this time" },
    { id: "communication_needs", label: "Communication Needs (interpreter, etc.)", type: "textarea", placeholder: "e.g. No communication needs or concerns at this time" },
    { id: "behavioral_self_regulation", label: "Behavioral/Self-regulation", type: "textarea", placeholder: "e.g. May snap at co-workers when overstimulated..." },
    { id: "activities_of_daily_living", label: "Activities of Daily Living (hygiene, meal prep, etc.)", type: "textarea", placeholder: "e.g. Lives independently and completes ADLs independently" },
    { id: "family_issues_supports", label: "Family Issues/Supports", type: "textarea", placeholder: "e.g. Has a good support system consisting of father, stepmother, biological mother..." },
    { id: "criminal_background", label: "Criminal Background (expungement, etc.)", type: "textarea", placeholder: "e.g. No criminal background at this time" },
    { id: "school_academic", label: "School/Academic (can include behavioral information)", type: "textarea", placeholder: "e.g. Graduated from high school in 2017" },
    { id: "_section_crp", label: "── CRP OBSERVATION AND REPORT ──", type: "section" },
    { id: "worksite_simulation_location", label: "Worksite Simulation Location", type: "text", placeholder: "e.g. ABC Janitorial Services, Ogden UT" },
    { id: "work_assessment_observations", label: "Work Assessment Observations (soft skills, job experience, transferable skills, interpersonal skills, self-direction, physical abilities, reaction to criticism)", type: "textarea" },
    { id: "natural_support_observations", label: "Natural Support Assessment Observations (family support, other natural supports, parent/guardian expectations, reaction to working with others, safety, professional boundaries)", type: "textarea" },
    { id: "life_skills_observations", label: "Life Skills Observations (personal appearance, hygiene, self-care, meal prep, financial literacy)", type: "textarea" },
    { id: "transportation_public", label: "Transportation – Public Options", type: "text", placeholder: "e.g. UTA bus route available near home" },
    { id: "transportation_private", label: "Transportation – Private Options", type: "text", placeholder: "e.g. Has a car, rides with family" },
    { id: "transportation_observations", label: "Transportation Assessment Observations (proximity to employers, available options)", type: "textarea" },
    { id: "computer_skills_other", label: "Computer Skills – Other Skills (typing test, 10 key, etc.)", type: "text", placeholder: "e.g. Types 40 WPM, basic 10-key" },
    { id: "computer_skill_observations", label: "Computer Skill Assessment Observations (online application ability, social media, other skills)", type: "textarea" },
    { id: "interview_skill_observations", label: "Interview Skill Assessment Observations (mock interview, communication, body language, dress, listening, answering questions)", type: "textarea" },
    { id: "other_observations", label: "Other Observations", type: "textarea" },
    { id: "_section_recommendations", label: "── RECOMMENDATIONS ──", type: "section" },
    { id: "planned_job_search_hours_week", label: "Planned Job Search Hours/Week", type: "text", placeholder: "e.g. 20" },
    { id: "life_skills_needed", label: "Life Skills Needed", type: "textarea", placeholder: "e.g. Budgeting, personal hygiene, grocery shopping" },
    { id: "life_skills_hours_requested", label: "Life Skills Hours Requested", type: "text", placeholder: "e.g. 5" },
    { id: "recommended_target_occupations", label: "Recommended Target Occupations", type: "text", placeholder: "e.g. Custodian, Warehouse Associate, Data Entry Clerk" },
    { id: "recommended_supports_on_job", label: "Recommended Supports on the Job", type: "textarea", placeholder: "e.g. Job coach, modified task list, visual schedule" },
    { id: "job_development_supports", label: "Joint VR/CRP Recommendations for Job Development Supports", type: "textarea" },
    { id: "ongoing_supports", label: "Joint VR/CRP Recommendations for Ongoing Supports", type: "textarea" },
    { id: "_section_team", label: "── TEAM SECTION ──", type: "section" },
    { id: "job_goal", label: "Job Goal (must align with IPE goal)", type: "text", placeholder: "e.g. Obtain full-time custodial employment" },
    { id: "industry_targeted_pay_range", label: "Industry Targeted Pay Range", type: "text", placeholder: "e.g. $15–$18/hr" },
    { id: "benefits_other", label: "Benefits/Other", type: "textarea", placeholder: "e.g. Health insurance, paid time off" },
    { id: "hours_available_to_work", label: "Hours Available to Work (check all that apply)", type: "textarea", placeholder: "e.g. Full Time, Days, Weekends" },
    { id: "crp_name", label: "Community Rehabilitation Program Name", type: "text", placeholder: "e.g. Community Options" },
    { id: "assigned_employment_specialist", label: "Assigned Employment Specialist/Job Coach", type: "text", placeholder: "e.g. Jane Smith" },
    { id: "acre_certified", label: "ACRE Certified?", type: "select", options: ["Yes", "No"] }
  ]
};

// All WSA field IDs for AI extraction schema
const WSA_FIELD_IDS = [
  "crp_referring_to","guardianship","guardian_name_phone","referral_question",
  "extended_services_provider","health_insurance","social_security_benefits",
  "benefits_planning","benefits_planning_date","benefits_summary_info","other_services_benefits",
  "current_work_skills","work_skill_development_needs","jobs_of_interest",
  "interpersonal_social_skills","assistive_technology_needs","communication_needs",
  "behavioral_self_regulation","activities_of_daily_living","family_issues_supports",
  "criminal_background","school_academic","worksite_simulation_location",
  "work_assessment_observations","natural_support_observations","life_skills_observations",
  "transportation_public","transportation_private","transportation_observations",
  "computer_skills_other","computer_skill_observations","interview_skill_observations",
  "other_observations","planned_job_search_hours_week","life_skills_needed",
  "life_skills_hours_requested","recommended_target_occupations","recommended_supports_on_job",
  "job_development_supports","ongoing_supports","job_goal","industry_targeted_pay_range",
  "benefits_other","hours_available_to_work","crp_name","assigned_employment_specialist","acre_certified"
];

export default function AssessmentSection({ clientId }) {
  const [showForm, setShowForm] = useState(false);
  const [editingAssessment, setEditingAssessment] = useState(null);
  const [assessmentType, setAssessmentType] = useState("career_goals");
  const [responses, setResponses] = useState({});
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  const openNew = () => {
    setEditingAssessment(null);
    setAssessmentType("career_goals");
    setResponses({});
    setNotes("");
    setShowForm(true);
  };

  const openEdit = (assessment) => {
    setEditingAssessment(assessment);
    setAssessmentType(assessment.assessment_type);
    setResponses(assessment.responses || {});
    setNotes(assessment.notes || "");
    setShowForm(true);
  };

  const handleDelete = async (assessment) => {
    if (!window.confirm(`Delete this ${assessment.assessment_type.replace(/_/g, ' ')} assessment? This cannot be undone.`)) return;
    await base44.entities.Assessment.delete(assessment.id);
    queryClient.invalidateQueries({ queryKey: ['client-assessments'] });
    toast.success("Assessment deleted");
  };

  const { data: assessments = [], isLoading } = useQuery({
    queryKey: ['client-assessments', clientId],
    queryFn: () => base44.entities.Assessment.filter({ client_id: clientId })
  });

const handleSubmit = async () => {
  setSubmitting(true);

  try {
    const user = await base44.auth.me();

    if (editingAssessment) {
      await base44.entities.Assessment.update(editingAssessment.id, {
        assessment_type: assessmentType,
        responses,
        notes
      });

      toast.success("Assessment updated");
    } else {
      await base44.entities.Assessment.create({
        client_id: clientId,
        assessment_type: assessmentType,
        responses,
        completed_by: user.email,
        notes
      });

      if (assessmentType === "work_strategy_assessment") {
        toast.success("WSA saved");
      } else {
        toast.success("Assessment saved");
      }
    }

    await queryClient.invalidateQueries({ queryKey: ["client-assessments", clientId] });

    setShowForm(false);
    setEditingAssessment(null);
    setResponses({});
    setNotes("");
  } catch (error) {
    console.error("Assessment save failed:", error);
    toast.error("Failed to save: " + (error?.message || "Unknown error"));
  } finally {
    setSubmitting(false);
  }
};
  
  const handleWSAUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExtracting(true);
    toast.loading("Extracting data from PDF...", { id: "wsa-extract" });
    try {
      // Upload the PDF and save the URL for later overlay
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setResponses(prev => ({ ...prev, _uploaded_pdf_url: file_url }));

      // Build a schema for all WSA fields
      const schemaProperties = {};
      WSA_FIELD_IDS.forEach(id => { schemaProperties[id] = { type: "string" }; });

      // Use AI to extract all fields from the PDF
      const extracted = await base44.integrations.Core.InvokeLLM({
        prompt: `You are extracting data from a Utah DWS Work Strategy Assessment (WSA) PDF form (DWS-USOR 94). 
Read the document carefully and extract every filled-in field value. 
For each key below, extract the corresponding value from the PDF. Only return values that are actually filled in — leave others as empty string "".
Field mapping:
- crp_referring_to: "CRP Referring to" field
- guardianship: "Guardianship" checkbox (Yes or No)
- guardian_name_phone: Parent/Guardian name and phone number
- referral_question: The referral question text
- extended_services_provider: Which extended services/resources are checked (list them)
- health_insurance: Which health insurance options are checked (list them)
- social_security_benefits: Which social security benefits are checked (SSI, SSDI)
- benefits_planning: Benefits Planning status (Completed, Pending, Not Applicable)
- benefits_planning_date: Pending date if applicable
- benefits_summary_info: Benefits Summary Info text
- other_services_benefits: Other Services/Benefits text
- current_work_skills: Current Work Skills text
- work_skill_development_needs: Work Skill Development Needs text
- jobs_of_interest: Jobs of Interest text
- interpersonal_social_skills: Interpersonal/Social Skills text
- assistive_technology_needs: Identified Assistive Technology Needs text
- communication_needs: Communication Needs text
- behavioral_self_regulation: Behavioral/Self-regulation text
- activities_of_daily_living: Activities of Daily Living text
- family_issues_supports: Family Issues/Supports text
- criminal_background: Criminal Background text
- school_academic: School/Academic text
- worksite_simulation_location: Worksite Simulation Location
- work_assessment_observations: Work Assessment Observations
- natural_support_observations: Natural Support Assessment Observations
- life_skills_observations: Life Skills Observations
- transportation_public: Public transportation options
- transportation_private: Private transportation options
- transportation_observations: Transportation Assessment Observations
- computer_skills_other: Computer Skills other fields (typing test, 10 key, etc.)
- computer_skill_observations: Computer Skill Assessment Observations
- interview_skill_observations: Interview Skill Assessment Observations
- other_observations: Other Observations
- planned_job_search_hours_week: Planned Job Search hours/week
- life_skills_needed: Life Skills needed
- life_skills_hours_requested: Life Skills hours requested
- recommended_target_occupations: Recommended target occupations
- recommended_supports_on_job: Recommended supports on the job
- job_development_supports: Joint VR/CRP Recommendations for Job Development Supports
- ongoing_supports: Joint VR/CRP Recommendations for Ongoing Supports
- job_goal: Job Goal
- industry_targeted_pay_range: Industry Targeted Pay Range
- benefits_other: Benefits/Other
- hours_available_to_work: Hours available to work (list checked options)
- crp_name: Community Rehabilitation Program Name
- assigned_employment_specialist: Assigned Employment Specialist/Job Coach
- acre_certified: ACRE Certified (Yes or No)`,
        file_urls: [file_url],
        response_json_schema: {
          type: "object",
          properties: schemaProperties
        }
      });

      // Merge extracted values (only non-empty) into current responses
      const merged = { ...responses };
      Object.entries(extracted).forEach(([key, val]) => {
        if (val && val.trim() !== "") merged[key] = val;
      });
      setResponses(merged);
      toast.success("WSA data extracted and pre-filled!", { id: "wsa-extract" });
    } catch (err) {
      toast.error("Failed to extract PDF: " + err.message, { id: "wsa-extract" });
    } finally {
      setExtracting(false);
      e.target.value = "";
    }
  };
                return (
                  <div key={q.id}>
                    <Label htmlFor={q.id}>{q.label}</Label>
                    {q.type === 'textarea' ? (
                      <Textarea
                        id={q.id}
                        value={responses[q.id] || ""}
                        onChange={(e) => setResponses({...responses, [q.id]: e.target.value})}
                        rows={3}
                        className="mt-1"
                        placeholder={q.placeholder || ""}
                      />
                    ) : q.type === 'select' ? (
                      <Select value={responses[q.id] || ""} onValueChange={(val) => setResponses({...responses, [q.id]: val})}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          {q.options.map(opt => (
                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        id={q.id}
                        value={responses[q.id] || ""}
                        onChange={(e) => setResponses({...responses, [q.id]: e.target.value})}
                        className="mt-1"
                        placeholder={q.placeholder || ""}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <div>
              <Label htmlFor="notes">Additional Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="mt-1"
                placeholder="Any additional observations or notes..."
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowForm(false)} disabled={submitting || extracting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting || extracting}>
              {submitting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
              ) : editingAssessment ? (
                "Save Changes"
              ) : assessmentType === 'riasec' ? (
                "Save RIASEC Scores"
              ) : assessmentType === 'work_strategy_assessment' ? (
                "Save WSA"
              ) : (
                "Submit & Generate PDF"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
