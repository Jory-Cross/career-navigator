import React, { useEffect, useMemo, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Upload, Download, Sparkles, FileText } from "lucide-react";
import { toast } from "sonner";
import InterestProfilerPanel from "@/components/assessments/InterestProfilerPanel";

function hasValue(value) {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return String(value).trim() !== "";
}

function countAnsweredQuestions(questions, responses) {
  return questions.filter((question) => {
    if (question.type === "section") return false;
    return hasValue(responses?.[question.id]);
  }).length;
}

const DEFAULT_WSA_FIELD_LIMIT = 700;

const WSA_FIELD_LIMITS = {
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

function getWSAFieldLimit(questionId) {
  return WSA_FIELD_LIMITS[questionId] || DEFAULT_WSA_FIELD_LIMIT;
}

export default function LegacyAssessmentPanel({
  assessmentDef,
  existingRecord,
  clientId,
  onSaved,
  onRegisterLeaveSave,
}) {
  const { key, label, questions = [] } = assessmentDef;
  const isInterestProfiler = key === "interest_profiler";
  const isWSA = key === "work_strategy_assessment";

    const [responses, setResponses] = useState(existingRecord?.responses || {});
  const [saving, setSaving] = useState(false);
  const [uploadingWSA, setUploadingWSA] = useState(false);
  const [downloadingWSA, setDownloadingWSA] = useState(false);
  const [generatingWSAFields, setGeneratingWSAFields] = useState(false);
  const [generatingWSAReport, setGeneratingWSAReport] = useState(false);

  const latestResponsesRef = useRef(existingRecord?.responses || {});
  const existingRecordIdRef = useRef(existingRecord?.id || null);
  const wsaDirtyRef = useRef(false);

  useEffect(() => {
    const savedResponses = existingRecord?.responses || {};

    setResponses(savedResponses);
    latestResponsesRef.current = savedResponses;
    existingRecordIdRef.current = existingRecord?.id || null;
    wsaDirtyRef.current = false;
  }, [existingRecord?.id]);

  useEffect(() => {
    return () => {
      if (!isWSA || !wsaDirtyRef.current || !clientId) {
        return;
      }

      const payload = {
        client_id: clientId,
        assessment_type: key,
        status: "in_progress",
        responses: latestResponsesRef.current,
      };

      if (existingRecordIdRef.current) {
        base44.entities.Assessment
          .update(existingRecordIdRef.current, payload)
          .catch((error) => {
            console.error("WSA save-on-exit update failed:", error);
          });
      } else {
        base44.entities.Assessment
          .create(payload)
          .catch((error) => {
            console.error("WSA save-on-exit create failed:", error);
          });
      }
    };
  }, [isWSA, clientId, key]);
  const answeredCount = useMemo(
    () => countAnsweredQuestions(questions, responses),
    [questions, responses]
  );

  const totalCount = useMemo(
    () => questions.filter((question) => question.type !== "section").length,
    [questions]
  );

  if (isInterestProfiler) {
    return (
      <InterestProfilerPanel
        clientId={clientId}
        existingAssessment={existingRecord}
        onSaved={onSaved}
      />
    );
  }

   function updateResponse(questionId, value) {
    setResponses((previous) => {
      const nextResponses = {
        ...previous,
        [questionId]: value,
      };

      latestResponsesRef.current = nextResponses;

      if (isWSA) {
        wsaDirtyRef.current = true;
      }

      return nextResponses;
    });
  }

  async function saveAssessment(status = "completed", options = {}) {
    const showToast = options.showToast !== false;

    if (!clientId) {
      toast.error("Client is missing. Assessment cannot be saved.");
      return null;
    }

    setSaving(true);

    try {
      const payload = {
        client_id: clientId,
        assessment_type: key,
        status,
        responses,
      };

      let savedRecord;

      if (existingRecord?.id) {
        savedRecord = await base44.entities.Assessment.update(existingRecord.id, payload);
      } else {
        savedRecord = await base44.entities.Assessment.create(payload);
      }

            latestResponsesRef.current = responses;
      existingRecordIdRef.current = savedRecord?.id || existingRecordIdRef.current;
      wsaDirtyRef.current = false;

      if (showToast) {
        toast.success("Assessment saved");
      }

      onSaved?.();
      return savedRecord;
    } catch (error) {
      console.error("Legacy assessment save failed:", error);
      toast.error("Assessment could not be saved.");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function handleWSAUpload(event) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    if (file.type !== "application/pdf") {
      toast.error("Please upload a PDF file.");
      return;
    }

    setUploadingWSA(true);

    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      const nextResponses = {
        ...responses,
        _uploaded_pdf_url: file_url,
        _uploaded_pdf_name: file.name,
      };

      setResponses(nextResponses);

      const payload = {
        client_id: clientId,
        assessment_type: key,
        status: "in_progress",
        responses: nextResponses,
      };

      if (existingRecord?.id) {
        await base44.entities.Assessment.update(existingRecord.id, payload);
      } else {
        await base44.entities.Assessment.create(payload);
      }

      toast.success("WSA PDF uploaded");
      onSaved?.();
    } catch (error) {
      console.error("WSA upload failed:", error);
      toast.error("WSA PDF upload failed.");
    } finally {
      setUploadingWSA(false);
    }
  }

  async function handleWSADownload() {
    let assessmentId = existingRecord?.id;

    if (!assessmentId) {
      const savedRecord = await saveAssessment("completed", { showToast: false });
      assessmentId = savedRecord?.id;
    } else {
      await saveAssessment("completed", { showToast: false });
    }

    if (!assessmentId) {
      toast.error("Save the WSA before downloading.");
      return;
    }

    setDownloadingWSA(true);

    try {
      const { data } = await base44.functions.invoke("generateWSAPDF", {
        assessment_id: assessmentId,
      });

      if (!data?.pdf_url) {
        throw new Error(data?.error || "The PDF function did not return a file URL.");
      }

      const link = document.createElement("a");
      link.href = data.pdf_url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.download = "Updated-WSA.pdf";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("Filled WSA PDF generated");
      onSaved?.();
    } catch (error) {
      console.error("WSA PDF download failed:", error);
      toast.error(`WSA PDF download failed: ${error.message || "Unknown error"}`);
    } finally {
      setDownloadingWSA(false);
    }
  }

  async function handleGenerateWSAFieldDraft() {
    if (!clientId) {
      toast.error("Client is missing. WSA fields cannot be generated.");
      return;
    }

    setGeneratingWSAFields(true);

    try {
      const { data } = await base44.functions.invoke("generateWSAAIOutputs", {
        client_id: clientId,
        mode: "field_draft",
        current_wsa_responses: responses,
      });

      if (!data?.success) {
        throw new Error(data?.error || "WSA field draft generation failed.");
      }

      const officialFields = data.official_wsa_fields || {};

      if (!Object.keys(officialFields).length) {
        toast.error("AI did not return WSA field values.");
        return;
      }

      const nextResponses = {
        ...responses,
        ...officialFields,
        _wsa_ai_evidence_summary: data.evidence_summary || [],
        _wsa_ai_staff_should_verify: data.staff_should_verify || [],
        _wsa_ai_fields_generated_at: new Date().toISOString(),
      };

            setResponses(nextResponses);
      latestResponsesRef.current = nextResponses;
      wsaDirtyRef.current = true;

      toast.success("AI filled the WSA editor fields. Review before saving.");
    } catch (error) {
      console.error("WSA AI field draft failed:", error);
      toast.error(`WSA AI field draft failed: ${error.message || "Unknown error"}`);
    } finally {
      setGeneratingWSAFields(false);
    }
  }

    async function handleGenerateWSAReport() {
    if (!clientId) {
      toast.error("Client is missing. WSA report cannot be generated.");
      return;
    }

    setGeneratingWSAReport(true);

    try {
      const { data } = await base44.functions.invoke("generateWSAAIOutputs", {
        client_id: clientId,
        mode: "detailed_report",
        current_wsa_responses: responses,
      });

      if (!data?.success) {
        throw new Error(data?.error || "WSA detailed report generation failed.");
      }

      if (!data.full_detailed_wsa_html && !data.detailed_wsa_fields) {
        toast.error("AI did not return the full detailed WSA.");
        return;
      }

      const nextResponses = {
        ...responses,

        // Full Detailed WSA: exact same fields as the official WSA, no character limits.
        _detailed_wsa_fields: data.detailed_wsa_fields || {},
        _full_detailed_wsa_html: data.full_detailed_wsa_html || "",

        // Supplemental narrative report: broader add-on report for staff review.
        _supplemental_wsa_report_html: data.supplemental_wsa_report_html || "",

        // Backward compatibility with the older frontend/report button.
        _detailed_wsa_report_html:
          data.supplemental_wsa_report_html ||
          data.full_detailed_wsa_html ||
          data.detailed_wsa_report_html ||
          "",

        _wsa_report_evidence_summary: data.evidence_summary || [],
        _wsa_report_staff_should_verify: data.staff_should_verify || [],
        _wsa_report_generated_at: new Date().toISOString(),
      };

            setResponses(nextResponses);
      latestResponsesRef.current = nextResponses;
      wsaDirtyRef.current = true;

      toast.success("Full detailed WSA and supplemental report generated. Changes will save when you leave this assessment.");
    } catch (error) {
      console.error("WSA detailed report failed:", error);
      toast.error(`WSA detailed report failed: ${error.message || "Unknown error"}`);
    } finally {
      setGeneratingWSAReport(false);
    }
  }

    function downloadHtmlDocument({ html, title, fileName, description }) {
    if (!html) {
      toast.error("Generate the AI WSA reports before downloading.");
      return;
    }

    const htmlDocument = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      color: #111827;
      line-height: 1.5;
      margin: 40px;
      max-width: 900px;
    }

    h1 {
      font-size: 24px;
      margin-bottom: 8px;
      border-bottom: 2px solid #111827;
      padding-bottom: 8px;
    }

    h2 {
      font-size: 20px;
      margin-top: 28px;
      margin-bottom: 10px;
      color: #111827;
    }

    h3 {
      font-size: 16px;
      margin-top: 18px;
      margin-bottom: 8px;
      color: #1f2937;
    }

    p {
      margin: 8px 0;
    }

    ul {
      margin-top: 6px;
    }

    li {
      margin-bottom: 4px;
    }

    section {
      page-break-inside: avoid;
      margin-bottom: 22px;
    }

    .meta {
      color: #4b5563;
      font-size: 13px;
      margin-bottom: 24px;
    }

    @media print {
      body {
        margin: 24px;
      }
    }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <div class="meta">${description}</div>
  ${html}
</body>
</html>`;

    const blob = new Blob([htmlDocument], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
    toast.success(`${title} downloaded`);
  }

  function handleDownloadFullDetailedWSA() {
    downloadHtmlDocument({
      html: responses?._full_detailed_wsa_html,
      title: "Full Detailed Work Strategy Assessment",
      fileName: "Full-Detailed-WSA.html",
      description:
        "This document uses the exact same fields as the official WSA form, but is not limited by the PDF field character limits.",
    });
  }

  function handleDownloadSupplementalWSAReport() {
    downloadHtmlDocument({
      html: responses?._supplemental_wsa_report_html,
      title: "Supplemental WSA Narrative Report",
      fileName: "Supplemental-WSA-Narrative-Report.html",
      description:
        "This supplemental report provides broader narrative analysis for staff review. It does not replace the full detailed WSA fields.",
    });
  }
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{label}</h3>
          <p className="mt-1 text-sm text-slate-500">
            {answeredCount} / {totalCount} fields completed
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {isWSA && (
            <>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
                {uploadingWSA ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Upload WSA PDF
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  disabled={uploadingWSA || saving}
                  onChange={handleWSAUpload}
                />
              </label>

                           <Button
                type="button"
                variant="outline"
                disabled={generatingWSAFields || saving}
                onClick={handleGenerateWSAFieldDraft}
              >
                {generatingWSAFields ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                AI Fill WSA Fields
              </Button>

                           <Button
                type="button"
                variant="outline"
                disabled={generatingWSAReport || saving}
                onClick={handleGenerateWSAReport}
              >
                {generatingWSAReport ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="mr-2 h-4 w-4" />
                )}
                AI Detailed Report
              </Button>

                            <Button
                type="button"
                variant="outline"
                disabled={!responses?._full_detailed_wsa_html}
                onClick={handleDownloadFullDetailedWSA}
              >
                <Download className="mr-2 h-4 w-4" />
                Download Full Detailed WSA
              </Button>

              <Button
                type="button"
                variant="outline"
                disabled={!responses?._supplemental_wsa_report_html}
                onClick={handleDownloadSupplementalWSAReport}
              >
                <Download className="mr-2 h-4 w-4" />
                Download Supplemental Report
              </Button>

              <Button
                type="button"
                variant="outline"
                disabled={downloadingWSA || saving}
                onClick={handleWSADownload}
              >
                {downloadingWSA ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Download Filled WSA
              </Button>
            </>
          )}

          <Button
            type="button"
            disabled={saving}
            onClick={() => saveAssessment("completed")}
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save Assessment
          </Button>
        </div>
      </div>

      {isWSA && responses?._uploaded_pdf_name ? (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
          Uploaded WSA template:{" "}
          <span className="font-medium">{responses._uploaded_pdf_name}</span>
        </div>
      ) : null}

      <div className="space-y-5">
        {questions.map((question) => {
          if (question.type === "section") {
            return (
              <div
                key={question.id}
                className="mt-6 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
              >
                <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
                  {question.label.replace(/─/g, "").trim()}
                </h4>
              </div>
            );
          }

                   const value = responses?.[question.id] ?? "";
          const characterLimit = isWSA ? getWSAFieldLimit(question.id) : undefined;
          const characterCount = String(value || "").length;
          const isNearLimit =
            characterLimit && characterCount >= Math.floor(characterLimit * 0.9);

          return (
            <div key={question.id} className="space-y-2">
              <Label htmlFor={question.id}>{question.label}</Label>

                            {question.type === "textarea" ? (
                <div className="space-y-1">
                  <Textarea
                    id={question.id}
                    value={value}
                    rows={4}
                    maxLength={characterLimit}
                    onChange={(event) => updateResponse(question.id, event.target.value)}
                  />

                  {characterLimit ? (
                    <div
                      className={`text-right text-xs ${
                        isNearLimit ? "font-semibold text-amber-700" : "text-slate-500"
                      }`}
                    >
                      {characterCount} / {characterLimit} characters
                    </div>
                  ) : null}
                </div>
              ) : question.type === "select" ? (
                <select
                  id={question.id}
                  value={value}
                  onChange={(event) => updateResponse(question.id, event.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">Select...</option>
                  {(question.options || []).map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                           ) : (
                <div className="space-y-1">
                  <Input
                    id={question.id}
                    value={value}
                    maxLength={characterLimit}
                    onChange={(event) => updateResponse(question.id, event.target.value)}
                  />

                  {characterLimit ? (
                    <div
                      className={`text-right text-xs ${
                        isNearLimit ? "font-semibold text-amber-700" : "text-slate-500"
                      }`}
                    >
                      {characterCount} / {characterLimit} characters
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="sticky bottom-0 border-t border-slate-200 bg-white pt-4">
        <div className="flex justify-end">
          <Button
            type="button"
            disabled={saving}
            onClick={() => saveAssessment("completed")}
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save Assessment
          </Button>
        </div>
      </div>
    </div>
  );
}
