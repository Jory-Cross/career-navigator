import React, { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertCircle, Save, RotateCcw, Plus } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import {
  TRANSPORTATION_ASSESSMENT_SECTIONS,
  TRANSPORTATION_ASSESSMENT_META,
  calculateTransportationScores,
} from "@/lib/assessments/transportationAssessmentDefinition";

export default function TransportationAssessmentPanel({ clientId, onAssessmentUpdate }) {
  const [assessment, setAssessment] = useState(null);
  const [responses, setResponses] = useState({});
  const [activeSection, setActiveSection] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isDirty, setIsDirty] = useState(false);
  const responsesRef = useRef({});

  // Load existing assessment
  useEffect(() => {
    async function loadAssessment() {
      try {
        const assessments = await base44.entities.Assessment.filter({
          client_id: clientId,
          assessment_type: "transportation",
        });

        if (assessments && assessments.length > 0) {
          const found = assessments[0];
          setAssessment(found);
          setResponses(found.responses || {});
          responsesRef.current = found.responses || {};
        } else {
          setAssessment(null);
          setResponses({});
          responsesRef.current = {};
        }
        setLoading(false);
      } catch (error) {
        console.error("Failed to load Transportation Assessment:", error);
        toast.error("Failed to load assessment");
        setLoading(false);
      }
    }

    if (clientId) loadAssessment();
  }, [clientId]);

  const handleResponseChange = (questionId, value) => {
    const updated = { ...responsesRef.current, [questionId]: value };
    responsesRef.current = updated;
    setResponses(updated);
    setIsDirty(true);
  };

  const handleMultiSelectChange = (questionId, option) => {
    const current = Array.isArray(responsesRef.current[questionId])
      ? responsesRef.current[questionId]
      : [];
    const updated = current.includes(option)
      ? current.filter((o) => o !== option)
      : [...current, option];

    const newResponses = { ...responsesRef.current, [questionId]: updated };
    responsesRef.current = newResponses;
    setResponses(newResponses);
    setIsDirty(true);
  };

  const handleMatrixChange = (matrixId, itemKey, value) => {
    const matrixData = responsesRef.current[matrixId] || {};
    const updated = { ...matrixData, [itemKey]: value };

    const newResponses = { ...responsesRef.current, [matrixId]: updated };
    responsesRef.current = newResponses;
    setResponses(newResponses);
    setIsDirty(true);
  };

  const saveAssessment = async () => {
    setSaving(true);
    try {
      const scores = calculateTransportationScores(responsesRef.current);

      if (assessment) {
        // Update existing
        await base44.entities.Assessment.update(assessment.id, {
          responses: responsesRef.current,
          status: "completed",
          ...scores,
        });
        setAssessment({
          ...assessment,
          responses: responsesRef.current,
          ...scores,
        });
        toast.success("Transportation Assessment updated");
      } else {
        // Create new
        const created = await base44.entities.Assessment.create({
          client_id: clientId,
          assessment_type: "transportation",
          status: "completed",
          responses: responsesRef.current,
          ...scores,
        });
        setAssessment(created);
        toast.success("Transportation Assessment created");
      }

      setIsDirty(false);
      onAssessmentUpdate?.();
    } catch (error) {
      console.error("Failed to save Transportation Assessment:", error);
      toast.error("Failed to save assessment");
    } finally {
      setSaving(false);
    }
  };

  const resetChanges = () => {
    responsesRef.current = assessment?.responses || {};
    setResponses({ ...responsesRef.current });
    setIsDirty(false);
  };

  if (loading) {
    return <Card className="p-8 text-center text-muted-foreground">Loading assessment...</Card>;
  }

  const section = TRANSPORTATION_ASSESSMENT_SECTIONS[activeSection];
  if (!section) return <Card className="p-8 text-center text-muted-foreground">Section not found</Card>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold">Transportation Assessment</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Comprehensive evaluation of transportation situation and employment impact
          </p>
        </div>
        {assessment && (
          <div className="text-xs text-slate-500">
            Last updated: {new Date(assessment.updated_date).toLocaleDateString()}
          </div>
        )}
      </div>

      {/* Scores Display (if assessment exists) */}
      {assessment && (
        <Card className="p-4 bg-slate-50 border-slate-200">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-slate-600 font-medium">Independence Score</p>
              <p className="text-sm font-semibold text-slate-900">
                {assessment.transportation_independence_score || "Not calculated"}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-600 font-medium">Barrier Severity</p>
              <p className="text-sm font-semibold text-slate-900">
                {assessment.transportation_barrier_severity || "Not calculated"}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-600 font-medium">Employment Risk</p>
              <p className="text-sm font-semibold text-slate-900">
                {assessment.employment_transportation_risk || "Not calculated"}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Section Navigation */}
      <div className="flex flex-wrap gap-2">
        {TRANSPORTATION_ASSESSMENT_SECTIONS.map((sec, idx) => (
          <button
            key={idx}
            onClick={() => setActiveSection(idx)}
            className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              activeSection === idx
                ? "bg-blue-600 text-white"
                : "bg-slate-200 text-slate-700 hover:bg-slate-300"
            }`}
          >
            {sec.label.split(":")[0]}
          </button>
        ))}
      </div>

      {/* Section Content */}
      <Card className="p-6">
        <h4 className="text-lg font-semibold mb-2">{section.label}</h4>
        <p className="text-sm text-muted-foreground mb-4">{section.description}</p>
        {section.introText && (
          <p className="text-xs text-slate-600 mb-4 italic">{section.introText}</p>
        )}

        <div className="space-y-6">
          {section.questions.map((question) => (
            <QuestionRenderer
              key={question.id}
              question={question}
              value={responses[question.id]}
              onChange={(val) => handleResponseChange(question.id, val)}
              onMultiChange={(opt) => handleMultiSelectChange(question.id, opt)}
              onMatrixChange={(itemKey, val) =>
                handleMatrixChange(question.id, itemKey, val)
              }
            />
          ))}
        </div>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button
          onClick={saveAssessment}
          disabled={!isDirty || saving}
          className="gap-2"
        >
          <Save className="w-4 h-4" />
          {saving ? "Saving..." : "Save Progress"}
        </Button>
        {isDirty && (
          <Button variant="outline" onClick={resetChanges} disabled={saving} className="gap-2">
            <RotateCcw className="w-4 h-4" />
            Discard Changes
          </Button>
        )}
      </div>

      {/* Navigation to other sections */}
      {activeSection > 0 && (
        <Button variant="outline" onClick={() => setActiveSection(activeSection - 1)}>
          ← Previous Section
        </Button>
      )}
      {activeSection < TRANSPORTATION_ASSESSMENT_SECTIONS.length - 1 && (
        <Button variant="outline" onClick={() => setActiveSection(activeSection + 1)}>
          Next Section →
        </Button>
      )}
    </div>
  );
}

// Question Renderer Component
function QuestionRenderer({
  question,
  value,
  onChange,
  onMultiChange,
  onMatrixChange,
}) {
  if (question.type === "select_single") {
    return (
      <div className="space-y-2">
        <Label className="text-sm font-medium">{question.label}</Label>
        <Select value={value || ""} onValueChange={onChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select an option..." />
          </SelectTrigger>
          <SelectContent>
            {question.options.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (question.type === "select_multiple") {
    const selected = Array.isArray(value) ? value : [];
    return (
      <div className="space-y-3">
        <Label className="text-sm font-medium">{question.label}</Label>
        <div className="space-y-2">
          {question.options.map((opt) => (
            <div key={opt} className="flex items-center gap-2">
              <Checkbox
                checked={selected.includes(opt)}
                onCheckedChange={() => onMultiChange(opt)}
              />
              <label className="text-sm cursor-pointer">{opt}</label>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (question.type === "scale") {
    const currentValue = value ? Number(value) : null;
    return (
      <div className="space-y-3">
        <Label className="text-sm font-medium">{question.label}</Label>
        {question.scaleLabels && (
          <div className="text-xs space-y-1 text-slate-600">
            {question.scaleLabels.map((label) => (
              <div key={label}>{label}</div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          {Array.from({ length: question.scaleMax - question.scaleMin + 1 }).map((_, idx) => {
            const val = question.scaleMin + idx;
            return (
              <button
                key={val}
                onClick={() => onChange(String(val))}
                className={`w-10 h-10 rounded-lg font-medium text-sm transition-colors ${
                  currentValue === val
                    ? "bg-blue-600 text-white"
                    : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                }`}
              >
                {val}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (question.type === "textarea") {
    return (
      <div className="space-y-2">
        <Label className="text-sm font-medium">{question.label}</Label>
        <Textarea
          placeholder={question.placeholder}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-24"
        />
      </div>
    );
  }

  if (question.type === "skill_matrix") {
    const matrixData = value || {};
    return (
      <div className="space-y-3">
        <Label className="text-sm font-medium">{question.label}</Label>
        {question.skills.map((skill) => (
          <div key={skill} className="flex items-center justify-between border-b pb-3">
            <span className="text-sm">{skill}</span>
            <div className="flex gap-1">
              {Array.from({ length: question.scaleMax - question.scaleMin + 1 }).map((_, idx) => {
                const val = question.scaleMin + idx;
                return (
                  <button
                    key={val}
                    onClick={() => onMatrixChange(skill, String(val))}
                    className={`w-8 h-8 rounded text-xs font-medium transition-colors ${
                      matrixData[skill] === String(val)
                        ? "bg-blue-600 text-white"
                        : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                    }`}
                  >
                    {val}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (question.type === "support_matrix") {
    const matrixData = value || {};
    return (
      <div className="space-y-3">
        <Label className="text-sm font-medium">{question.label}</Label>
        {question.supportCategories.map((category) => (
          <div key={category} className="space-y-2 border-b pb-3">
            <p className="text-sm font-medium">{category}</p>
            <Select
              value={matrixData[category] || ""}
              onValueChange={(val) => onMatrixChange(category, val)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select support level..." />
              </SelectTrigger>
              <SelectContent>
                {question.supportLevels.map((level) => (
                  <SelectItem key={level} value={level}>
                    {level}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
    );
  }

  if (question.type === "training_matrix") {
    const matrixData = value || {};
    return (
      <div className="space-y-3">
        <Label className="text-sm font-medium">{question.label}</Label>
        {question.trainingItems.map((item) => (
          <div key={item} className="flex items-center justify-between border-b pb-3">
            <span className="text-sm">{item}</span>
            <Select
              value={matrixData[item] || ""}
              onValueChange={(val) => onMatrixChange(item, val)}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {question.levels.map((level) => (
                  <SelectItem key={level} value={level}>
                    {level}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
    );
  }

  if (question.type === "resource_matrix") {
    const matrixData = value || {};
    return (
      <div className="space-y-3">
        <Label className="text-sm font-medium">{question.label}</Label>
        {question.resourceItems.map((item) => (
          <div key={item} className="flex items-center justify-between border-b pb-3">
            <span className="text-sm">{item}</span>
            <Select
              value={matrixData[item] || ""}
              onValueChange={(val) => onMatrixChange(item, val)}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {question.levels.map((level) => (
                  <SelectItem key={level} value={level}>
                    {level}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
    );
  }

  return (
    <Card className="p-4 bg-amber-50 border-amber-200">
      <p className="text-sm text-amber-800">Unknown question type: {question.type}</p>
    </Card>
  );
}