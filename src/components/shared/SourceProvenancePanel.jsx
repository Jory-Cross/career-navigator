import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertTriangle, CheckCircle, AlertCircle, FileText, Database,
  ChevronDown, ChevronUp, Eye, Download, Calendar, User, Zap,
  ExternalLink, BookOpen
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

function QualityIndicator({ score }) {
  if (score === null || score === undefined) return null;
  
  const getColor = () => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-amber-600";
    return "text-red-600";
  };

  return (
    <div className={cn("flex items-center gap-1", getColor())}>
      <Zap className="w-3.5 h-3.5" />
      <span className="text-xs font-semibold">{score}% quality</span>
    </div>
  );
}

function SourceDocument({ doc, onInspect }) {
  return (
    <div className="flex items-start justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-100 hover:border-slate-200 transition-colors">
      <div className="flex items-start gap-2.5 flex-1 min-w-0">
        <FileText className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-slate-800 truncate">{doc.title || doc.file_name}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">
            {doc.category && <span className="capitalize">{doc.category.replace(/_/g, ' ')}</span>}
            {doc.category && doc.created_date && <span> • </span>}
            {doc.created_date && format(new Date(doc.created_date), 'MMM d, yyyy')}
          </p>
        </div>
      </div>
      <Button
        size="sm"
        variant="ghost"
        className="h-6 px-1.5 ml-1 shrink-0"
        onClick={() => onInspect(doc)}
      >
        <Eye className="w-3 h-3" />
      </Button>
    </div>
  );
}

function AssessmentResult({ assessment, onInspect }) {
  return (
    <div className="flex items-start justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-100 hover:border-slate-200 transition-colors">
      <div className="flex items-start gap-2.5 flex-1 min-w-0">
        <BookOpen className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-slate-800">
            {assessment.assessment_type?.replace(/_/g, ' ') || 'Assessment'}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">
            {assessment.created_date && format(new Date(assessment.created_date), 'MMM d, yyyy')}
          </p>
        </div>
      </div>
      {assessment.pdf_url && (
        <a href={assessment.pdf_url} target="_blank" rel="noopener noreferrer">
          <Button size="sm" variant="ghost" className="h-6 px-1.5 ml-1 shrink-0">
            <Download className="w-3 h-3" />
          </Button>
        </a>
      )}
    </div>
  );
}

