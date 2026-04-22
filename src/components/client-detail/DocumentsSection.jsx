import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { FileText, Plus, Download, Search, Archive, Upload, Loader2, Tag, Trash2, RefreshCw } from "lucide-react";
import {
  getDocuments,
  getDocumentVersions,
  createDocument,
  updateDocument,
  uploadFile,
  archiveDocument as archiveClientDocument,
  deleteDocument as deleteClientDocument
} from "@/lib/api/clientPortalApi";
import { analyzeDocumentContent } from "@/lib/api/clientPortalApi";

import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { getJobRecommendations } from "@/lib/api/getJobRecommendations";
import { buildJobRecommendations } from "@/lib/buildJobRecommendations";
import { 
  createRecommendationBatch, 
  getRecommendationBatchesForClient,
  setRecommendationReview
} from "@/lib/jobRecommendationsService";
const categoryColors = {
  resume: "bg-blue-100 text-blue-700",
  cover_letter: "bg-green-100 text-green-700",
  assessment: "bg-purple-100 text-purple-700",
  authorization: "bg-orange-100 text-orange-700",
  generated_report: "bg-emerald-100 text-emerald-700",
  certification: "bg-indigo-100 text-indigo-700",
  portfolio: "bg-cyan-100 text-cyan-700",
  other: "bg-slate-100 text-slate-600"
};

const filterOptions = [
  { value: "all", label: "All Documents" },
  { value: "generated_report", label: "Generated Reports" },
  { value: "assessment", label: "Assessments" },
  { value: "authorization", label: "Authorizations" },
  { value: "resume", label: "Resumes" },
  { value: "other", label: "Other Uploads" }
];
const RECOMMENDATION_SOURCE_OPTIONS = [
  { key: "resume", label: "Resume" },
  { key: "wsa", label: "WSA" },
  { key: "riasec", label: "RIASEC" },
  { key: "other_assessments", label: "Other Assessments" },
];

