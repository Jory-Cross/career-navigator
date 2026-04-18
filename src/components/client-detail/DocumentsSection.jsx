import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { FileText, Plus, Download, Search, Archive, Upload, Loader2, Tag, Trash2 } from "lucide-react";
import {
  getDocuments,
  getDocumentVersions,
  createDocument,
  updateDocument,
  uploadFile,
  archiveDocument as archiveClientDocument,
  deleteDocument as deleteClientDocument
} from "@/lib/api/clientPortalApi";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

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
  const allTags = Array.from(new Set(documents.flatMap(doc => doc.tags || [])));

const loadDocuments = useCallback(async () => {
  setLoading(true);
  try {
    const docs = await getDocuments(clientId);

    const visibleDocs = docs.filter((doc) =>
      showArchived ? doc.is_archived : !doc.is_archived
    );

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
        doc.tags?.some((tag) => tag.toLowerCase().includes(term)) ||
        doc.notes?.toLowerCase().includes(term)
      );
    }

    if (filterCategory !== "all") {
      filtered = filtered.filter((doc) => doc.category === filterCategory);
    }

    if (filterTag) {
      filtered = filtered.filter((doc) => doc.tags?.includes(filterTag));
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
    if (!selectedFile || !form.category) return;
    
    setAiTagging(true);
    try {
      const { data } = await base44.functions.invoke('analyzeDocumentContent', {
        file_name: selectedFile.name,
        current_category: form.category
      });

      setForm(p => ({
        ...p,
        category: data.suggested_category,
        tags: data.tags.join(', ')
      }));
      
      toast.success(`AI suggested: ${data.suggested_category.replace(/_/g, ' ')}`);
    } catch (error) {
      toast.error("AI analysis failed");
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
      
      const tags = form.tags ? form.tags.split(',').map(t => t.trim()).filter(t => t) : [];
      
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
      
           await createDocument(newDoc);
setDocuments((prev) => [
  {
    ...newDoc,
    id: Math.random().toString(36), // temp id
    created_date: new Date().toISOString(),
  },
  ...prev,
]);

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

    setDocuments((prev) =>
      prev.map((doc) =>
        doc.id === docId ? { ...doc, is_archived: true } : doc
      )
    );

    toast.success("Document archived");
  } catch (error) {
    toast.error("Failed to archive");
  }
};
  const deleteDocument = async (docId) => {
  if (!confirm("Permanently delete this document? This cannot be undone.")) return;

  try {
    await deleteClientDocument(docId);

    setDocuments((prev) =>
      prev.filter((doc) => doc.id !== docId)
    );

    toast.success("Document deleted");
  } catch (error) {
    toast.error("Failed to delete");
  }
};

  const totalSize = documents.reduce((sum, doc) => sum + (doc.file_size || 0), 0);
  const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);

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
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          setForm((prev) => ({
            ...prev,
            title: "",
            category: "resume",
            tags: "",
            notes: "",
            visibility: "staff",
          }));
          setShowUpload(true);
        }}
      >
        <Upload className="w-3.5 h-3.5 mr-1" />
        Upload Resume
      </Button>

      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          setForm((prev) => ({
            ...prev,
            title: "",
            category: "cover_letter",
            tags: "",
            notes: "",
            visibility: "staff",
          }));
          setShowUpload(true);
        }}
      >
        <Upload className="w-3.5 h-3.5 mr-1" />
        Upload Cover Letter
      </Button>

      <Button size="sm" onClick={() => setShowUpload(true)}>
        <Upload className="w-3.5 h-3.5 mr-1" /> Upload
      </Button>
    </>
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
                <SelectContent>
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

        console.log("UPDATING", doc.id, nextVisibility);

       const updated = await updateDocument(doc.id, {
  ...doc.raw,
  visibility: nextVisibility,
});

        console.log("RESULT", updated);

        await loadDocuments();
        toast.success("Visibility updated");
      } catch (err) {
        console.error("VISIBILITY UPDATE ERROR", err);
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

                      {doc.tags && doc.tags.length > 0 && (
                        <div className="flex items-center gap-1 mt-1 flex-wrap">
                          <Tag className="w-3 h-3 text-slate-400" />
                          {doc.tags.map(tag => (
                            <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="ghost" className="h-7 px-2">
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                      </a>
                      {showArchived ? (
                        <Button size="sm" variant="ghost" onClick={() => deleteDocument(doc.id)} className="h-7 px-2 text-red-500 hover:text-red-700">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => archiveDocument(doc.id)} className="h-7 px-2">
                          <Archive className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="sm:max-w-md">
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
      </>
      );
      }