function ConflictsList({ conflicts }) {
  if (!conflicts?.length) return null;

  return (
    <div className="space-y-2">
      {conflicts.map((conflict, i) => (
        <div key={i} className="bg-amber-50 border border-amber-200 rounded-lg p-2.5">
          <p className="text-xs font-semibold text-amber-900 mb-2 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            {conflict.topic}
          </p>
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div className="bg-white rounded p-1.5 border border-amber-100">
              <p className="text-amber-700 font-medium mb-0.5">{conflict.source_a}</p>
              <p className="text-slate-700">"{conflict.value_a}"</p>
            </div>
            <div className="bg-white rounded p-1.5 border border-amber-100">
              <p className="text-amber-700 font-medium mb-0.5">{conflict.source_b}</p>
              <p className="text-slate-700">"{conflict.value_b}"</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function MissingDataList({ missing }) {
  if (!missing?.length) return null;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
      <p className="text-xs font-semibold text-blue-900 mb-2 flex items-center gap-1.5">
        <AlertCircle className="w-3.5 h-3.5" />
        Missing Critical Data
      </p>
      <div className="space-y-1">
        {missing.map((item, i) => (
          <p key={i} className="text-xs text-blue-800">• {item}</p>
        ))}
      </div>
    </div>
  );
}

function DocumentInspectModal({ open, onOpenChange, doc }) {
  if (!doc) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            {doc.title || doc.file_name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-slate-500 font-medium mb-1">Category</p>
              <p className="text-sm text-slate-900 capitalize">{doc.category?.replace(/_/g, ' ')}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium mb-1">Uploaded</p>
              <p className="text-sm text-slate-900">
                {doc.created_date ? format(new Date(doc.created_date), 'MMM d, yyyy') : 'Unknown'}
              </p>
            </div>
            {doc.file_name && (
              <div>
                <p className="text-xs text-slate-500 font-medium mb-1">File Name</p>
                <p className="text-sm text-slate-900 truncate">{doc.file_name}</p>
              </div>
            )}
            {doc.file_size && (
              <div>
                <p className="text-xs text-slate-500 font-medium mb-1">File Size</p>
                <p className="text-sm text-slate-900">{((doc.file_size || 0) / 1024).toFixed(0)} KB</p>
              </div>
            )}
          </div>

          {doc.notes && (
            <div>
              <p className="text-xs text-slate-500 font-medium mb-2">Notes</p>
              <p className="text-sm text-slate-700 bg-slate-50 rounded p-2">{doc.notes}</p>
            </div>
          )}

          {doc.file_url && (
            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="flex-1">
                <Button size="sm" className="w-full">
                  <Download className="w-3.5 h-3.5 mr-2" />
                  Download
                </Button>
              </a>
              <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="flex-1">
                <Button size="sm" variant="outline" className="w-full">
                  <ExternalLink className="w-3.5 h-3.5 mr-2" />
                  Open
                </Button>
              </a>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function SourceProvenancePanel({
  profile,
  client,
  extractedAt,
  extractedBy,
  documentCount,
  assessmentCount,
  variant = "card" // "card" or "inline"
}) {
  const [expandedSections, setExpandedSections] = useState({
    documents: true,
    assessments: true,
    conflicts: true,
    missing: true,
  });
  const [inspectingDoc, setInspectingDoc] = useState(null);
  const [documents, setDocuments] = React.useState([]);
  const [assessments, setAssessments] = React.useState([]);
  const [loadingDocs, setLoadingDocs] = React.useState(false);

  React.useEffect(() => {
    if (client?.id) {
      loadSourceDocuments();
    }
  }, [client?.id]);

  const loadSourceDocuments = async () => {
    if (!client?.id) return;
    setLoadingDocs(true);
    try {
      const docs = await base44.entities.Document.filter({ client_id: client.id });
      setDocuments(docs);

      const assesses = await base44.entities.Assessment.filter({ client_id: client.id });
      setAssessments(assesses);
    } catch (e) {
      console.error("Failed to load source documents:", e);
    } finally {
      setLoadingDocs(false);
    }
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  if (!profile) return null;

  const dataQuality = profile.data_quality_score;
  const hasDocuments = documents.length > 0;
  const hasAssessments = assessments.length > 0;
  const hasConflicts = profile.conflicts?.length > 0;
  const hasMissing = profile.missing_critical_data?.length > 0;

  const content = (
    <div className="space-y-3">
      {/* Quality & Metadata Bar */}
      <div className="flex items-center justify-between p-2.5 bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg border border-slate-200">
        <div className="flex items-center gap-3 text-xs">
          <span className="text-slate-600 font-medium">
            {documentCount || 0} doc{documentCount !== 1 ? 's' : ''} + {assessmentCount || 0} assess{assessmentCount !== 1 ? 's' : ''}
          </span>
          <span className="text-slate-300">|</span>
          <div className="flex items-center gap-1.5 text-slate-600">
            <Calendar className="w-3 h-3" />
            <span>
              {extractedAt ? format(new Date(extractedAt), 'MMM d, yyyy') : 'Never extracted'}
            </span>
          </div>
        </div>
        {dataQuality !== null && dataQuality !== undefined && (
          <QualityIndicator score={Math.round(dataQuality)} />
        )}
      </div>

      {/* Documents Section */}
      {hasDocuments && (
        <div>
          <button
            onClick={() => toggleSection('documents')}
            className="w-full flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg transition-colors"
          >
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-500" />
              <span className="text-xs font-semibold text-slate-700">Source Documents ({documents.length})</span>
            </div>
            {expandedSections.documents ? (
              <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            )}
          </button>
          {expandedSections.documents && (
            <div className="space-y-2 mt-2">
              {documents.map(doc => (
                <SourceDocument
                  key={doc.id}
                  doc={doc}
                  onInspect={setInspectingDoc}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Assessments Section */}
      {hasAssessments && (
        <div>
          <button
            onClick={() => toggleSection('assessments')}
            className="w-full flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg transition-colors"
          >
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-slate-500" />
              <span className="text-xs font-semibold text-slate-700">Assessments ({assessments.length})</span>
            </div>
            {expandedSections.assessments ? (
              <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            )}
          </button>
          {expandedSections.assessments && (
            <div className="space-y-2 mt-2">
              {assessments.map(assess => (
                <AssessmentResult key={assess.id} assessment={assess} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Conflicts Section */}
      {hasConflicts && (
        <div>
          <button
            onClick={() => toggleSection('conflicts')}
            className="w-full flex items-center justify-between p-2 hover:bg-amber-50 rounded-lg transition-colors"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span className="text-xs font-semibold text-amber-900">
                Conflicts ({profile.conflicts.length})
              </span>
            </div>
            {expandedSections.conflicts ? (
              <ChevronUp className="w-3.5 h-3.5 text-amber-600" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-amber-600" />
            )}
          </button>
          {expandedSections.conflicts && (
            <div className="mt-2">
              <ConflictsList conflicts={profile.conflicts} />
            </div>
          )}
        </div>
      )}

      {/* Missing Data Section */}
      {hasMissing && (
        <div>
          <button
            onClick={() => toggleSection('missing')}
            className="w-full flex items-center justify-between p-2 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-semibold text-blue-900">
                Missing Data ({profile.missing_critical_data.length})
              </span>
            </div>
            {expandedSections.missing ? (
              <ChevronUp className="w-3.5 h-3.5 text-blue-600" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-blue-600" />
            )}
          </button>
          {expandedSections.missing && (
            <div className="mt-2">
              <MissingDataList missing={profile.missing_critical_data} />
            </div>
          )}
        </div>
      )}

      {/* No Issues Found */}
      {!hasConflicts && !hasMissing && (documents.length > 0 || assessments.length > 0) && (
        <div className="flex items-center gap-2 p-2.5 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-green-900">Data sources verified</p>
            <p className="text-[10px] text-green-800">No conflicts or missing critical data detected</p>
          </div>
        </div>
      )}
    </div>
  );

  if (variant === "inline") {
    return (
      <>
        {content}
        <DocumentInspectModal
          open={!!inspectingDoc}
          onOpenChange={(open) => !open && setInspectingDoc(null)}
          doc={inspectingDoc}
        />
      </>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3 border-b border-slate-100">
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="w-4 h-4 text-slate-600" />
            Data Provenance
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {content}
        </CardContent>
      </Card>
      <DocumentInspectModal
        open={!!inspectingDoc}
        onOpenChange={(open) => !open && setInspectingDoc(null)}
        doc={inspectingDoc}
      />
    </>
  );
}