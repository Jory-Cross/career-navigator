import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Upload, Download } from "lucide-react";
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
  worksite_simulation_location: 120,
  work_assessment_observations: 500,
  natural_support_observations: 450,
  life_skills_observations: 450,
  transportation_public: 160,
  transportation_private: 160,
  transportation_observations: 450,
  computer_skills_other: 160,
  computer_skill_observations: 450,
  interview_skill_observations: 450,
  other_observations: 450,
  current_work_skills: 600,
  work_skill_development_needs: 600,
  recommended_supports_on_job: 600,
  job_development_supports: 600,
  ongoing_supports: 600,
};

function getWSAFieldLimit(questionId) {
  return WSA_FIELD_LIMITS[questionId] || DEFAULT_WSA_FIELD_LIMIT;
}

export default function LegacyAssessmentPanel({
  assessmentDef,
  existingRecord,
  clientId,
  onSaved,
}) {
  const { key, label, questions = [] } = assessmentDef;
  const isInterestProfiler = key === "interest_profiler";
  const isWSA = key === "work_strategy_assessment";

  const [responses, setResponses] = useState(existingRecord?.responses || {});
  const [saving, setSaving] = useState(false);
  const [uploadingWSA, setUploadingWSA] = useState(false);
  const [downloadingWSA, setDownloadingWSA] = useState(false);

  useEffect(() => {
    setResponses(existingRecord?.responses || {});
  }, [existingRecord?.id]);

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
    setResponses((previous) => ({
      ...previous,
      [questionId]: value,
    }));
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
                <Textarea
                  id={question.id}
                  value={value}
                  rows={4}
                  onChange={(event) => updateResponse(question.id, event.target.value)}
                />
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
                <Input
                  id={question.id}
                  value={value}
                  onChange={(event) => updateResponse(question.id, event.target.value)}
                />
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