const DEFAULT_RECOMMENDATION_SOURCES = [
  "resume",
  "wsa",
  "riasec",
  "other_assessments",
];
export default function DocumentsSection({ clientId, refreshKey }) {
    const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
 const [form, setForm] = useState({
  title: "",
  category: "other",
  tags: "",
  notes: "",
  visibility: "staff"
});
  const [selectedFile, setSelectedFile] = useState(null);
  const [aiTagging, setAiTagging] = useState(false);
  const [showVersions, setShowVersions] = useState(null);
  const [versions, setVersions] = useState([]);
  const [filterTag, setFilterTag] = useState("");
 const [showArchived, setShowArchived] = useState(false);
const [recommendationHistory, setRecommendationHistory] = useState([]);
const [selectedRecommendationId, setSelectedRecommendationId] = useState(null);
const [staffReviewNotes, setStaffReviewNotes] = useState("");
 const [runRecommendations, setRunRecommendations] = useState(false);
const [showRecommendationReport, setShowRecommendationReport] = useState(false);

const [activeRecommendationSources, setActiveRecommendationSources] = useState(
  DEFAULT_RECOMMENDATION_SOURCES
);
 const allTags = Array.from(
  new Set(
    documents.flatMap(doc => [
      ...(doc.tags || []),
      ...(doc.ai_tags || []),
    ])
  )
);

const SKILL_BLACKLIST = [
  "resume",
  "skills",
  "job-seeking",
  "job seeking",
  "work history",
  "education",
  "professional summary",
  "employment goals",
  "contact information"
];
const SKILL_NORMALIZATION_MAP = {
  "customer support": "customer service",
  "client service": "customer service",
  "communications": "communication",
  "microsoft office suite": "microsoft office",
  "ms office": "microsoft office",
  "office suite": "microsoft office",
  "data-entry": "data entry",
  "typing": "data entry",
  "time-management": "time management",
  "team work": "teamwork",
};

function normalizeSkillTag(tag) {
  const cleaned = String(tag || "").toLowerCase().trim();
  return SKILL_NORMALIZATION_MAP[cleaned] || cleaned;
}
const recommendationSkills = Array.from(
  new Set(
    documents
      .filter(doc => ["resume", "assessment"].includes(doc.category))
      .flatMap(doc => [
        ...(doc.tags || []),
        ...(doc.ai_tags || [])
      ])
      .map(tag => normalizeSkillTag(tag))
      .filter(tag => !SKILL_BLACKLIST.includes(tag))
  )
);
  function extractRiasecScores(documents) {
  const scores = {
    R: 0,
    I: 0,
    A: 0,
    S: 0,
    E: 0,
    C: 0,
  };

  documents
    .filter(doc => doc.category === "assessment")
    .forEach(doc => {
      const text = (doc.ai_summary || doc.notes || "");

      // Match patterns like "R: 12", "Realistic 12", etc.
      const patterns = {
        R: /(?:realistic|R)[^\d]{0,5}(\d+)/i,
        I: /(?:investigative|I)[^\d]{0,5}(\d+)/i,
        A: /(?:artistic|A)[^\d]{0,5}(\d+)/i,
        S: /(?:social|S)[^\d]{0,5}(\d+)/i,
        E: /(?:enterprising|E)[^\d]{0,5}(\d+)/i,
        C: /(?:conventional|C)[^\d]{0,5}(\d+)/i,
      };

      Object.entries(patterns).forEach(([code, regex]) => {
        const match = text.match(regex);
        if (match && match[1]) {
          scores[code] += Number(match[1]);
        }
      });
    });

  return scores;
}
const loadDocuments = useCallback(async () => {
  setLoading(true);
  try {
    console.time("LOAD DOCS");
    const docs = await getDocuments(clientId);
    console.timeEnd("LOAD DOCS");

    const visibleDocs = docs.filter((doc) => {
      const archived = doc.is_archived === true;
      return showArchived ? archived : !archived;
    });

    setDocuments(
      visibleDocs.sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
    );

  } catch (error) {
    toast.error("Failed to load documents");
  } finally {
    setLoading(false);
  }
}, [clientId, showArchived]);

useEffect(() => {
  loadDocuments();
}, [loadDocuments, refreshKey]);
 
    const filteredDocs = useMemo(() => {
    let filtered = [...documents];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();

      filtered = filtered.filter((doc) =>
        doc.title?.toLowerCase().includes(term) ||
        doc.file_name?.toLowerCase().includes(term) ||
      [...(doc.tags || []), ...(doc.ai_tags || [])].some((tag) =>
  tag.toLowerCase().includes(term)
) ||
        doc.notes?.toLowerCase().includes(term)
      );
    }

    if (filterCategory !== "all") {
      filtered = filtered.filter((doc) => doc.category === filterCategory);
    }

    if (filterTag) {
     filtered = filtered.filter((doc) =>
  [...(doc.tags || []), ...(doc.ai_tags || [])].includes(filterTag)
);
    }

    return filtered;
  }, [documents, searchTerm, filterCategory, filterTag]);
  const loadVersions = async (docId) => {
  try {
    const rows = await getDocumentVersions(docId);
    setVersions(rows);
    setShowVersions(docId);
  } catch (error) {
    toast.error("Failed to load versions");
  }
};

 const autoTagDocument = async () => {
   toast("AI Tag clicked");
  if (!selectedFile || !form.category) return;

  setAiTagging(true);

  try {

const result = await analyzeDocumentContent({
  file_name: selectedFile.name,
  current_category: form.category,
});


const payload = result?.data?.data || result?.data || result || {};
    const normalizedTags = Array.isArray(payload.tags)
  ? payload.tags.map(tag => normalizeSkillTag(tag))
  : [];
console.log("AI payload FULL:", JSON.stringify(payload, null, 2));

setForm(p => ({
  ...p,
category: payload.suggested_category || p.category,
tags: normalizedTags.length > 0 ? normalizedTags.join(", ") : p.tags
}));

toast.success("AI tags applied");
  } catch (error) {
    console.error(error);
    toast.error("AI tagging failed");
  } finally {
    setAiTagging(false);
  }
};
  const handleUpload = async () => {
    if (!selectedFile || !form.title) {
      toast.error("Please select a file and enter a title");
      return;
    }

    setUploading(true);
    try {
      const file_url = await uploadFile(selectedFile);
      
   const RAW_TAGS = form.tags
  ? form.tags.split(",").map(t => t.trim()).filter(Boolean)
  : [];

const tags = Array.from(
  new Set(
    RAW_TAGS
      .map(tag => normalizeSkillTag(tag))
      .filter(tag => !SKILL_BLACKLIST.includes(tag))
  )
);
      
      // Check if this is a new version of an existing document
     const existingDocs = documents.filter(d =>
  d.title === form.title &&
  ['resume', 'cover_letter'].includes(d.category)
);
     let newDoc = {
  client_id: clientId,
  title: form.title,
  file_url,
  file_name: selectedFile.name,
  file_size: selectedFile.size,
  file_type: selectedFile.type,
  category: form.category,
  tags,
  notes: form.notes,
  visibility: form.visibility || "staff",
 source: form.category === "assessment" ? "assessment" : "staff_upload",    
};

      if (existingDocs.length > 0 && ['resume', 'cover_letter'].includes(form.category)) {
        const latestVersion = Math.max(...existingDocs.map(d => d.version || 1));
        newDoc.version = latestVersion + 1;
        newDoc.parent_document_id = existingDocs[0].id;
      } else {
        newDoc.version = 1;
      }
      
       const createdDoc = await createDocument({
  ...newDoc,
  ai_tags: tags,
  ai_summary: "",
  ai_insights: "",
});
setDocuments((prev) => {
  const updated = [
    {
      ...createdDoc,
      is_archived: false,
    },
    ...prev,
  ];

  if (createdDoc.ai_tags && createdDoc.ai_tags.length > 0) {
    setFilterTag(createdDoc.ai_tags[0]);
  }

  return updated;
});

      toast.success("Document uploaded");
      setShowUpload(false);
      setForm({
        title: "",
        category: "other",
        tags: "",
        notes: "",
        visibility: "staff"
      });
      setSelectedFile(null);
    } catch (error) {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  };
const archiveDocument = async (docId) => {
 

  try {
    await archiveClientDocument(docId);

   await loadDocuments();

    toast.success("Document archived");
  } catch (error) {
    console.error("ARCHIVE BUTTON ERROR", error);
    toast.error("Failed to archive");
  }
};

  const deleteDocument = async (docId) => {
  toast("Delete clicked");

  if (!confirm("Permanently delete this document? This cannot be undone.")) {
    toast("Delete cancelled");
    return;
  }

  try {
    await deleteClientDocument(docId);

   await loadDocuments();

    toast.success("Document deleted");
  } catch (error) {
    console.error("DELETE BUTTON ERROR", error);
    toast.error("Failed to delete");
  }
};

  const totalSize = documents.reduce((sum, doc) => sum + (doc.file_size || 0), 0);
  const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);

