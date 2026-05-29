/**
 * LegacyAssessmentPanel
 *
 * Renders legacy (non-structured) assessments inline in the two-panel workspace.
 * Handles: career_goals, skills_audit, job_search_readiness, interview_readiness,
 *           interest_profiler, work_strategy_assessment
 *
 * Props:
 *   assessmentDef   - { key, label, questions }
 *   existingRecord  - existing Assessment record or null
 *   clientId        - string
 *   onSaved         - () => void
 */

import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Upload, Download, CheckCircle2, Clock } from "lucide-react";
import { toast } from "react-hot-toast";
import { cn } from "@/lib/utils";
import InterestProfilerPanel from "./InterestProfilerPanel";
import { PDFDocument } from "pdf-lib";

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


export default function LegacyAssessmentPanel({ assessmentDef, existingRecord, clientId, onSaved }) {
  const { key, label, questions = [] } = assessmentDef;
  const isInterestProfiler = key === "interest_profiler";
  const isWSA = key === "work_strategy_assessment";

  const [responses, setResponses] = useState(existingRecord?.responses || {});
  const [notes, setNotes] = useState(existingRecord?.notes || "");
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const fileInputRef = useRef(null);

  const status = !existingRecord ? "not_started"
    : existingRecord.status === "completed" ? "completed"
    : "in_progress";

  const statusBadge = {
    not_started: null,
    in_progress: (
      <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 gap-1">
        <Clock className="w-3 h-3" /> Draft
      </Badge>
    ),
    completed: (
      <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 gap-1">
        <CheckCircle2 className="w-3 h-3" /> Completed
      </Badge>
    ),
  }[status];

  const handleSave = async () => {
    setSaving(true);
    try {
      const user = await base44.auth.me();
      if (existingRecord) {
        await base44.entities.Assessment.update(existingRecord.id, {
          responses,
          notes,
          status: "in_progress",
        });
        toast.success("Progress saved");
      } else {
        await base44.entities.Assessment.create({
          client_id: clientId,
          assessment_type: key,
          responses,
          notes,
          status: "in_progress",
          completed_by: user.email,
          pdf_url: responses._uploaded_pdf_url || "",
        });
        toast.success("Progress saved");
      }
      onSaved?.();
    } catch (err) {
      console.error("LegacyAssessmentPanel save failed:", err);
      toast.error("Failed to save: " + (err?.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

   const handleWSAUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExtracting(true);
    toast.loading("Extracting data from PDF...", { id: "wsa-extract" });

    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      setResponses((prev) => ({ ...prev, _uploaded_pdf_url: file_url }));

      const schemaProperties = {};
      WSA_FIELD_IDS.forEach((id) => {
        schemaProperties[id] = { type: "string" };
      });

      const extracted = await base44.integrations.Core.InvokeLLM({
        prompt: `Extract all filled-in fields from this Utah DWS Work Strategy Assessment (WSA) PDF. Return only non-empty values.`,
        file_urls: [file_url],
        response_json_schema: { type: "object", properties: schemaProperties },
      });

      const merged = { ...responses, _uploaded_pdf_url: file_url };

      Object.entries(extracted || {}).forEach(([k, val]) => {
        if (val && val.trim?.() !== "") merged[k] = val;
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

  const [exporting, setExporting] = useState(false);

  const handleWSAExport = async () => {
    const pdfUrl = responses._uploaded_pdf_url;
    if (!pdfUrl) {
      toast.error("Please upload the WSA PDF first before exporting.");
      return;
    }

    setExporting(true);
    try {
      const pdfBytes = await fetch(pdfUrl).then((r) => r.arrayBuffer());
      const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
      const form = pdfDoc.getForm();

      // CRM response key → exact PDF form field name
      const FIELD_MAP = {
        client_name:                    "Client Name",
        address:                        "Address",
        city:                           "City",
        state:                          "State",
        zip:                            "ZIP",
        client_phone:                   "Client Phone",
        crp_referring_to:               "CRP Referring to",
        guardian_name_phone:            "Parent/Guardian name and phone",
        referral_question:              "Referral question",
        current_work_skills:            "Current Work Skills knowledge skills and abilities",
        work_skill_development_needs:   "Work Skill Development Needs",
        jobs_of_interest:               "Jobs of Interest_1",
        interpersonal_social_skills:    "informalformal speech",
        assistive_technology_needs:     "Identified Assistive Technology Needs glasses UCAT device etc",
        communication_needs:            "Communication Needs interpreter etc",
        behavioral_self_regulation:     "BehavioralSelfregulation",
        activities_of_daily_living:     "Activities of Daily Living hygiene meal prep etc",
        family_issues_supports:         "Family IssuesSupports",
        criminal_background:            "Criminal Background expungement etc",
        school_academic:                "SchoolAcademic can include behavioral information",
        worksite_simulation_location:   "Worksite Simulation Location",
        work_assessment_observations:   "Work Assessment Observations",
        natural_support_observations:   "Natural Support Observations",
        life_skills_observations:       "Life Skills Observations",
        transportation_observations:    "Transportation Assessment Observations",
        computer_skill_observations:    "Computer Skill Assessment Observations",
        interview_skill_observations:   "Interview Skill Assessment Observations",
        computer_skills_other:          "Other skills (text)",
        other_observations:             "Other Observations",
        planned_job_search_hours_week:  "Planned Job Search Hours Per Week",
        life_skills_needed:             "Life Skills Needed",
        life_skills_hours_requested:    "Life Skills Hours Requested",
        recommended_target_occupations: "Recommended Target Occupations",
        recommended_supports_on_job:    "Recommended Supports On Job",
        job_development_supports:       "Job Development Supports",
        ongoing_supports:               "Ongoing Supports",
        job_goal:                       "Job Goal",
        industry_targeted_pay_range:    "Industry Targeted Pay Range",
        hours_available_to_work:        "Hours Available To Work",
        crp_name:                       "CRP Name",
        assigned_employment_specialist: "Assigned Employment Specialist",
        acre_certified:                 "ACRE Certified",
        extended_services_provider:     "Extended Services Provider",
        social_security_benefits:       "Social Security Benefits",
        benefits_planning:              "Benefits Planning",
        benefits_planning_date:         "Benefits Planning Date",
        benefits_summary_info:          "Benefits Summary Info",
        other_services_benefits:        "Other Services Benefits",
        benefits_other:                 "Benefits Other",
      };

      // Checkbox field mappings: response value → PDF checkbox field name
      const CHECKBOX_MAP = {
        guardianship: {
          "Yes": "Guardianship Yes",
          "No":  "Guardianship No",
        },
        health_insurance: {
          "Parent's Insurance": "Parents Insurance",
        },
      };

      const fields = form.getFields();
      const fieldNames = new Set(fields.map((f) => f.getName()));

      // Fill text fields
      Object.entries(FIELD_MAP).forEach(([responseKey, pdfFieldName]) => {
        const val = responses[responseKey];
        if (!val || !fieldNames.has(pdfFieldName)) return;
        try {
          const field = form.getField(pdfFieldName);
          const fieldType = field.constructor.name;
          if (fieldType === "PDFTextField") {
            field.setText(String(val));
          }
        } catch {
          // field type mismatch or missing — skip silently
        }
      });

      // Fill checkbox/radio fields
      Object.entries(CHECKBOX_MAP).forEach(([responseKey, valueToFieldName]) => {
        const val = responses[responseKey];
        if (!val) return;
        const targetFieldName = valueToFieldName[val];
        if (!targetFieldName || !fieldNames.has(targetFieldName)) return;
        try {
          const field = form.getField(targetFieldName);
          const fieldType = field.constructor.name;
          if (fieldType === "PDFCheckBox") {
            field.check();
          } else if (fieldType === "PDFTextField") {
            field.setText(String(val));
          }
        } catch {
          // skip silently
        }
      });

      // Transportation public: fill text field + check "Public" checkbox
      if (responses.transportation_public) {
        try {
          const tf = "Public Transportation Options (text)";
          if (fieldNames.has(tf)) form.getTextField(tf).setText(String(responses.transportation_public));
        } catch { /* skip */ }
        try {
          const cb = "Public";
          if (fieldNames.has(cb)) form.getCheckBox(cb).check();
        } catch { /* skip */ }
      }

      // Transportation private: fill text field + check "Private transportation" checkbox
      if (responses.transportation_private) {
        try {
          const tf = "Private Transportation Options (text)";
          if (fieldNames.has(tf)) form.getTextField(tf).setText(String(responses.transportation_private));
        } catch { /* skip */ }
        try {
          const cb = "Private transportation";
          if (fieldNames.has(cb)) form.getCheckBox(cb).check();
        } catch { /* skip */ }
      }

      // Append notes to any "Additional Notes" field if present
      if (notes) {
        ["Additional Notes", "Notes"].forEach((name) => {
          if (!fieldNames.has(name)) return;
          try {
            form.getTextField(name).setText(notes);
          } catch { /* skip */ }
        });
      }

      const filledBytes = await pdfDoc.save();
      const blob = new Blob([filledBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Updated-WSA.pdf";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("WSA PDF downloaded successfully.");
    } catch (err) {
      console.error("WSA export failed:", err);
      toast.error("Failed to fill PDF: " + (err?.message || "Unknown error"));
    } finally {
      setExporting(false);
    }
  };

  // Interest Profiler uses its own dedicated panel
  if (isInterestProfiler) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">{label}</h3>
          {statusBadge}
        </div>
        <InterestProfilerPanel
          key={existingRecord?.id || "new"}
          clientId={clientId}
          existingAssessment={existingRecord}
          onSaved={onSaved}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <h3 className="text-base font-semibold text-slate-900">{label}</h3>
        {statusBadge}
      </div>

      {/* WSA PDF Upload */}
      {isWSA && (
        <div className="rounded-md border border-blue-100 bg-blue-50 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-blue-800">Upload existing WSA PDF</p>
              <p className="text-xs text-blue-600 mt-0.5">AI will extract the details and pre-fill the fields below.</p>
            </div>
            <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={handleWSAUpload} />
                    <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="border-blue-300 text-blue-700 hover:bg-blue-100"
                onClick={handleWSAExport}
                disabled={extracting || exporting}
              >
                {exporting
                  ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Exporting...</>
                  : <><Download className="w-3.5 h-3.5 mr-1.5" />Download Filled WSA</>}
              </Button>

              <Button
                size="sm"
                variant="outline"
                className="border-blue-300 text-blue-700 hover:bg-blue-100"
                onClick={() => fileInputRef.current?.click()}
                disabled={extracting}
              >
                {extracting
                  ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Extracting...</>
                  : <><Upload className="w-3.5 h-3.5 mr-1.5" />Upload WSA PDF</>}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Questions */}
      {questions.map((q) => (
        <div key={q.id}>
          {q.type === "section" ? (
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mt-4 pt-2 border-t border-slate-100">
              {q.label.replace(/──\s*/g, "").replace(/\s*──/g, "")}
            </p>
          ) : (
            <div className="space-y-1">
              <Label className="text-sm">{q.label}</Label>
              {q.type === "textarea" ? (
                <Textarea
                  value={responses[q.id] || ""}
                  onChange={(e) => setResponses((prev) => ({ ...prev, [q.id]: e.target.value }))}
                  rows={3}
                />
              ) : q.type === "select" ? (
                <Select
                  value={responses[q.id] || ""}
                  onValueChange={(val) => setResponses((prev) => ({ ...prev, [q.id]: val }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {q.options.map((opt) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={responses[q.id] || ""}
                  onChange={(e) => setResponses((prev) => ({ ...prev, [q.id]: e.target.value }))}
                />
              )}
            </div>
          )}
        </div>
      ))}

      {/* Notes */}
      <div className="space-y-1 pt-2">
        <Label className="text-sm">Additional Notes (Optional)</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
      </div>

      {/* Save */}
      <div className="flex justify-end pt-4 border-t border-slate-100">
        <Button
          onClick={handleSave}
          disabled={saving || extracting}
        >
          {saving
            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
            : "Save Progress"}
        </Button>
      </div>
    </div>
  );
}