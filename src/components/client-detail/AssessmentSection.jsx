import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, Plus, Download, Loader2, Pencil } from "lucide-react";
import { format } from "date-fns";
import { toast } from "react-hot-toast";

const assessmentQuestions = {
  career_goals: [
    { id: "current_role", label: "Current/Most Recent Role", type: "text" },
    { id: "career_goals", label: "Career Goals (next 1-2 years)", type: "textarea" },
    { id: "target_industries", label: "Target Industries", type: "text" },
    { id: "target_companies", label: "Target Companies", type: "text" },
    { id: "salary_expectations", label: "Salary Expectations", type: "text" },
    { id: "location_preferences", label: "Location Preferences", type: "text" },
    { id: "work_arrangement", label: "Preferred Work Arrangement", type: "select", options: ["Remote", "Hybrid", "On-site", "Flexible"] },
    { id: "challenges", label: "Current Challenges", type: "textarea" },
    { id: "strengths", label: "Key Strengths", type: "textarea" },
    { id: "development_areas", label: "Areas for Development", type: "textarea" }
  ],
  skills_audit: [
    { id: "technical_skills", label: "Technical Skills", type: "textarea" },
    { id: "soft_skills", label: "Soft Skills", type: "textarea" },
    { id: "certifications", label: "Certifications", type: "textarea" },
    { id: "tools_software", label: "Tools & Software Proficiency", type: "textarea" },
    { id: "languages", label: "Languages", type: "text" },
    { id: "skill_gaps", label: "Identified Skill Gaps", type: "textarea" }
  ],
  job_search_readiness: [
    { id: "resume_status", label: "Resume Status", type: "select", options: ["Not Started", "In Progress", "Complete", "Needs Review"] },
    { id: "linkedin_status", label: "LinkedIn Profile Status", type: "select", options: ["Not Set Up", "Basic", "Optimized", "Needs Update"] },
    { id: "portfolio_status", label: "Portfolio/Work Samples", type: "select", options: ["Not Available", "In Progress", "Complete"] },
    { id: "networking_activity", label: "Current Networking Activity", type: "textarea" },
    { id: "applications_sent", label: "Applications Sent (last 30 days)", type: "text" },
    { id: "interview_experience", label: "Recent Interview Experience", type: "textarea" }
  ],
  interview_readiness: [
    { id: "interview_confidence", label: "Interview Confidence Level (1-10)", type: "text" },
    { id: "behavioral_prep", label: "Behavioral Questions Preparation", type: "textarea" },
    { id: "technical_prep", label: "Technical Questions Preparation", type: "textarea" },
    { id: "common_weaknesses", label: "Common Interview Weaknesses", type: "textarea" },
    { id: "questions_for_employer", label: "Questions Prepared for Employers", type: "textarea" }
  ]
};

export default function AssessmentSection({ clientId }) {
  const [showForm, setShowForm] = useState(false);
  const [editingAssessment, setEditingAssessment] = useState(null);
  const [assessmentType, setAssessmentType] = useState("career_goals");
  const [responses, setResponses] = useState({});
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
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

  const { data: assessments = [], isLoading } = useQuery({
    queryKey: ['client-assessments', clientId],
    queryFn: () => base44.entities.Assessment.filter({ client_id: clientId })
  });

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const user = await base44.auth.me();

      let assessmentId;
      if (editingAssessment) {
        // Update existing assessment
        await base44.entities.Assessment.update(editingAssessment.id, {
          assessment_type: assessmentType,
          responses,
          notes
        });
        assessmentId = editingAssessment.id;
        toast.success("Assessment updated");
      } else {
        // Create new assessment
        const assessment = await base44.entities.Assessment.create({
          client_id: clientId,
          assessment_type: assessmentType,
          responses,
          completed_by: user.email,
          notes
        });
        assessmentId = assessment.id;

        // Generate PDF only for new assessments
        const { data: pdfData } = await base44.functions.invoke('generateAssessmentPDF', {
          assessment_id: assessmentId
        });
        await base44.entities.Assessment.update(assessmentId, { pdf_url: pdfData.pdf_url });

        await base44.entities.Document.create({
          client_id: clientId,
          title: `${assessmentType.replace(/_/g, ' ')} Assessment`,
          file_url: pdfData.pdf_url,
          file_name: `Assessment_${assessmentType}.pdf`,
          file_type: 'application/pdf',
          category: 'other'
        });

        await base44.entities.Activity.create({
          client_id: clientId,
          activity_type: 'note_added',
          title: 'Assessment completed',
          description: `${assessmentType.replace('_', ' ')} assessment completed by ${user.full_name || user.email}`
        });

        toast.success("Assessment saved and PDF generated");
      }

      queryClient.invalidateQueries({ queryKey: ['client-assessments'] });
      setShowForm(false);
      setEditingAssessment(null);
      setResponses({});
      setNotes("");
    } catch (error) {
      toast.error("Failed to save: " + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const currentQuestions = assessmentQuestions[assessmentType] || [];

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Client Assessments</CardTitle>
          <Button size="sm" onClick={openNew}>
            <Plus className="w-3.5 h-3.5 mr-1" /> New Assessment
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        ) : assessments.length === 0 ? (
          <div className="text-center py-8 text-sm text-slate-400">No assessments yet</div>
        ) : (
          <div className="space-y-3">
            {assessments.map(assessment => (
              <div key={assessment.id} className="p-4 bg-slate-50 rounded-lg">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <FileText className="w-4 h-4 text-slate-500 mt-1" />
                    <div>
                      <p className="text-sm font-medium text-slate-800 capitalize">
                        {assessment.assessment_type.replace(/_/g, ' ')}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Completed {format(new Date(assessment.created_date), "MMM d, yyyy")} by {assessment.completed_by}
                      </p>
                      {assessment.notes && (
                        <p className="text-xs text-slate-600 mt-2">{assessment.notes}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(assessment)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    {assessment.pdf_url && (
                      <a href={assessment.pdf_url} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="ghost">
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAssessment ? "Edit Assessment" : "Complete Assessment"}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label>Assessment Type</Label>
              <Select value={assessmentType} onValueChange={(val) => { setAssessmentType(val); if (!editingAssessment) setResponses({}); }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="career_goals">Career Goals</SelectItem>
                  <SelectItem value="skills_audit">Skills Audit</SelectItem>
                  <SelectItem value="job_search_readiness">Job Search Readiness</SelectItem>
                  <SelectItem value="interview_readiness">Interview Readiness</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="border-t pt-4 space-y-4">
              {currentQuestions.map(q => (
                <div key={q.id}>
                  <Label htmlFor={q.id}>{q.label}</Label>
                  {q.type === 'textarea' ? (
                    <Textarea
                      id={q.id}
                      value={responses[q.id] || ""}
                      onChange={(e) => setResponses({...responses, [q.id]: e.target.value})}
                      rows={3}
                      className="mt-1"
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
                    />
                  )}
                </div>
              ))}
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
            <Button variant="outline" onClick={() => setShowForm(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating PDF...
                </>
              ) : editingAssessment ? (
                "Save Changes"
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