const clientProfile = {
  skills: recommendationSkills,
  documentCount: documents.length,
  resumeDocuments: documents.filter(doc => doc.category === "resume").length,
  assessmentDocuments: documents.filter(doc => doc.category === "assessment").length,
  generatedReports: documents.filter(doc => doc.category === "generated_report").length,
};
 const aiRecommendationResult = useMemo(() => {
  const resumeText = documents
    .filter(doc => doc.category === "resume")
    .map(doc => doc.ai_summary || doc.notes || "")
    .join(" ");

  const assessmentText = documents
    .filter(doc => doc.category === "assessment")
    .map(doc => doc.ai_summary || doc.notes || "")
    .join(" ");

  return buildJobRecommendations({
    resumeText,
    wsaText: assessmentText,
    assessmentText,
    riasecScores: extractRiasecScores(documents),
  });

}, [documents]);

const refreshRecommendationHistory = useCallback(() => {
  if (!clientId) return;

  const batches = getRecommendationBatchesForClient(clientId);

  // 🔥 FORCE NEW ARRAY (this is the fix)
  const cloned = batches.map(b => ({ ...b }));

  setRecommendationHistory(cloned);

  if (cloned.length > 0) {
 setSelectedRecommendationId(cloned[0].id);
  }
}, [clientId]);
useEffect(() => {
  if (!runRecommendations) return;
  if (!aiRecommendationResult || !aiRecommendationResult.recommendations?.length) return;

  const existing = getRecommendationBatchesForClient(clientId);
  const latest = existing[0];

  const newSignature = JSON.stringify(aiRecommendationResult.recommendations);
  const oldSignature = latest ? JSON.stringify(latest.recommendations) : null;

  if (newSignature === oldSignature) return;

createRecommendationBatch({
  client_id: clientId,
  source_resume_ids: documents
    .filter(d => d.category === "resume")
    .map(d => d.id),

  source_assessment_ids: documents
    .filter(d => d.category === "assessment")
    .map(d => d.id),

  riasec_summary: aiRecommendationResult.riasec_summary,
  wsa_summary: aiRecommendationResult.wsa_summary,
  combined_profile: aiRecommendationResult.combined_profile,
  recommendations: aiRecommendationResult.recommendations,
});

refreshRecommendationHistory();
setRunRecommendations(false);

}, [runRecommendations, aiRecommendationResult, clientId, documents, refreshRecommendationHistory]);

