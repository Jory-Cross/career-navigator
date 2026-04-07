import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  FileText, Download, RefreshCw, Settings, ChevronDown, ChevronUp,
  Loader2, CheckCircle, Upload, ExternalLink, AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import PDFFieldMapEditor from "./PDFFieldMapEditor";
import { format } from "date-fns";

export default function PDFReportGenerator({ userRole }) {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [timeEntries, setTimeEntries] = useState([]);
  const [selectedEntryId, setSelectedEntryId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState("");
  const [showMapEditor, setShowMapEditor] = useState(false);
  const [uploadingTemplate, setUploadingTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [showUploadPanel, setShowUploadPanel] = useState(false);
  const [entryTypes, setEntryTypes] = useState([]);

  const isAdmin = userRole === "admin";

  useEffect(() => {
    Promise.all([
      base44.entities.PDFTemplate.filter({ is_active: true }),
      base44.entities.Client.list(),
      base44.entities.EntryType.filter({ is_active: true }),
    ]).then(([tmpl, cls, types]) => {
      setTemplates(tmpl);
      setClients(cls.filter(c => !c.is_archived));
      setEntryTypes(types);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Load time entries when client changes
  useEffect(() => {
    if (!selectedClientId) { setTimeEntries([]); setSelectedEntryId(""); return; }
    base44.entities.TimeEntry.filter({ client_id: selectedClientId }, "-date")
      .then(entries => {
        setTimeEntries(entries);
        setSelectedEntryId("");
      }).catch(() => setTimeEntries([]));
  }, [selectedClientId]);

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);
  const selectedEntry = timeEntries.find(e => e.id === selectedEntryId);

  // Filter entries by date range
  const filteredEntries = useMemo(() => {
    return timeEntries.filter(e => {
      if (!e.date) return true;
      if (startDate && e.date < startDate) return false;
      if (endDate && e.date > endDate) return false;
      return true;
    });
  }, [timeEntries, startDate, endDate]);

  const handleGenerate = async () => {
    if (!selectedTemplateId) { toast.error("Please select a PDF template"); return; }
    setGenerating(true);
    setGeneratedUrl("");
    try {
      const res = await base44.functions.invoke("generatePDFReport", {
        templateId: selectedTemplateId,
        timeEntryId: selectedEntryId || null,
        clientId: selectedClientId || null,
      });
      const url = res?.data?.pdf_url;
      if (!url) throw new Error(res?.data?.error || "No PDF URL returned");
      setGeneratedUrl(url);
      toast.success("PDF generated successfully");
    } catch (e) {
      toast.error("Failed to generate PDF: " + (e?.response?.data?.error || e.message));
    } finally {
      setGenerating(false);
    }
  };

  const handleUploadTemplate = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !newTemplateName) return;
    setUploadingTemplate(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.PDFTemplate.create({
        name: newTemplateName,
        pdf_file_url: file_url,
        entry_type_id: "",
        entry_type_code: "",
        is_active: true,
      });
      const fresh = await base44.entities.PDFTemplate.filter({ is_active: true });
      setTemplates(fresh);
      setNewTemplateName("");
      setShowUploadPanel(false);
      toast.success("Template uploaded");
    } catch (err) {
      toast.error("Upload failed: " + err.message);
    } finally {
      setUploadingTemplate(false);
    }
  };

  const getEntryTypeLabel = (entry) => {
    if (!entry) return null;
    const et = entryTypes.find(t => t.id === entry.entry_type_id || t.code === entry.category);
    return et?.name || entry.category?.replace(/_/g, " ");
  };

  if (loading) return (
    <div className="flex items-center gap-2 text-slate-400 py-6">
      <Loader2 className="w-4 h-4 animate-spin" /> Loading templates...
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-800">PDF Report Generator</h3>
          <p className="text-sm text-slate-500">Generate filled reports from time entry data</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowUploadPanel(p => !p)}
            >
              <Upload className="w-4 h-4 mr-1" /> Upload Template
            </Button>
            {selectedTemplateId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowMapEditor(p => !p)}
              >
                <Settings className="w-4 h-4 mr-1" /> Field Mappings
                {showMapEditor ? <ChevronUp className="w-3.5 h-3.5 ml-1" /> : <ChevronDown className="w-3.5 h-3.5 ml-1" />}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Upload panel (admin only) */}
      {isAdmin && showUploadPanel && (
        <Card className="border border-dashed border-blue-300 bg-blue-50/50 p-4 space-y-3">
          <p className="text-sm font-medium text-slate-700">Upload a new fillable PDF template</p>
          <div>
            <Label className="text-xs text-slate-500 mb-1 block">Template Name</Label>
            <Input
              placeholder="e.g. Job Coaching Monthly Report v2"
              value={newTemplateName}
              onChange={e => setNewTemplateName(e.target.value)}
              className="text-sm"
            />
          </div>
          <div>
            <Label className="text-xs text-slate-500 mb-1 block">PDF File</Label>
            <label className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm cursor-pointer hover:border-blue-400 transition-colors",
              (!newTemplateName || uploadingTemplate) && "opacity-50 pointer-events-none"
            )}>
              {uploadingTemplate ? <Loader2 className="w-4 h-4 animate-spin text-blue-500" /> : <Upload className="w-4 h-4 text-slate-400" />}
              {uploadingTemplate ? "Uploading..." : "Choose PDF file..."}
              <input
                type="file"
                accept=".pdf"
                className="hidden"
                disabled={!newTemplateName || uploadingTemplate}
                onChange={handleUploadTemplate}
              />
            </label>
          </div>
        </Card>
      )}

      {/* Main form */}
      <Card className="border-0 shadow-sm p-5 space-y-4">
        {/* Template picker */}
        <div>
          <Label className="text-xs text-slate-500 mb-1 block">PDF Template <span className="text-red-400">*</span></Label>
          {templates.length === 0 ? (
            <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-lg text-sm text-amber-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              No PDF templates found. {isAdmin ? "Upload one above." : "Ask an admin to upload a PDF template."}
            </div>
          ) : (
            <Select value={selectedTemplateId} onValueChange={v => { setSelectedTemplateId(v); setGeneratedUrl(""); setShowMapEditor(false); }}>
              <SelectTrigger><SelectValue placeholder="Select a report template..." /></SelectTrigger>
              <SelectContent>
                {templates.map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    <div className="flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-slate-400" />
                      {t.name}
                      {t.version && <Badge variant="outline" className="text-[10px] ml-1">{t.version}</Badge>}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Client picker */}
        <div>
          <Label className="text-xs text-slate-500 mb-1 block">Client</Label>
          <Select value={selectedClientId} onValueChange={v => { setSelectedClientId(v); setGeneratedUrl(""); }}>
            <SelectTrigger><SelectValue placeholder="Select client (optional)..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value={null}>— All / No Client —</SelectItem>
              {clients.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Date range filter + entry picker */}
        {selectedClientId && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-slate-500 mb-1 block">From</Label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs text-slate-500 mb-1 block">To</Label>
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
            </div>

            <div>
              <Label className="text-xs text-slate-500 mb-1 block">
                Time Entry ({filteredEntries.length} matching)
              </Label>
              {filteredEntries.length === 0 ? (
                <p className="text-xs text-slate-400 py-2">No time entries found for this client in the selected range.</p>
              ) : (
                <Select value={selectedEntryId} onValueChange={v => { setSelectedEntryId(v); setGeneratedUrl(""); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a specific entry..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>— Use most recent —</SelectItem>
                    {filteredEntries.map(e => (
                      <SelectItem key={e.id} value={e.id}>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-medium">{e.date}</span>
                          <span className="text-slate-400">{e.duration_minutes}min</span>
                          <span className="text-slate-500">{getEntryTypeLabel(e) || e.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </>
        )}

        {/* Selected entry preview */}
        {selectedEntry && (
          <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-600 space-y-1">
            <p className="font-medium text-slate-700">Selected Entry</p>
            <p>Date: <span className="text-slate-800">{selectedEntry.date}</span></p>
            <p>Duration: <span className="text-slate-800">{selectedEntry.duration_minutes} min</span></p>
            <p>Type: <span className="text-slate-800">{getEntryTypeLabel(selectedEntry) || "—"}</span></p>
          </div>
        )}

        {/* Generate button */}
        <div className="flex items-center gap-3 pt-1">
          <Button
            className="flex-1"
            onClick={handleGenerate}
            disabled={generating || !selectedTemplateId}
          >
            {generating
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
              : <><FileText className="w-4 h-4 mr-2" /> Generate PDF</>
            }
          </Button>
          {generatedUrl && (
            <Button
              variant="outline"
              onClick={handleGenerate}
              disabled={generating}
              title="Regenerate with latest data"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Result */}
        {generatedUrl && (
          <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-xl border border-emerald-200">
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-emerald-800">PDF ready</p>
              <p className="text-xs text-emerald-600 truncate">{generatedUrl}</p>
            </div>
            <a href={generatedUrl} target="_blank" rel="noopener noreferrer">
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                <Download className="w-3.5 h-3.5 mr-1" /> Download
              </Button>
            </a>
          </div>
        )}
      </Card>

      {/* Field Map Editor — Admin only, expandable */}
      {isAdmin && showMapEditor && selectedTemplateId && (
        <Card className="border-0 shadow-sm p-5">
          <PDFFieldMapEditor
            templateId={selectedTemplateId}
            templateName={selectedTemplate?.name || ""}
          />
        </Card>
      )}
    </div>
  );
}