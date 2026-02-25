import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { FileText, Plus, Download, Search, Archive, Upload, Loader2, Tag } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const categoryColors = {
  resume: "bg-blue-100 text-blue-700",
  cover_letter: "bg-green-100 text-green-700",
  contract: "bg-violet-100 text-violet-700",
  notes: "bg-amber-100 text-amber-700",
  reference: "bg-pink-100 text-pink-700",
  certification: "bg-indigo-100 text-indigo-700",
  portfolio: "bg-cyan-100 text-cyan-700",
  other: "bg-slate-100 text-slate-600"
};

export default function DocumentsSection({ clientId, onRefresh }) {
  const [documents, setDocuments] = useState([]);
  const [filteredDocs, setFilteredDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [form, setForm] = useState({
    title: "",
    category: "other",
    tags: "",
    notes: ""
  });
  const [selectedFile, setSelectedFile] = useState(null);

  useEffect(() => {
    loadDocuments();
  }, [clientId]);

  useEffect(() => {
    filterDocuments();
  }, [documents, searchTerm, filterCategory]);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const docs = await base44.entities.Document.filter({ client_id: clientId, is_archived: false });
      setDocuments(docs.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
    } catch (error) {
      toast.error("Failed to load documents");
    } finally {
      setLoading(false);
    }
  };

  const filterDocuments = () => {
    let filtered = [...documents];
    
    if (searchTerm) {
      filtered = filtered.filter(doc => 
        doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.file_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    
    if (filterCategory !== "all") {
      filtered = filtered.filter(doc => doc.category === filterCategory);
    }
    
    setFilteredDocs(filtered);
  };

  const handleUpload = async () => {
    if (!selectedFile || !form.title) {
      toast.error("Please select a file and enter a title");
      return;
    }

    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: selectedFile });
      
      const tags = form.tags ? form.tags.split(',').map(t => t.trim()).filter(t => t) : [];
      
      await base44.entities.Document.create({
        client_id: clientId,
        title: form.title,
        file_url,
        file_name: selectedFile.name,
        file_size: selectedFile.size,
        file_type: selectedFile.type,
        category: form.category,
        tags,
        notes: form.notes,
        version: 1
      });

      toast.success("Document uploaded");
      setShowUpload(false);
      setForm({ title: "", category: "other", tags: "", notes: "" });
      setSelectedFile(null);
      loadDocuments();
    } catch (error) {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const archiveDocument = async (docId) => {
    try {
      await base44.entities.Document.update(docId, { is_archived: true });
      toast.success("Document archived");
      loadDocuments();
    } catch (error) {
      toast.error("Failed to archive");
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
            <Button size="sm" onClick={() => setShowUpload(true)}>
              <Upload className="w-3.5 h-3.5 mr-1" /> Upload
            </Button>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <Input
                placeholder="Search documents..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="resume">Resume</SelectItem>
                <SelectItem value="cover_letter">Cover Letter</SelectItem>
                <SelectItem value="contract">Contract</SelectItem>
                <SelectItem value="notes">Notes</SelectItem>
                <SelectItem value="reference">Reference</SelectItem>
                <SelectItem value="certification">Certification</SelectItem>
                <SelectItem value="portfolio">Portfolio</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
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
              {filteredDocs.map(doc => (
                <div key={doc.id} className="flex items-start gap-3 p-3 hover:bg-slate-50 rounded-lg transition-colors">
                  <FileText className="w-5 h-5 text-slate-400 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium text-slate-800">{doc.title}</p>
                      <Badge className={cn("text-xs", categoryColors[doc.category])}>
                        {doc.category.replace(/_/g, ' ')}
                      </Badge>
                      {doc.version > 1 && (
                        <Badge variant="outline" className="text-xs">v{doc.version}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>{doc.file_name}</span>
                      <span>•</span>
                      <span>{((doc.file_size || 0) / 1024).toFixed(0)} KB</span>
                      <span>•</span>
                      <span>{format(new Date(doc.created_date), 'MMM d, yyyy')}</span>
                    </div>
                    {doc.tags && doc.tags.length > 0 && (
                      <div className="flex items-center gap-1 mt-1">
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
                    <Button size="sm" variant="ghost" onClick={() => archiveDocument(doc.id)} className="h-7 px-2">
                      <Archive className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
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
                  <SelectItem value="cover_letter">Cover Letter</SelectItem>
                  <SelectItem value="contract">Contract</SelectItem>
                  <SelectItem value="notes">Notes</SelectItem>
                  <SelectItem value="reference">Reference</SelectItem>
                  <SelectItem value="certification">Certification</SelectItem>
                  <SelectItem value="portfolio">Portfolio</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Tags (comma separated)</Label>
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
    </>
  );
}