const skillKey = useMemo(
  () => recommendationSkills.join("|"),
  [recommendationSkills]
);


useEffect(() => {
  refreshRecommendationHistory();
}, [refreshRecommendationHistory]);
  
const selectedBatch = recommendationHistory.find(
  b => b.id === selectedRecommendationId
);

const suggestedJobs = selectedBatch?.recommendations || [];
  return (
    <>
      <Card className="border-0 shadow-sm">
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-slate-600" />
              <h3 className="text-sm font-semibold text-slate-800">Documents</h3>
              <Badge variant="outline" className="text-xs">{documents.length} files • {totalSizeMB} MB</Badge>
            </div>
           <div className="flex gap-2 flex-wrap">
  <Button
    size="sm"
    variant={showArchived ? "default" : "outline"}
    onClick={() => setShowArchived(!showArchived)}
  >
    <Archive className="w-3.5 h-3.5 mr-1" /> {showArchived ? "Active" : "Archived"}
  </Button>

  {!showArchived && (
    <Button size="sm" onClick={() => setShowUpload(true)}>
      <Upload className="w-3.5 h-3.5 mr-1" />
      Upload Document
    </Button>
  )}
</div>
            
          </div>

          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <Input
                placeholder="Search documents, tags, notes..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {filterOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {allTags.length > 0 && (
              <Select
  value={filterTag || "all_tags"}
  onValueChange={(value) => setFilterTag(value === "all_tags" ? "" : value)}
>
                <SelectTrigger className="w-[130px] h-9">
                  <SelectValue placeholder="Filter by tag" />
                </SelectTrigger>
               <SelectContent className="max-h-60 overflow-y-auto">
                  <SelectItem value="all_tags">All Tags</SelectItem>
                  {allTags.map(tag => (
                    <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

      <div className="p-5">
 

<div className="mt-2 mb-3">
    {recommendationHistory.length > 1 && (
  <div className="mb-2">
    <Select
      value={selectedRecommendationId || ""}
      onValueChange={(value) => setSelectedRecommendationId(value)}
    >
      <SelectTrigger className="h-8 text-xs">
        <SelectValue placeholder="Select recommendation run" />
      </SelectTrigger>
      <SelectContent>
       {recommendationHistory.map((batch) => (
  <SelectItem key={batch.id} value={batch.id}>
    {new Date(batch.generated_at).toLocaleString()}
  </SelectItem>
))}
      </SelectContent>
    </Select>
  </div>
)}
    <Button
  size="sm"
  variant="outline"
  className="h-7 text-xs mb-2"
  onClick={() => setShowRecommendationReport(true)}
>
  View Full Report
</Button>
    <Button
  size="sm"
  className="h-7 text-xs mb-2"
  onClick={() => setRunRecommendations(true)}
>
  Generate Recommendations
</Button>
  <div className="flex flex-wrap gap-2 mb-2">
  {RECOMMENDATION_SOURCE_OPTIONS.map((source) => {
    const isActive = activeRecommendationSources.includes(source.key);

    return (
      <Button
        key={source.key}
        size="sm"
        variant={isActive ? "default" : "outline"}
        className="h-6 text-xs px-2"
        onClick={() => {
          setActiveRecommendationSources((prev) =>
            prev.includes(source.key)
              ? prev.filter((s) => s !== source.key)
              : [...prev, source.key]
          );
        }}
      >
        {source.label}
      </Button>
    );
  })}
</div>
  <p className="text-xs text-slate-500 mb-1">Suggested Jobs</p>
{selectedBatch?.status && (
  <div className="mb-2">
    <Badge
      className={
        selectedBatch.status === "approved"
          ? "bg-green-100 text-green-700"
          : selectedBatch.status === "rejected"
          ? "bg-red-100 text-red-700"
          : "bg-yellow-100 text-yellow-700"
      }
    >
      {selectedBatch.status}
    </Badge>
  </div>
)}
<div className="flex gap-2 mb-2">
  <Button
    size="sm"
    className="h-7 text-xs"
   onClick={() => {
  if (!selectedRecommendationId) return;

  setRecommendationReview({
    batchId: selectedRecommendationId,
    status: "approved",
    reviewed_by: "staff",
    staff_notes: staffReviewNotes,
    approved_recommendation: suggestedJobs,
  });

  refreshRecommendationHistory();
  toast.success("Recommendations approved");
}}
  >
    Approve
  </Button>

  <Button
    size="sm"
    variant="outline"
    className="h-7 text-xs"
   onClick={() => {
  if (!selectedRecommendationId) return;

  setRecommendationReview({
    batchId: selectedRecommendationId,
    status: "rejected",
    reviewed_by: "staff",
    staff_notes: staffReviewNotes,
  });

  refreshRecommendationHistory();
  toast.success("Recommendations rejected");
}}
  >
    Reject
  </Button>
</div>

<div className="flex flex-wrap gap-2">
     {suggestedJobs.map((job, index) => (
  <div
    key={index}
    className="text-xs bg-green-50 text-green-700 border border-green-200 rounded px-2 py-1"
  >
    <div className="font-medium">
      {job.title} (Score: {job.score})
    </div>
    <div className="text-[10px] text-slate-600">
      {job.reasoning}
    </div>
  </div>
))}
       </div>
  </div>
          {loading ? (
            <div className="text-center py-8">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" />
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="text-sm text-slate-500">No documents found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredDocs.map(doc => {
                const isGenerated = doc.source === "generated" || doc.category === 'generated_report';
                
                return (
                  <div key={doc.id} className="flex items-start gap-3 p-3 hover:bg-slate-50 rounded-lg transition-colors border-l-4" style={{borderLeftColor: isGenerated ? '#10b981' : '#cbd5e1'}}>
                    <FileText className="w-5 h-5 mt-0.5" style={{color: isGenerated ? '#10b981' : '#94a3b8'}} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="text-sm font-medium text-slate-800">{doc.title}</p>
                        <Badge className={cn("text-xs", categoryColors[doc.category] || categoryColors.other)}>
  {doc.category.replace(/_/g, ' ')}
</Badge>

{doc.visibility && (
 <Badge
  variant="outline"
  className="text-xs cursor-pointer hover:bg-slate-100"
  onClick={async () => {
    try {
      const nextVisibility =
        doc.visibility === "staff"
          ? "both"
          : doc.visibility === "both"
          ? "client"
          : "staff";

      await updateDocument(doc.id, {
        ...doc.raw,
        visibility: nextVisibility,
      });

      setDocuments((prev) =>
        prev.map((d) =>
          d.id === doc.id ? { ...d, visibility: nextVisibility } : d
        )
      );

      toast.success("Visibility updated");
    } catch (err) {
      toast.error("Failed to update visibility");
    }
  }}
>

        
    {doc.visibility} ↻
  </Badge>
)}{doc.source && (
  <Badge variant="outline" className="text-xs">
    {doc.source.replace("_", " ")}
  </Badge>
)}                     
                        {isGenerated && <Badge className="text-xs bg-emerald-100 text-emerald-700">Generated</Badge>}
                        {doc.report_version && <Badge variant="outline" className="text-xs">Report v{doc.report_version}</Badge>}
                      </div>

                      {/* Generated Report Metadata */}
                      {isGenerated && (
                        <div className="text-xs text-slate-600 space-y-1 mb-2">
                          {doc.document_subtype && <p>📊 Type: <span className="font-medium">{doc.document_subtype.toUpperCase()}</span></p>}
                          {doc.reporting_period_start && doc.reporting_period_end && (
                            <p>📅 Period: <span className="font-medium">{format(new Date(doc.reporting_period_start), 'MMM d')} - {format(new Date(doc.reporting_period_end), 'MMM d, yyyy')}</span></p>
                          )}
                          {doc.generated_from_template_id && <p>📋 Template: <span className="font-mono text-[11px]">{doc.generated_from_template_id.slice(0, 8)}...</span></p>}
                          {doc.created_by && <p>👤 Generated by: <span className="font-medium">{doc.created_by}</span></p>}
                          <p>⏱️ {format(new Date(doc.created_date), 'MMM d, yyyy h:mm a')}</p>
                        </div>
                      )}

                      {/* Uploaded File Metadata */}
                      {!isGenerated && (
                        <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                          <span>{doc.file_name}</span>
                          <span>•</span>
                          <span>{((doc.file_size || 0) / 1024).toFixed(0)} KB</span>
                          <span>•</span>
                          <span>{format(new Date(doc.created_date), 'MMM d, yyyy')}</span>
                          {doc.created_by && <span>• {doc.created_by}</span>}
                        </div>
                      )}

                    {(doc.tags?.length > 0 || doc.ai_tags?.length > 0) && (
  <div className="flex items-center gap-1 mt-1 flex-wrap">
    <Tag className="w-3 h-3 text-slate-400" />

   {Array.from(
  new Set(
    [...(doc.tags || []), ...(doc.ai_tags || [])]
      .map(tag => normalizeSkillTag(tag))
      .filter((tag) =>
        doc.category === "resume"
          ? !SKILL_BLACKLIST.includes(tag)
          : true
      )
    )
).map((tag) => (
    <Badge
key={tag}
      variant="outline"
      className={`text-xs ${
        doc.category === "resume" ? "border-blue-300 text-blue-700" : ""
      }`}
    >
    {tag}
    </Badge>
  ))}
  </div>
)}
                      {doc.ai_summary && (
  <p className="text-xs text-slate-600 mt-2">
    <strong>Summary:</strong> {doc.ai_summary}
  </p>
)}

{doc.ai_insights && (
  <div className="text-xs text-slate-600 mt-1 whitespace-pre-line">
    <strong>Insights:</strong>
    <div className="mt-1">{doc.ai_insights}</div>
  </div>
)}
                    </div>
                    <div className="flex gap-1">
                     <Button
  size="sm"
  variant="ghost"
  className="h-7 px-2"
  onClick={(e) => {
    e.preventDefault();
    e.stopPropagation();
   toast("Reprocessing coming next");
  }}
>
  <RefreshCw className="w-3.5 h-3.5" />
</Button>
                      <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="ghost" className="h-7 px-2">
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                      </a>
<>
  {!showArchived && (
    <Button
      size="sm"
      variant="ghost"
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        archiveDocument(doc.id);
      }}
      className="h-7 px-2"
    >
      <Archive className="w-3.5 h-3.5" />
    </Button>
  )}

  <Button
    size="sm"
    variant="ghost"
    type="button"
    onClick={(e) => {
      e.preventDefault();
      e.stopPropagation();
      deleteDocument(doc.id);
    }}
    className="h-7 px-2 text-red-500 hover:text-red-700"
  >
    <Trash2 className="w-3.5 h-3.5" />
  </Button>
</>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      <Dialog open={showUpload} onOpenChange={setShowUpload}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
  {form.category === "resume"
    ? "Upload Resume"
    : form.category === "cover_letter"
    ? "Upload Cover Letter"
    : "Upload Document"}
</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div>
              <Label className="text-xs">File *</Label>
              <Input
                type="file"
                onChange={e => setSelectedFile(e.target.files?.[0])}
                className="cursor-pointer"
              />
            </div>
            <div>
              <Label className="text-xs">Title *</Label>
              <Input
                value={form.title}
                onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                placeholder="Document title"
              />
            </div>
            <div>
              <Label className="text-xs">Category</Label>
              <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="resume">Resume</SelectItem>
                  <SelectItem value="assessment">Assessment</SelectItem>
                  <SelectItem value="authorization">Authorization</SelectItem>
                  <SelectItem value="certification">Certification</SelectItem>
                  <SelectItem value="portfolio">Portfolio</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs">Tags (comma separated)</Label>
                {selectedFile && form.category && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={autoTagDocument}
                    disabled={aiTagging}
                    className="h-6 px-2 text-xs text-blue-600 hover:text-blue-700"
                  >
                    {aiTagging ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Tag className="w-3 h-3 mr-1" />}
                    AI Tag
                  </Button>
                )}
              </div>
              <Input
                value={form.tags}
                onChange={e => setForm(p => ({ ...p, tags: e.target.value }))}
                placeholder="e.g., important, 2024, final"
              />
            </div>
            <div>
              <Label className="text-xs">Notes</Label>
              <Textarea
                value={form.notes}
                onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                rows={2}
                placeholder="Additional notes..."
              />
            </div>
            <div>
  <Label className="text-xs">Visibility</Label>
  <Select
    value={form.visibility}
    onValueChange={v => setForm(p => ({ ...p, visibility: v }))}
  >
    <SelectTrigger>
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="staff">Staff Only</SelectItem>
      <SelectItem value="client">Client Can View</SelectItem>
      <SelectItem value="both">Both Staff and Client</SelectItem>
    </SelectContent>
  </Select>
</div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUpload(false)}>Cancel</Button>
            <Button onClick={handleUpload} disabled={uploading}>
              {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showVersions} onOpenChange={() => setShowVersions(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Version History</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-3">
            {versions.map(v => (
              <div key={v.id} className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium">Version {v.version}</p>
                    <p className="text-xs text-slate-500">{format(new Date(v.created_date), 'MMM d, yyyy HH:mm')}</p>
                  </div>
                <a href={v.file_url} target="_blank" rel="noopener noreferrer">
  <Button size="sm" variant="ghost" className="h-7 px-2">
    <Download className="w-3.5 h-3.5" />
  </Button>
</a>
                </div>
                {v.notes && <p className="text-xs text-slate-600">{v.notes}</p>}
              </div>
            ))}
          </div>
        </DialogContent>
     </Dialog>

<Dialog open={showRecommendationReport} onOpenChange={setShowRecommendationReport}>
  <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
    <DialogHeader>
      <DialogTitle>Job Recommendation Report</DialogTitle>
    </DialogHeader>

    <div className="space-y-4 text-sm">
      
      <div>
        <strong>RIASEC Summary:</strong>
        <p className="text-slate-600">{selectedBatch?.riasec_summary || "N/A"}</p>
      </div>

      <div>
        <strong>WSA Summary:</strong>
        <p className="text-slate-600">{selectedBatch?.wsa_summary || "N/A"}</p>
      </div>

      <div>
        <strong>Recommendations:</strong>
        <div className="space-y-3 mt-2">
          {suggestedJobs.map((job, i) => (
            <div key={i} className="border p-3 rounded">
              <div className="font-medium">
                {job.title} (Score: {job.score})
              </div>

              <div className="text-xs text-slate-600 mt-1">
                {job.reasoning}
              </div>

              {job.matched_keywords?.length > 0 && (
                <div className="text-xs mt-1">
                  <strong>Matched Skills:</strong> {job.matched_keywords.join(", ")}
                </div>
              )}

              {job.riasec_matches?.length > 0 && (
                <div className="text-xs mt-1">
                  <strong>RIASEC Match:</strong> {job.riasec_matches.join(", ")}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

    </div>

    <DialogFooter>
      <Button onClick={() => setShowRecommendationReport(false)}>Close</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>

</>
      );
      }
