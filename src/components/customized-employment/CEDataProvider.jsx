// Extracted data & logic layer for CustomizedEmploymentPanel
// Keeps all computation & state management separate from UI reorganization

import { base44 } from "@/api/base44Client";

export const CE_ASSESSMENT_TYPES = [
  "home_community_discovery",
  "benefits_resources",
  "benefits_resources_assessment",
  "assistive_technology",
  "assistive_technology_assessment",
  "discovery_interview",
  "informational_interview",
  "discovery_activity",
];

export function countCompleted(records, ...assessmentTypes) {
  return records.filter(
    (record) =>
      assessmentTypes.includes(record.assessment_type) &&
      record.status === "completed"
  ).length;
}

export function countAny(records, ...assessmentTypes) {
  return records.filter((record) => assessmentTypes.includes(record.assessment_type))
    .length;
}

export function getLatestRecord(records, assessmentType) {
  return records
    .filter((record) => record.assessment_type === assessmentType)
    .sort((a, b) =>
      String(b.updated_date || b.created_date || "").localeCompare(
        String(a.updated_date || a.created_date || "")
      )
    )[0];
}

export function getAssessmentSourceLabel(assessmentType) {
  const labels = {
    home_community_discovery: "Home & Community Discovery",
    benefits_resources_assessment: "Benefits & Resources Assessment",
    assistive_technology: "Assistive Technology Assessment",
    assistive_technology_assessment: "Assistive Technology Assessment",
    benefits_resources: "Benefits & Resources Assessment",
    discovery_interview: "Discovery Interview",
    informational_interview: "Informational Interview",
    discovery_activity: "Discovery Activity",
  };
  return labels[assessmentType] || "Assessment";
}

export function splitEvidenceText(value) {
  if (!value || typeof value !== "string") return [];
  const cleanedValue = value.trim();
  if (!cleanedValue) return [];
  const hasLineBreaksOrBullets = /[\n•;]/.test(cleanedValue);
  const sentenceCount = (cleanedValue.match(/[.!?]/g) || []).length;
  if (!hasLineBreaksOrBullets && sentenceCount > 1) return [cleanedValue];
  return cleanedValue
    .split(/\n|•|;/)
    .flatMap((part) => {
      const trimmedPart = part.trim();
      const partSentenceCount = (trimmedPart.match(/[.!?]/g) || []).length;
      if (partSentenceCount > 1) return [trimmedPart];
      return trimmedPart.split(",");
    })
    .map((part) =>
      part
        .trim()
        .replace(/^and\s+/i, "")
        .replace(/\.$/, "")
    )
    .filter(Boolean)
    .filter((part) => part.length > 2);
}

export function collectEvidence(records, fields) {
  return records
    .flatMap((record) =>
      fields.flatMap((field) => {
        const value = record?.responses?.[field];
        const evidenceItems = splitEvidenceText(value);
        return evidenceItems.map((text) => ({
          text,
          source: getAssessmentSourceLabel(record?.assessment_type),
          field,
          recordId: record?.id,
          status: record?.status,
          updatedDate: record?.updated_date || record?.created_date || "",
        }));
      })
    )
    .filter(Boolean);
}

export function collectArrayEvidence(records, fieldId, label) {
  return records.flatMap((record) => {
    const value = record?.responses?.[fieldId];
    if (!Array.isArray(value)) return [];
    return value
      .filter((v) => v && v !== "Unknown")
      .map((v) => ({
        text: `${label}: ${v}`,
        source: "Benefits & Resources Assessment",
        field: fieldId,
        recordId: record?.id,
        status: record?.status,
        updatedDate: record?.updated_date || record?.created_date || "",
      }));
  });
}

export function collectChoiceEvidence(records, fieldId, label) {
  return records.flatMap((record) => {
    const value = record?.responses?.[fieldId];
    if (!value || value === "Unknown" || value === "No" || value === "Not Reviewed" || value === "Not Applicable") return [];
    return [{
      text: `${label}: ${value}`,
      source: "Benefits & Resources Assessment",
      field: fieldId,
      recordId: record?.id,
      status: record?.status,
      updatedDate: record?.updated_date || record?.created_date || "",
    }];
  });
}

export function countEvidenceSources(items) {
  return new Set(items.map((item) => item.source).filter(Boolean)).size;
}

export function countDistinctConcepts(items) {
  return new Set(
    items
      .map((item) => normalizeEvidenceConcept(item.text))
      .filter(Boolean)
  ).size;
}

export function normalizeEvidenceConcept(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/public\s+/g, "")
    .replace(/local\s+/g, "")
    .replace(/community\s+/g, "")
    .trim();
}

export function computeFidelityStatus(items, singleSource = false) {
  const MIN_EVIDENCE_THRESHOLD = 3;
  const MIN_SOURCE_THRESHOLD = 2;
  if (items.length === 0) return "missing";
  const sourceCount = new Set(items.map((i) => i.source).filter(Boolean)).size;
  if (singleSource) return items.length >= MIN_EVIDENCE_THRESHOLD ? "ok" : "weak";
  if (items.length < MIN_EVIDENCE_THRESHOLD || sourceCount < MIN_SOURCE_THRESHOLD) return "weak";
  return "ok";
}